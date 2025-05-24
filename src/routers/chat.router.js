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

let conversationHistory = []; // 대화 기록을 저장할 배열
let tmpPurchase = null; // 구매 임시 변수
let currentPose = 'CasualProne';
let currentModel = 'grok'; // 현재 사용 중인 모델 (기본값: grok)

// 서버 시작 시 WebSocket 연결
const webSocket = connectWebSocket();

// 시스템 지시사항 로드
let systemPrompt = null;
try {
  const filePath = path.join(__dirname, '../../test_system_instructions.txt');
  systemPrompt = fs.readFileSync(filePath, 'utf8');
} catch (error) {
  console.error('Error loading system instructions:', error);
}

// 시스템 메시지를 대화 기록에 추가 (Grok 모델에만 적용)
if (systemPrompt && currentModel === 'grok') {
  const systemMessage = {
    role: 'system',
    content: systemPrompt,
  };
  conversationHistory.push(systemMessage);
}

router.post('/chat', async (req, res) => {
  const userMessage = `pose: ${currentPose}\nchat: ${req.body.message}\nnotes: 1.응답 대사를 생성할 때 사용자의 채팅 메시지를 그대로 반복하거나 의문형으로 확인하지 마세요. 사용자의 채팅 메시지를 "하다고?", "했다고?", "라고?" 같은 표현으로 다시 확인하지 마세요.\n 2. 호칭(꼬물이, 꼬물아)은 대화에서 사용자를 직접 지칭할 필요가 있을 때에에만 사용하며, 다른 경우에는 사용하지 마세요.\n 3. 같은 표현을 연속적인 응답에 사용하지 마세요(Do not use the same expression in consecutive responses).`;
  
  // 사용자 메시지를 대화 기록에 추가
  const userMessageObj = {
    role: 'user',
    content: userMessage,
  };
  conversationHistory.push(userMessageObj);

  console.log('(/chat) LLM Input:\n', userMessage);

  try {
    let responseLLM = await getLLMResponse(conversationHistory, currentModel, systemPrompt);
    console.log('LLM Output:\n', responseLLM);

    let responseTTS = null;
    
    // TTS 추출
    const matchTTS = responseLLM.match(/tts:\s*([^pose]+)(?:\s*pose:.*)?/);
    if (matchTTS) {
      responseTTS = matchTTS[1]; // 첫 번째 캡처 그룹 (TTS용 대사)
    } else {
      console.log("TTS 대사를 찾을 수 없습니다.");
    }

    // Pose 추출
    const matchPose = responseLLM.match(/pose:\s*(.+)/);
    if (matchPose) {
      currentPose = matchPose[1]; // 첫 번째 캡처 그룹 (Pose)
    }     
    
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
    conversationHistory.push(assistantMessage);

    // 클라이언트에 응답 전송
    res.json({ message: responseTTS, isPaid });

    // TTS 호출
    playTTSSupertone(responseTTS)
      .then(() => {
        //console.log('TTS playback successful');
      })
      .catch((error) => {
        console.error('Error during TTS playback:', error);
      });

      if (matchPose) {
        const messageWarudo = JSON.stringify({ action: currentPose });
        sendMessageToWarudo(messageWarudo);
      }
  } catch (error) {
    console.error(`Error calling ${currentModel} API:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: `${currentModel === 'claude' ? 'Claude' : 'Grok'} API 호출 중 오류가 발생했습니다.` });
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
    console.log('(/purchase) LLM Input:\n', llmInput.content);

    // LLM에 유료 구매 확인 요청 보내기
    try {
      const llmResponse = await getLLMResponse([...conversationHistory, llmInput], currentModel);

      console.log('(/purchase) LLM Output:\n', llmResponse);

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
      console.error(`Error calling ${currentModel} API after purchase:`, error);
      res.status(500).json({ error: `Error processing purchase with ${currentModel === 'claude' ? 'Claude' : 'Grok'}.` });
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