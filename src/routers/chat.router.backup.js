import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nunjucks from 'nunjucks';
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
import SectionLoader from '../../vtuber_prompts/section-loader.js';

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

// jailbreak 히스토리 렌더링 함수
function renderJailbreakHistory(history, affinityLevel) {
  try {
    // nunjucks 환경 설정
    const env = nunjucks.configure({
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
    });

    // 히스토리의 각 메시지를 렌더링
    return history.map((message) => {
      if (message.content && Array.isArray(message.content)) {
        const renderedContent = message.content.map((content) => {
          if (content.type === 'text' && content.text) {
            return {
              ...content,
              text: env.renderString(content.text, { affinityLevel }),
            };
          }
          return content;
        });
        return { ...message, content: renderedContent };
      }
      return message;
    });
  } catch (error) {
    console.error('Error rendering jailbreak history:', error);
    return history;
  }
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

// 구매 완료 처리
router.post('/purchase', async (req, res) => {
  const { requestedContent, userMessage } = req.body;

  try {
    // 포인트 차감 (예: 10포인트)
    const purchaseCost = 100;
    if (point < purchaseCost) {
      return res.status(400).json({ error: '포인트가 부족합니다.' });
    }

    point = Math.max(0, point - purchaseCost);
    savePoint(point);

    // 구매 완료 후 원래 요청된 콘텐츠 제공
    const purchaseCompleteMessage = `사용자가 ${requestedContent} 구매를 완료했습니다. 원래 요청 "${userMessage}"에 따라 해당 콘텐츠를 제공해주세요.`;

    let requestHistory = [...conversationHistory];

    // 레벨 2 이상이고 jailbreak 캐릭터인 경우에만 임시로 추가
    if (level >= 2 && JAILBREAK_CHARACTERS.includes(activeCharacter)) {
      let levelUpMessages;
      switch (activeCharacter) {
        case 'shaki':
          levelUpMessages = renderJailbreakHistory(SHAKI_JAILBREAK_HISTORY, level);
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
          levelUpMessages = renderJailbreakHistory(SHAKI_JAILBREAK_HISTORY, level);
      }
      requestHistory.push(...levelUpMessages);
    }

    const purchaseResponse = await getLLMResponse(
      [
        ...requestHistory,
        { role: 'user', content: [{ type: 'text', text: purchaseCompleteMessage }] },
      ],
      currentModel,
      systemPrompt,
    );

    // 구매 완료 응답 파싱
    let purchaseDialogue = null;
    let purchaseEmotion = null;
    let purchasePose = null;

    if (typeof purchaseResponse.dialogue === 'object') {
      purchaseDialogue = purchaseResponse.dialogue.dialogue;
      purchaseEmotion = purchaseResponse.dialogue.emotion;
      purchasePose = purchaseResponse.dialogue.pose;
    } else {
      try {
        const parsedPurchase = JSON.parse(purchaseResponse.dialogue);
        purchaseDialogue = parsedPurchase.dialogue;
        purchaseEmotion = parsedPurchase.emotion;
        purchasePose = parsedPurchase.pose;
      } catch (parseError) {
        console.error('Purchase completion response JSON 파싱 오류:', parseError);
      }
    }

    // 대화 기록에 추가
    addToHistory('user', userMessage);
    addToHistory('assistant', purchaseDialogue);

    console.log(
      `Purchase completed: Added to conversation history - User: "${userMessage}", Assistant: "${purchaseDialogue}"`,
    );
    console.log(`Current conversation history length: ${conversationHistory.length}`);

    res.json({
      message: purchaseDialogue,
      emotion: purchaseEmotion,
      pose: purchasePose,
      affinity: affinity,
      level: level,
      point: point,
      purchaseCompleted: true,
      purchasedContent: requestedContent,
    });

    // TTS 호출
    playTTSSupertone(purchaseDialogue, purchaseEmotion)
      .then(() => {
        //console.log('Purchase TTS playback successful');
      })
      .catch((error) => {
        console.error('Error during purchase TTS playback:', error);
      });

    // Warudo에 포즈 변경 메시지 전송
    if (purchasePose) {
      const messageWarudo = JSON.stringify({
        action: 'Pose',
        data: purchasePose,
      });
      sendMessageToWarudo(messageWarudo);
    }
  } catch (error) {
    console.error('구매 완료 처리 중 오류가 발생했습니다.', error);
    res.status(500).json({ error: '구매 완료 처리 중 오류가 발생했습니다.' });
  }
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

// 현재 복장 정보를 반환하는 엔드포인트
router.get('/current-outfit', (req, res) => {
  try {
    if (activeCharacter && initialOutfitData) {
      res.json({
        outfitName: initialOutfit,
        outfitData: initialOutfitData,
      });
    } else {
      res.json({
        outfitName: 'default',
        outfitData: null,
      });
    }
  } catch (error) {
    console.error('Error getting current outfit:', error);
    res.status(500).json({ error: 'Failed to get current outfit' });
  }
});

// 복장 변경 API
router.post('/change-outfit', (req, res) => {
  try {
    const { action, category, item } = req.body;

    if (!activeCharacter || !initialOutfitData) {
      return res.status(400).json({ error: 'No active character or outfit data' });
    }

    // outfits.json 파일 경로
    const outfitPath = path.join(
      __dirname,
      `../../vtuber_prompts/characters/${activeCharacter}/outfits.json`,
    );

    if (!fs.existsSync(outfitPath)) {
      return res.status(404).json({ error: 'Outfit file not found' });
    }

    // 현재 outfits.json 읽기
    const allOutfits = JSON.parse(fs.readFileSync(outfitPath, 'utf8'));
    const currentOutfit = allOutfits[initialOutfit];

    if (!currentOutfit || !currentOutfit.parts[category] || !currentOutfit.parts[category][item]) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // 복장 상태 변경
    if (action === 'remove') {
      currentOutfit.parts[category][item].enabled = false;
    } else if (action === 'wear') {
      currentOutfit.parts[category][item].enabled = true;
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "remove" or "wear"' });
    }

    // outfits.json 파일 업데이트
    fs.writeFileSync(outfitPath, JSON.stringify(allOutfits, null, 2));

    // 메모리상의 initialOutfitData도 업데이트
    initialOutfitData = currentOutfit;

    // 시스템 프롬프트 업데이트 (새로운 복장 정보 반영)
    systemPrompt = loadSystemPrompt(activeCharacter, level, initialOutfitData);

    console.log(`Outfit changed: ${action} ${category}.${item} for ${activeCharacter}`);

    res.json({
      success: true,
      message: `Successfully ${action}ed ${item}`,
      updatedOutfit: currentOutfit,
    });
  } catch (error) {
    console.error('Error changing outfit:', error);
    res.status(500).json({ error: 'Failed to change outfit' });
  }
});

// 캐릭터별 초기 outfit 환경변수 읽기
const outfitEnvKey = `${activeCharacter?.toUpperCase()}_OUTFIT`;
const initialOutfit = process.env[outfitEnvKey] || 'casual';

// outfits.json에서 해당 outfit 정보 불러오기
let initialOutfitData = null;
try {
  const outfitPath = path.join(
    __dirname,
    `../../vtuber_prompts/characters/${activeCharacter}/outfits.json`,
  );
  if (fs.existsSync(outfitPath)) {
    const allOutfits = JSON.parse(fs.readFileSync(outfitPath, 'utf8'));
    if (allOutfits[initialOutfit]) {
      initialOutfitData = allOutfits[initialOutfit];
    }
  }
} catch (e) {
  console.error('outfits.json 로드 오류:', e);
}

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

let conversationHistory = [...initialHistory];

// 복장 정보 history에 추가 (assistant role, 자연어만)
if (activeCharacter && initialOutfitData) {
  conversationHistory.push({
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: `현재 ${activeCharacter}는 "${initialOutfit}" 복장을 입고 있습니다.`,
      },
    ],
  });

  // 복장 정보를 별도로 저장 (필요시 사용)
  console.log(`Loaded outfit data for ${activeCharacter}:`, initialOutfitData);
}

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

// content 필드가 없는 메시지 필터링
conversationHistory = conversationHistory.filter(
  (message) => message.content && Array.isArray(message.content) && message.content.length > 0,
);

let tmpPurchase = null; // 구매 임시 변수
let currentModel = 'claude'; // 현재 사용 중인 모델 (기본값: claude)
let { affinity, level } = loadAffinity(); // 호감도와 레벨 변수 초기화
let { point } = loadPoint(); // 포인트 변수 초기화

// 서버 시작 시 WebSocket 연결
const webSocket = connectWebSocket();

// 시스템 프롬프트 동적 로드 함수
function loadSystemPrompt(character, currentLevel, currentOutfit = null) {
  try {
    if (character) {
      const isNSFW = JAILBREAK_CHARACTERS.includes(character) && currentLevel >= 2;
      const loader = new SectionLoader(character);

      const prompt = loader.buildPrompt({
        isNSFW,
        currentOutfit,
        affinityLevel: currentLevel,
        user: 'user',
      });

      if (prompt) {
        console.log(
          `Loaded ${isNSFW ? 'NSFW' : 'SFW'} prompt for ${character} (Level: ${currentLevel}, Outfit: ${currentOutfit?.current_outfit || 'default'})`,
        );
        return prompt;
      }
    }

    // 기본값 (기존 방식 유지)
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
let systemPrompt = loadSystemPrompt(activeCharacter, level, initialOutfitData);

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
          levelUpMessages = renderJailbreakHistory(SHAKI_JAILBREAK_HISTORY, level);
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
          levelUpMessages = renderJailbreakHistory(SHAKI_JAILBREAK_HISTORY, level);
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
    let purchaseRequired = false;
    let requestedContent = null;
    let outfitChange = null;

    try {
      // dialogue is now already parsed JSON
      if (typeof responseLLM.dialogue === 'object') {
        dialogue = responseLLM.dialogue.dialogue;
        emotion = responseLLM.dialogue.emotion;
        pose = responseLLM.dialogue.pose;
        purchaseRequired =
          responseLLM.dialogue.purchaseRequired === 'true' ||
          responseLLM.dialogue.purchaseRequired === true;
        requestedContent = responseLLM.dialogue.requestedContent;
        outfitChange = responseLLM.dialogue.outfitChange;

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
              systemPrompt = loadSystemPrompt(activeCharacter, level, initialOutfitData);
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
              systemPrompt = loadSystemPrompt(activeCharacter, level, initialOutfitData);
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
          purchaseRequired =
            parsedDialogue.purchaseRequired === 'true' || parsedDialogue.purchaseRequired === true;
          requestedContent = parsedDialogue.requestedContent;
          outfitChange = parsedDialogue.outfitChange;

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
                systemPrompt = loadSystemPrompt(activeCharacter, level, initialOutfitData);
              }
              // 레벨다운 체크
              else if (affinity < 0 && level > 1) {
                level -= 1;
                affinity = 100 + affinity; // 100에서 부족한 만큼을 뺀 값
                console.log(`Level down! Current level: ${level}`);
                saveAffinity(affinity, level);
                // 레벨다운 시 시스템 프롬프트 업데이트
                systemPrompt = loadSystemPrompt(activeCharacter, level, initialOutfitData);
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

    // outfitChange 처리
    if (outfitChange && outfitChange.action && outfitChange.category && outfitChange.item) {
      console.log(
        `Processing outfit change: ${outfitChange.action} ${outfitChange.category}.${outfitChange.item}`,
      );

      try {
        // outfits.json 파일 경로
        const outfitPath = path.join(
          __dirname,
          `../../vtuber_prompts/characters/${activeCharacter}/outfits.json`,
        );

        if (fs.existsSync(outfitPath)) {
          // 현재 outfits.json 읽기
          const allOutfits = JSON.parse(fs.readFileSync(outfitPath, 'utf8'));
          const currentOutfit = allOutfits[initialOutfit];

          if (
            currentOutfit &&
            currentOutfit.parts[outfitChange.category] &&
            currentOutfit.parts[outfitChange.category][outfitChange.item]
          ) {
            // 복장 상태 변경
            if (outfitChange.action === 'remove') {
              currentOutfit.parts[outfitChange.category][outfitChange.item].enabled = false;
            } else if (outfitChange.action === 'wear') {
              currentOutfit.parts[outfitChange.category][outfitChange.item].enabled = true;
            }

            // outfits.json 파일 업데이트
            fs.writeFileSync(outfitPath, JSON.stringify(allOutfits, null, 2));

            // 메모리상의 initialOutfitData도 업데이트
            initialOutfitData = currentOutfit;

            // 시스템 프롬프트 업데이트 (새로운 복장 정보 반영)
            systemPrompt = loadSystemPrompt(activeCharacter, level, initialOutfitData);

            console.log(
              `Outfit changed: ${outfitChange.action} ${outfitChange.category}.${outfitChange.item} for ${activeCharacter}`,
            );
          } else {
            console.error(`Item not found: ${outfitChange.category}.${outfitChange.item}`);
          }
        } else {
          console.error('Outfit file not found');
        }
      } catch (outfitError) {
        console.error('Error changing outfit:', outfitError);
      }
    }

    // 구매 필요 감지 및 처리
    if (purchaseRequired && requestedContent) {
      console.log(`Purchase required for: ${requestedContent}`);

      // 구매 확인 메시지 생성 요청
      const purchaseMessage = `사용자가 "${userMessage}"라고 바로 전에 언급했으며, ${requestedContent}를 구매하려고 합니다. 맥락에 맞는 구매 확인 메시지를 생성해주세요.`;

      try {
        const purchaseResponse = await getLLMResponse(
          [...requestHistory, { role: 'user', content: [{ type: 'text', text: purchaseMessage }] }],
          currentModel,
          systemPrompt,
        );

        // 구매 확인 응답 파싱
        let purchaseDialogue = null;
        let purchaseEmotion = null;
        let purchasePose = null;

        if (typeof purchaseResponse.dialogue === 'object') {
          purchaseDialogue = purchaseResponse.dialogue.dialogue;
          purchaseEmotion = purchaseResponse.dialogue.emotion;
          purchasePose = purchaseResponse.dialogue.pose;
        } else {
          try {
            const parsedPurchase = JSON.parse(purchaseResponse.dialogue);
            purchaseDialogue = parsedPurchase.dialogue;
            purchaseEmotion = parsedPurchase.emotion;
            purchasePose = parsedPurchase.pose;
          } catch (parseError) {
            console.error('Purchase response JSON 파싱 오류:', parseError);
          }
        }

        // 구매 확인 메시지로 대체
        if (purchaseDialogue) {
          dialogue = purchaseDialogue;
          emotion = purchaseEmotion || emotion;
          pose = purchasePose || pose; // 현재 포즈 유지
        }

        // 포인트 추가 차감 (구매 확인 메시지 생성 비용)
        point = Math.max(0, point - 1);
        savePoint(point);
      } catch (purchaseError) {
        console.error('구매 확인 메시지 생성 오류:', purchaseError);
      }
    }

    // 프리미엄 콘텐츠 자동 감지 및 수정
    if (requestedContent && !purchaseRequired) {
      console.log(
        `Auto-detected premium content: ${requestedContent}, forcing purchaseRequired to true`,
      );
      purchaseRequired = true;
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
      purchaseRequired: purchaseRequired,
      requestedContent: requestedContent,
      outfitChange: outfitChange,
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
