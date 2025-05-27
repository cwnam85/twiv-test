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
let currentModel = 'claude'; // 현재 사용 중인 모델 (기본값: claude)

// 서버 시작 시 WebSocket 연결
const webSocket = connectWebSocket();

// 시스템 지시사항 로드
let systemPrompt = null;
try {
  const filePath = path.join(__dirname, '../../test_system_instructions.md');
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
  const userMessage = `${req.body.message}`;
  
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

    let dialogue = null;
    let emotion = null;
    let pose = null;

    // JSON 형식에서 값 추출
    const matchEmotion = responseLLM.match(/emotion:\s*["']?([^"',}]+)["']?/i);
    if (matchEmotion) {
      emotion = matchEmotion[1].trim();
    } else {
      console.log("Emotion을 찾을 수 없습니다.");
    }

    // Dialogue 추출
    const matchDialogue = responseLLM.match(/dialogue:\s*["']([^"']+)["']/i);
    if (matchDialogue) {
      dialogue = matchDialogue[1].trim();
    } else {
      console.log("Dialogue를 찾을 수 없습니다.");
    }

    // Pose 추출
    const matchPose = responseLLM.match(/pose:\s*["']?([^"',}]+)["']?/i);
    if (matchPose) {
      pose = matchPose[1].trim();
    } else {
      console.log("Pose를 찾을 수 없습니다.");
    }     
    
    // LLM 응답 메시지를 대화 기록에 추가
    const assistantMessage = {
      role: 'assistant',
      content: responseLLM,
    };
    conversationHistory.push(assistantMessage);

    // 클라이언트에 응답 전송
    res.json({ message: dialogue, isPaid: false });

    // TTS 호출
    playTTSSupertone(dialogue, emotion)
      .then(() => {
        //console.log('TTS playback successful');
      })
      .catch((error) => {
        console.error('Error during TTS playback:', error);
      });

    if (pose) {
      const messageWarudo = JSON.stringify({
        action: "Pose",
        data: pose
      });
      sendMessageToWarudo(messageWarudo);
    }
  } catch (error) {
    console.error(`Error calling ${currentModel} API:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: `${currentModel === 'claude' ? 'Claude' : 'Grok'} API 호출 중 오류가 발생했습니다.` });
    }
  }
});

export default router;