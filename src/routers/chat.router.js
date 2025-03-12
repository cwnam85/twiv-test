import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLLMResponse } from '../services/llmService.js';
import { playTTSSupertone } from '../services/ttsService.js';
import { connectWebSocket, sendMessageToWarudo } from '../services/warudoService.js';

const router = express.Router();

// 현재 파일의 URL을 파일 경로로 변환
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let grokConversationHistory = []; // 대화 기록을 저장할 배열
let tmpPurchase = null; // 구매 임시 변수

// 서버 시작 시 WebSocket 연결
const webSocket = connectWebSocket();

// 시스템 지시사항 로드
let systemInstruction = null;
try {
  const filePath = path.join(__dirname, '../../test_system_instructions.md');
  systemInstruction = fs.readFileSync(filePath, 'utf8');
} catch (error) {
  console.error('Error loading system instructions:', error);
}

// 시스템 메시지를 대화 기록에 추가
if (systemInstruction) {
  const systemMessage = {
    role: 'system',
    content: systemInstruction,
  };
  grokConversationHistory.push(systemMessage);
}

router.post('/chat', async (req, res) => {
  const userMessage = req.body.message;

  // 사용자 메시지를 대화 기록에 추가
  const userMessageObj = {
    role: 'user',
    content: userMessage,
  };
  grokConversationHistory.push(userMessageObj);

  const userMessages = grokConversationHistory.filter((message) => message.role === 'user');
  console.log('(/chat) LLM Input:', userMessages);

  try {
    let responseLLM = await getLLMResponse(grokConversationHistory);

    console.log('(/chat) LLM Output:', responseLLM);

    // [TTS]: 태그 제거
    responseLLM = responseLLM.replace(/\[TTS\]:/g, '').trim();

    // Action과 Item 여부로 과금 판단
    const actionMatch = responseLLM.match(/\[Action\]:\s*(.*)/);
    const itemMatch = responseLLM.match(/\[Item\]:\s*(.*)/);
    const isPaid = actionMatch && itemMatch;
    if (isPaid) {
      // 유료 구매 항목 저장
      tmpPurchase = {
        ttsMessage: responseLLM,
        action: actionMatch ? actionMatch[1] : null,
        item: itemMatch ? itemMatch[1] : null,
      };

      // [Action]과 [Item] 항목 제거
      responseLLM = responseLLM.replace(actionMatch[0], '').trim();
      responseLLM = responseLLM.replace(itemMatch[0], '').trim();
    }

    // LLM 응답 메시지를 대화 기록에 추가
    const assistantMessage = {
      role: 'assistant',
      content: responseLLM,
    };
    grokConversationHistory.push(assistantMessage);

    // 클라이언트에 응답 전송
    res.json({ message: responseLLM, isPaid });

    if (!isPaid) {
      // TTS 호출
      playTTSSupertone(responseLLM)
        .then(() => {
          console.log('TTS playback successful');
        })
        .catch((error) => {
          console.error('Error during TTS playback:', error);
        });

      // Warudo에 동작 변화 메시지 전송
      const poseChangeMatch = responseLLM.match(/\[Pose\]:\s*(.*)/);
      if (poseChangeMatch) {
        const poseAction = poseChangeMatch[1];
        const messageWarudo = JSON.stringify({ action: poseAction });
        sendMessageToWarudo(messageWarudo);
      }
    }
  } catch (error) {
    console.error('Error calling Grok API:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Grok API 호출 중 오류가 발생했습니다.' });
    }
  }
});

router.post('/purchase', async (req, res) => {
  const purchaseConfirmed = req.body.purchase;

  if (purchaseConfirmed && tmpPurchase) {
    const llmInput = {
      role: 'system',
      content: `[Pose]: ${tmpPurchase.action}\n[Purchase]: Yes\n[Action]: ${tmpPurchase.action}\n[Item]: ${tmpPurchase.item}`,
    };
    console.log('(/purchase) LLM Input:', llmInput);

    // LLM에 유료 구매 확인 요청 보내기
    try {
      const llmResponse = await getLLMResponse([...grokConversationHistory, llmInput]);

      console.log('(/purchase) LLM Output:', llmResponse);

      // LLM 응답에서 메시지만 추출
      const responseTTSMessage = llmResponse
        .replace(/\[TTS\]:\s*/g, '')
        .replace(/\[Pose\]:\s*.*\n?/g, '')
        .trim();

      playTTSSupertone(responseTTSMessage)
        .then(() => {
          console.log('Purchase LLM TTS playback successful');
        })
        .catch((error) => {
          console.error('Error during LLM TTS playback:', error);
        });

      // Warudo에 유료 동작 변화 메시지 전송
      const poseChangeMatch = llmResponse.match(/\[Pose\]:\s*(.*)/);
      if (poseChangeMatch) {
        const poseAction = poseChangeMatch[1];
        const messageWarudo = JSON.stringify({ action: poseAction });
        sendMessageToWarudo(messageWarudo);
      }

      res.json({ message: responseTTSMessage });
    } catch (error) {
      console.error('Error calling LLM after purchase:', error);
      res.status(500).json({ error: 'Error processing purchase with LLM.' });
    } finally {
      tmpPurchase = null;
    }
  } else {
    // 구매 취소 시 메시지 전송
    const cancelMessage = '취소';
    playTTSSupertone(cancelMessage)
      .then(() => {
        console.log('Cancel TTS playback successful');
      })
      .catch((error) => {
        console.error('Error during cancel TTS playback:', error);
      });

    res.json({ message: cancelMessage });
  }
});

export default router;
