import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLLMResponse } from '../services/llmService.js';
import { playTTSSupertone } from '../services/ttsService.js';
import { connectWebSocket, sendMessageToWarudo } from '../services/warudoService.js';
import {
  NSFW_INITIAL_CONVERSATION_HISTORY,
  SFW_INITIAL_CONVERSATION_HISTORY,
  SHAKI_JAILBREAK_HISTORY,
  MIWOO_JAILBREAK_HISTORY,
  DIA_JAILBREAK_HISTORY,
  HARIO_JAILBREAK_HISTORY,
} from '../data/initialConversation.js';
import { JAILBREAK_CHARACTERS } from '../../vtuber_prompts/character_settings.js';

const router = express.Router();

// 현재 파일의 URL을 파일 경로로 변환
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 호감도 데이터 파일 경로
const AFFINITY_FILE_PATH = path.join(__dirname, '../data/affinity.json');
const POINT_FILE_PATH = path.join(__dirname, '../data/point.json');

// 호감도 데이터 로드 함수
function loadAffinity() {
  try {
    if (fs.existsSync(AFFINITY_FILE_PATH)) {
      const data = fs.readFileSync(AFFINITY_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading affinity data:', error);
  }
  return { affinity: 0, level: 1 };
}

// 포인트 데이터 로드 함수
function loadPoint() {
  try {
    if (fs.existsSync(POINT_FILE_PATH)) {
      const data = fs.readFileSync(POINT_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading point data:', error);
  }
  return { point: 100 };
}

// 호감도 데이터 저장 함수
function saveAffinity(affinity, level) {
  try {
    // data 디렉토리가 없으면 생성
    const dataDir = path.dirname(AFFINITY_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(AFFINITY_FILE_PATH, JSON.stringify({ affinity, level }, null, 2));
  } catch (error) {
    console.error('Error saving affinity data:', error);
  }
}

// 포인트 데이터 저장 함수
function savePoint(point) {
  try {
    // data 디렉토리가 없으면 생성
    const dataDir = path.dirname(POINT_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(POINT_FILE_PATH, JSON.stringify({ point }, null, 2));
  } catch (error) {
    console.error('Error saving point data:', error);
  }
}

// 현재 호감도와 레벨 가져오기
router.get('/affinity', (req, res) => {
  res.json({ affinity, level, point });
});

// 호감도와 포인트 업데이트
router.post('/affinity', (req, res) => {
  const { point: newPoint } = req.body;
  if (newPoint !== undefined) {
    const oldPoint = point; // 이전 포인트 값 저장
    point = newPoint;
    savePoint(point);

    // 포인트가 증가했을 때만 감사 인사 추가
    if (point > oldPoint) {
      const message = {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '시스템: 포인트가 충전되었습니다. 사용자에게 감사하다는 인사를 자연스럽게 해주세요.',
          },
        ],
      };
      conversationHistory.push(message);
    }
  }
  res.json({ affinity, level, point });
});

// 현재 활성화된 캐릭터에 따라 초기 대화 기록 선택
const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase();
console.log('activeCharacter', activeCharacter);

// 현재 활성화된 캐릭터 정보를 반환하는 엔드포인트
router.get('/active-character', (req, res) => {
  res.json({ activeCharacter });
});

let initialHistory;
switch (activeCharacter) {
  case 'meuaeng':
    initialHistory = SFW_INITIAL_CONVERSATION_HISTORY;
    break;
  case 'leda':
    initialHistory = SFW_INITIAL_CONVERSATION_HISTORY;
    break;
  default:
    initialHistory = SFW_INITIAL_CONVERSATION_HISTORY;
    break;
}

let conversationHistory = initialHistory;
let tmpPurchase = null; // 구매 임시 변수
let currentModel = 'claude'; // 현재 사용 중인 모델 (기본값: claude)
let { affinity, level } = loadAffinity(); // 호감도와 레벨 변수 초기화
let { point } = loadPoint(); // 포인트 변수 초기화
let zeroPointRequestCount = 0; // 포인트가 0일 때의 요청 카운트

// 서버 시작 시 WebSocket 연결
const webSocket = connectWebSocket();

// 시스템 지시사항 로드
let systemPrompt = null;
try {
  // 현재 활성화된 캐릭터 설정
  if (activeCharacter) {
    // 특정 캐릭터가 지정된 경우 해당 캐릭터의 지시사항 로드
    const characterPath = path.join(__dirname, `../../vtuber_prompts/${activeCharacter}.md`);
    if (fs.existsSync(characterPath)) {
      systemPrompt = fs.readFileSync(characterPath, 'utf8');
    }
  }

  // 캐릭터가 지정되지 않았거나 해당 캐릭터 파일이 없는 경우 기본 샤키 지시사항 사용
  if (!systemPrompt) {
    const defaultFilePath = path.join(
      __dirname,
      '../../vtuber_prompts/test_system_instructions.md',
    );
    systemPrompt = fs.readFileSync(defaultFilePath, 'utf8');
  }
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

// 대화 기록 관리 함수
function addToHistory(role, content) {
  const message = {
    role: role,
    content: [
      {
        type: 'text',
        text: content,
      },
    ],
  };

  // 포인트가 0일 때 시스템 컨텍스트 추가
  if (point === 0) {
    const systemMessage = {
      role: 'system',
      content: [
        {
          type: 'text',
          text: '시스템: 현재 포인트가 0입니다. 사용자에게 포인트 충전이 필요하다는 것을 자연스럽게 알려주세요.',
        },
      ],
    };
    conversationHistory.push(systemMessage);
  }

  conversationHistory.push(message);
}

router.post('/chat', async (req, res) => {
  const userMessage = `${req.body.history}`;
  const realMessage = `${req.body.message}`;

  // 포인트가 0이고 요청 카운트가 2 이상이면 요청 거부
  if (point === 0 && zeroPointRequestCount >= 2) {
    return res.json({
      message: '포인트가 부족합니다. 포인트를 충전해주세요.',
      isPaid: false,
      affinity: affinity,
      level: level,
      point: point,
      pose: 'stand',
      emotion: 'Neutral',
    });
  }

  // 사용자 메시지 추가 (Risu AI 형식)
  addToHistory('user', userMessage);

  try {
    let responseLLM = await getLLMResponse(conversationHistory, currentModel, systemPrompt);
    console.log('LLM Output:\n', responseLLM);

    // LLM 응답을 받은 후 포인트 차감
    point = Math.max(0, point - 1);
    savePoint(point);

    // 포인트가 0이면 요청 카운트 증가
    if (point === 0) {
      zeroPointRequestCount++;
    } else {
      zeroPointRequestCount = 0; // 포인트가 다시 생기면 카운트 리셋
    }

    let dialogue = null;
    let emotion = null;
    let pose = null;
    let usage = null;

    try {
      // dialogue is now already parsed JSON
      if (typeof responseLLM.dialogue === 'object') {
        dialogue = responseLLM.dialogue.dialogue;
        emotion = responseLLM.dialogue.emotion;
        pose = responseLLM.dialogue.pose;

        // affinity 처리 추가
        if (responseLLM.dialogue.affinity) {
          const affinityChange = parseInt(responseLLM.dialogue.affinity);
          if (!isNaN(affinityChange)) {
            affinity += affinityChange;

            // 레벨업 체크
            if (affinity >= 100 && level < 5) {
              level += 1;
              affinity = 0;
              console.log(`Level up! Current level: ${level}`);

              // 레벨 2 이상일 때 탈옥 프롬프트를 history에 추가합니다.
              if (level >= 2 && JAILBREAK_CHARACTERS.includes(activeCharacter)) {
                let levelUpMessages;
                switch (activeCharacter) {
                  case 'shaki':
                    levelUpMessages = [...SHAKI_JAILBREAK_HISTORY];
                    break;
                  case 'miwoo':
                    levelUpMessages = [...MIWOO_JAILBREAK_HISTORY];
                    break;
                  case 'dia':
                    levelUpMessages = [...DIA_JAILBREAK_HISTORY];
                    break;
                  case 'hario':
                    levelUpMessages = [...HARIO_JAILBREAK_HISTORY];
                    break;
                  default:
                    levelUpMessages = [...SHAKI_JAILBREAK_HISTORY];
                }
                // 탈옥 프롬프트를 추가.
                conversationHistory.push(...levelUpMessages);
              }

              saveAffinity(affinity, level);
              console.log(
                `Affinity changed by ${affinityChange}. Current affinity: ${affinity}, Level: ${level}`,
              );
            }
          }
        }
      } else {
        // Fallback to regex parsing for non-JSON responses
        const matchEmotion = responseLLM.dialogue.match(/emotion:\s*["']?([^"',}]+)["']?/i);
        if (matchEmotion) {
          emotion = matchEmotion[1].trim();
        } else {
          console.log('Emotion을 찾을 수 없습니다.');
        }

        const matchDialogue = responseLLM.dialogue.match(/dialogue:\s*["']([^"']+)["']/i);
        if (matchDialogue) {
          dialogue = matchDialogue[1].trim();
        } else {
          console.log('Dialogue를 찾을 수 없습니다.');
        }

        const matchPose = responseLLM.dialogue.match(/pose:\s*["']?([^"',}]+)["']?/i);
        if (matchPose) {
          pose = matchPose[1].trim();
        } else {
          console.log('Pose를 찾을 수 없습니다.');
        }
      }
      usage = responseLLM.usage;
    } catch (error) {
      console.error('JSON 파싱 중 오류 발생:', error);
      // 기존 정규식 방식으로 폴백
      const matchEmotion = responseLLM.dialogue.match(/emotion:\s*["']?([^"',}]+)["']?/i);
      if (matchEmotion) {
        emotion = matchEmotion[1].trim();
      } else {
        console.log('Emotion을 찾을 수 없습니다.');
      }

      const matchDialogue = responseLLM.dialogue.match(/dialogue:\s*["']([^"']+)["']/i);
      if (matchDialogue) {
        dialogue = matchDialogue[1].trim();
      } else {
        console.log('Dialogue를 찾을 수 없습니다.');
      }

      const matchPose = responseLLM.dialogue.match(/pose:\s*["']?([^"',}]+)["']?/i);
      if (matchPose) {
        pose = matchPose[1].trim();
      } else {
        console.log('Pose를 찾을 수 없습니다.');
      }
    }

    // 응답 메시지 추가 (Risu AI 형식)
    addToHistory('assistant', dialogue);

    // 클라이언트에 응답 전송
    res.json({
      message: dialogue,
      isPaid: false,
      affinity: affinity,
      level: level,
      point: point,
      pose: pose,
      emotion: emotion,
      usage: usage,
    });

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
        action: 'Pose',
        data: pose,
      });
      sendMessageToWarudo(messageWarudo);
    }
  } catch (error) {
    console.error(`Error calling ${currentModel} API:`, error);
    if (!res.headersSent) {
      res.status(500).json({
        error: `${currentModel === 'claude' ? 'Claude' : 'Grok'} API 호출 중 오류가 발생했습니다.`,
      });
    }
  }
});

export default router;
