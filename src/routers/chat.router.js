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

// 대화 기록을 저장할 배열
let grokConversationHistory = [];

// 서버 시작 시 WebSocket 연결
const webSocket = connectWebSocket();

// 시스템 지시사항 로드
let systemInstruction = null;
try {
  const filePath = path.join(__dirname, '../../bella_system_instructions.md');
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

  try {
    let responseLLM = await getLLMResponse(grokConversationHistory);
    responseLLM = responseLLM.replace(/\[TTS\]:/g, '').trim();
    // 포즈 변경 여부로 과금 판단(임시)
    const poseChangeMatch = responseLLM.match(/\[Pose\]:\s*(.*)/);
    const isPaid = !!poseChangeMatch;
    if (poseChangeMatch) {
      responseLLM = responseLLM.replace(poseChangeMatch[0], '').trim();

      // Warudo에 동작 변화 메시지 전송
      const poseAction = poseChangeMatch[1];
      const messageWarudo = JSON.stringify({ action: poseAction });
      sendMessageToWarudo(messageWarudo);
    }

    // LLM 응답 메시지를 대화 기록에 추가
    const assistantMessage = {
      role: 'assistant',
      content: responseLLM,
    };
    grokConversationHistory.push(assistantMessage);

    // 클라이언트에 응답 전송
    res.json({ message: responseLLM, isPaid });

    // TTS 호출
    playTTSSupertone(responseLLM)
      .then(() => {
        console.log('TTS playback successful');
      })
      .catch((error) => {
        console.error('Error during TTS playback:', error);
        // 에러 처리 로직 추가
      });
  } catch (error) {
    console.error('Error calling Grok API:', error);
    res.status(500).json({ error: 'Grok API 호출 중 오류가 발생했습니다.' });
  }
});

export default router;
