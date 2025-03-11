import express from 'express';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
// import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// dotenv.config(); // 환경 변수 로드

const router = express.Router();

// 현재 파일의 URL을 파일 경로로 변환
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Grok API 초기화
const grokApiKey = process.env.GROK_API_KEY;
const grokClient = new OpenAI({
  apiKey: grokApiKey,
  baseURL: 'https://api.x.ai/v1',
});

let grokConversationHistory = []; // 대화 기록을 저장할 배열

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
    // Grok API에 메시지 전달
    const completion = await grokClient.chat.completions.create({
      model: 'grok-2-1212',
      messages: grokConversationHistory,
    });

    if (completion && completion.choices && completion.choices.length > 0) {
      let responseLLM = completion.choices[0].message.content;
      responseLLM = responseLLM.replace(/\[TTS\]:/g, '').trim();
      // 포즈 변경 여부로 과금 판단(임시)
      const poseChangeMatch = responseLLM.match(/\[Pose\]:\s*(.*)/);
      const isPaid = !!poseChangeMatch;
      if (poseChangeMatch) {
        responseLLM = responseLLM.replace(poseChangeMatch[0], '').trim();
      }

      // LLM 응답 메시지를 대화 기록에 추가
      const assistantMessage = {
        role: 'assistant',
        content: responseLLM,
      };
      grokConversationHistory.push(assistantMessage);

      // 클라이언트에 응답 전송
      res.json({ message: responseLLM, isPaid });
    } else {
      res.status(500).json({ error: 'Grok API 응답이 유효하지 않습니다.' });
    }
  } catch (error) {
    console.error('Error calling Grok API:', error);
    res.status(500).json({ error: 'Grok API 호출 중 오류가 발생했습니다.' });
  }
});

export default router;
