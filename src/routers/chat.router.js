import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLLMResponse } from '../services/llmService.js';
import { playTTSSupertone } from '../services/ttsService.js';
import { playMP3 } from '../services/audioService.js';
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
import { CHARACTER_MESSAGES } from '../data/characterMessages.js';
import { CHARACTER_SETTINGS } from '../../vtuber_prompts/character_settings.js';

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
  }
  res.json({ affinity, level, point });
});

// 현재 활성화된 캐릭터에 따라 초기 대화 기록 선택
const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase();
console.log('activeCharacter', activeCharacter);

// 현재 활성화된 캐릭터 정보를 반환하는 엔드포인트
router.get('/active-character', (req, res) => {
  // 캐릭터 정보 반환 시 음성 재생
  try {
    playMP3(`yuara_greeting.mp3`);
  } catch (error) {
    console.error('Error playing greeting TTS:', error);
  }

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

// 현재 활성화된 캐릭터의 첫 메시지 추가
if (activeCharacter && CHARACTER_SETTINGS[activeCharacter]?.firstMessage) {
  conversationHistory.push({
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: CHARACTER_SETTINGS[activeCharacter].firstMessage,
      },
    ],
  });
}

let tmpPurchase = null; // 구매 임시 변수
let currentModel = 'claude'; // 현재 사용 중인 모델 (기본값: claude)
let { affinity, level } = loadAffinity(); // 호감도와 레벨 변수 초기화
let { point } = loadPoint(); // 포인트 변수 초기화

// 서버 시작 시 WebSocket 연결
const webSocket = connectWebSocket();

// 시스템 프롬프트 동적 로드 함수
function loadSystemPrompt(character, currentLevel) {
  try {
    if (character) {
      // 레벨에 따라 다른 폴더의 프롬프트 로드
      let characterPath;

      // NSFW 캐릭터이고 레벨 2 이상인 경우에만 NSFW 프롬프트 사용
      if (JAILBREAK_CHARACTERS.includes(character) && currentLevel >= 2) {
        characterPath = path.join(
          __dirname,
          `../../vtuber_prompts/nsfw_prompts/${character}_nsfw.md`,
        );
      } else {
        // 그 외의 경우: SFW 프롬프트 사용
        characterPath = path.join(
          __dirname,
          `../../vtuber_prompts/sfw_prompts/${character}_sfw.md`,
        );
      }

      if (fs.existsSync(characterPath)) {
        const prompt = fs.readFileSync(characterPath, 'utf8');
        const promptType =
          JAILBREAK_CHARACTERS.includes(character) && currentLevel >= 2 ? 'NSFW' : 'SFW';
        console.log(`Loaded ${promptType} prompt for ${character} (Level: ${currentLevel})`);
        return prompt;
      }
    }

    // 기본값
    const defaultFilePath = path.join(
      __dirname,
      '../../vtuber_prompts/test_system_instructions.md',
    );
    if (fs.existsSync(defaultFilePath)) {
      return fs.readFileSync(defaultFilePath, 'utf8');
    }
  } catch (error) {
    console.error('Error loading system instructions:', error);
  }
  return null;
}

// 시스템 지시사항 로드
let systemPrompt = loadSystemPrompt(activeCharacter, level);

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
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: '시스템: 현재 포인트가 0입니다. 사용자에게 포인트 충전이 필요합니다.',
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

  // 포인트가 0이면 즉시 요청 거부
  if (point === 0) {
    // 현재 활성화된 캐릭터의 메시지 가져오기
    const characterMessage = CHARACTER_MESSAGES[activeCharacter] || CHARACTER_MESSAGES.meuaeng;

    // 랜덤하게 메시지 선택
    const randomMessage =
      characterMessage.noPoint[Math.floor(Math.random() * characterMessage.noPoint.length)];

    // 포인트가 0일 때 TTS로 메시지 재생
    playTTSSupertone(randomMessage.message, randomMessage.emotion)
      .then(() => {
        console.log('Point warning TTS playback successful');
      })
      .catch((error) => {
        console.error('Error during point warning TTS playback:', error);
      });

    return res.json({
      message: randomMessage.message,
      isPaid: false,
      isPointDepleted: true,
      affinity: affinity,
      level: level,
      point: point,
      pose: characterMessage.pose,
      emotion: randomMessage.emotion,
    });
  }

  // realMessage만으로 LLM 응답 요청
  try {
    // LLM 요청 시에만 임시로 jailbreak history 추가
    let requestHistory = [...conversationHistory];

    // 레벨 2 이상이고 jailbreak 캐릭터인 경우에만 임시로 추가
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
      requestHistory.push(...levelUpMessages);
    }

    let responseLLM = await getLLMResponse(
      [...requestHistory, { role: 'user', content: [{ type: 'text', text: realMessage }] }],
      currentModel,
      systemPrompt,
    );
    console.log('LLM Output:\n', responseLLM);

    // LLM 응답을 받은 후 포인트 차감
    point = Math.max(0, point - 1);
    savePoint(point);

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
              saveAffinity(affinity, level);
              // 레벨업 시 시스템 프롬프트 업데이트
              systemPrompt = loadSystemPrompt(activeCharacter, level);
              console.log(
                `Affinity changed by ${affinityChange}. Current affinity: ${affinity}, Level: ${level}`,
              );
            }
            // 레벨다운 체크
            else if (affinity < 0 && level > 1) {
              level -= 1;
              affinity = 100 + affinity; // 100에서 부족한 만큼을 뺀 값
              console.log(`Level down! Current level: ${level}`);
              saveAffinity(affinity, level);
              // 레벨다운 시 시스템 프롬프트 업데이트
              systemPrompt = loadSystemPrompt(activeCharacter, level);
            } else {
              // 레벨 1에서는 affinity가 음수가 되지 않도록 처리
              if (level === 1) {
                affinity = Math.max(0, affinity);
              }
              // 일반적인 affinity 변경 (레벨업/다운이 아닌 경우)
              saveAffinity(affinity, level);
            }
          }
        }
      } else {
        // 문자열로 된 JSON을 파싱
        try {
          const parsedDialogue = JSON.parse(responseLLM.dialogue);
          dialogue = parsedDialogue.dialogue;
          emotion = parsedDialogue.emotion;
          pose = parsedDialogue.pose;

          // affinity 처리
          if (parsedDialogue.affinity) {
            const affinityChange = parseInt(parsedDialogue.affinity);
            if (!isNaN(affinityChange)) {
              affinity += affinityChange;
              if (affinity >= 100 && level < 5) {
                level += 1;
                affinity = 0;
                console.log(`Level up! Current level: ${level}`);
                saveAffinity(affinity, level);
                // 레벨업 시 시스템 프롬프트 업데이트
                systemPrompt = loadSystemPrompt(activeCharacter, level);
              }
              // 레벨다운 체크
              else if (affinity < 0 && level > 1) {
                level -= 1;
                affinity = 100 + affinity; // 100에서 부족한 만큼을 뺀 값
                console.log(`Level down! Current level: ${level}`);
                saveAffinity(affinity, level);
                // 레벨다운 시 시스템 프롬프트 업데이트
                systemPrompt = loadSystemPrompt(activeCharacter, level);
              } else {
                // 레벨 1에서는 affinity가 음수가 되지 않도록 처리
                if (level === 1) {
                  affinity = Math.max(0, affinity);
                }
                // 일반적인 affinity 변경 (레벨업/다운이 아닌 경우)
                saveAffinity(affinity, level);
              }
            }
          }
        } catch (parseError) {
          console.error('JSON 파싱 중 오류 발생:', parseError);
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

    // 응답 처리 후에 실제 사용자 메시지만 history에 추가
    addToHistory('user', userMessage);
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

// 캐릭터 설정 정보를 반환하는 엔드포인트
router.get('/character-settings', (req, res) => {
  res.json(CHARACTER_SETTINGS);
});

export default router;
