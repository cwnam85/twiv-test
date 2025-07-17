import express from 'express';
import { playMP3 } from '../services/audioService.js';
import { connectWebSocket } from '../services/warudoService.js';
import { CHARACTER_MESSAGES } from '../data/characterMessages.js';
import { CHARACTER_SETTINGS } from '../../vtuber_prompts/character_settings.js';
import affinityService from '../services/affinityService.js';
import characterService from '../services/characterService.js';
import conversationService from '../services/conversationService.js';
import responseService from '../services/responseService.js';
import {
  processAIResponse,
  isValidResponse,
  createResponseSummary,
} from '../utils/responseProcessor.js';

const router = express.Router();

// 서버 시작 시 WebSocket 연결
const webSocket = connectWebSocket();

// 시스템 메시지를 대화 기록에 추가 (Grok 모델에만 적용)
conversationService.addSystemMessageIfNeeded();

// 검열 에러 감지 함수 (새로운 유틸리티 함수 사용)
function isInvalidResponse(response) {
  return !isValidResponse(response);
}

// 재시도 로직 함수 (새로운 응답 처리 함수 사용)
async function processLLMResponseWithRetry(
  requestHistory,
  realMessage,
  currentModel,
  systemPrompt,
  maxRetries = 10,
) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`LLM API 호출 시도 ${attempt}/${maxRetries}`);

      const response = await responseService.processLLMResponse(
        requestHistory,
        realMessage,
        currentModel,
        systemPrompt,
      );

      // 응답 요약 로그
      const summary = createResponseSummary(response);
      console.log(`응답 처리 완료 (시도 ${attempt}):`, summary);

      // 검열된 응답인지 확인
      if (isInvalidResponse(response)) {
        console.log(`잘못된 응답 감지 (시도 ${attempt}/${maxRetries}), 재시도 중...`);
        lastError = new Error('Invalid response detected');

        if (attempt < maxRetries) {
          // 잠시 대기 후 재시도
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }

      // 정상적인 응답이면 반환
      return response;
    } catch (error) {
      console.log(`LLM API 호출 실패 (시도 ${attempt}/${maxRetries}):`, error.message);
      lastError = error;

      if (attempt < maxRetries) {
        // 잠시 대기 후 재시도
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // 모든 시도 실패 시 마지막 에러 던지기
  throw lastError;
}

// 현재 호감도와 레벨 가져오기
router.get('/affinity', (req, res) => {
  const data = affinityService.getData();
  res.json(data);
});

// 호감도 정보 API
router.get('/affinity-info', (req, res) => {
  const data = affinityService.getData();
  res.json({
    ...data,
    affinityLevel: affinityService.getAffinityLevel(),
  });
});

// 호감도와 포인트 업데이트
router.post('/affinity', (req, res) => {
  const { point: newPoint } = req.body;
  if (newPoint !== undefined) {
    affinityService.updatePoint(newPoint - affinityService.getData().point);
  }
  res.json(affinityService.getData());
});

// 구매 완료 처리
router.post('/purchase', async (req, res) => {
  const { requestedContent, userMessage } = req.body;

  try {
    // 포인트 차감
    const purchaseCost = 100;
    if (!affinityService.hasEnoughPoints(purchaseCost)) {
      return res.status(400).json({ error: '포인트가 부족합니다.' });
    }

    affinityService.deductPoint(purchaseCost);

    // 구매 완료 후 원래 요청된 콘텐츠 제공
    const requestHistory = conversationService.getRequestHistory();
    const currentModel = conversationService.getCurrentModel();
    const systemPrompt = characterService.getSystemPrompt();

    const purchaseResponse = await processLLMResponseWithRetry(
      requestHistory,
      userMessage,
      currentModel,
      systemPrompt,
    );

    // 대화 기록에 추가
    conversationService.addToHistory('user', userMessage);
    conversationService.addToHistory('assistant', purchaseResponse.dialogue);

    console.log(
      `Purchase completed: Added to conversation history - User: "${userMessage}", Assistant: "${purchaseResponse.dialogue}"`,
    );
    console.log(`Current conversation history length: ${conversationService.getHistory().length}`);

    // 클라이언트용 오디오 데이터 생성
    let clientAudioData = null;
    try {
      clientAudioData = await responseService.playResponse(
        purchaseResponse.dialogue,
        purchaseResponse.emotion,
        purchaseResponse.matureTags,
        purchaseResponse.segments,
      );
    } catch (audioError) {
      console.error('Error generating audio data:', audioError);
      clientAudioData = null;
    }

    res.json({
      message: purchaseResponse.dialogue,
      emotion: purchaseResponse.emotion,
      pose: purchaseResponse.pose,
      ...affinityService.getData(),
      purchaseCompleted: true,
      purchasedContent: requestedContent,
      audioData: clientAudioData, // 클라이언트용 오디오 데이터 추가
    });

    // Warudo에 포즈 변경 메시지 전송
    responseService.sendPoseToWarudo(purchaseResponse.pose);
  } catch (error) {
    console.error('구매 완료 처리 중 오류가 발생했습니다.', error);
    res.status(500).json({ error: '구매 완료 처리 중 오류가 발생했습니다.' });
  }
});

// 현재 활성화된 캐릭터 정보를 반환하는 엔드포인트
router.get('/active-character', (req, res) => {
  // 캐릭터 정보 반환 시 음성 재생
  try {
    playMP3(`yuara_greeting.mp3`);
  } catch (error) {
    console.error('Error playing greeting TTS:', error);
  }

  res.json({ activeCharacter: characterService.getActiveCharacter() });
});

// 활성 캐릭터 정보만 반환하는 엔드포인트 (오디오 재생 없음)
router.get('/character-info', (req, res) => {
  res.json({ activeCharacter: characterService.getActiveCharacter() });
});

// 현재 복장 정보를 반환하는 엔드포인트
router.get('/current-outfit', (req, res) => {
  try {
    res.json(characterService.getOutfitData());
  } catch (error) {
    console.error('Error getting current outfit:', error);
    res.status(500).json({ error: 'Failed to get current outfit' });
  }
});

// 복장 변경 API
router.post('/change-outfit', (req, res) => {
  try {
    const { action, category } = req.body;

    const updatedOutfit = characterService.changeOutfit(action, category);

    // 시스템 프롬프트 업데이트 (새로운 복장 정보 반영)
    characterService.updateSystemPrompt(characterService.getOutfitData().outfitData);

    res.json({
      success: true,
      message: `Successfully ${action}ed ${category}`,
      updatedOutfit: updatedOutfit,
    });
  } catch (error) {
    console.error('Error changing outfit:', error);
    res.status(500).json({ error: 'Failed to change outfit' });
  }
});

// 메인 채팅 엔드포인트
router.post('/chat', async (req, res) => {
  const userMessage = `${req.body.history}`;
  const realMessage = `${req.body.message}`;

  // 포인트가 0이면 즉시 요청 거부
  if (!affinityService.hasEnoughPoints()) {
    const activeCharacter = characterService.getActiveCharacter();
    const characterMessage = CHARACTER_MESSAGES[activeCharacter] || CHARACTER_MESSAGES.meuaeng;

    // 랜덤하게 메시지 선택
    const randomMessage =
      characterMessage.noPoint[Math.floor(Math.random() * characterMessage.noPoint.length)];

    // 포인트가 0일 때 TTS로 메시지 재생
    await responseService.playResponse(randomMessage.message, randomMessage.emotion, [], []);

    return res.json({
      message: randomMessage.message,
      isPaid: false,
      isPointDepleted: true,
      ...affinityService.getData(),
      pose: characterMessage.pose,
      emotion: randomMessage.emotion,
    });
  }

  try {
    const requestHistory = conversationService.getRequestHistory();
    const currentModel = conversationService.getCurrentModel();
    const systemPrompt = characterService.getSystemPrompt();

    // LLM 응답 처리
    const response = await processLLMResponseWithRetry(
      requestHistory,
      realMessage,
      currentModel,
      systemPrompt,
    );

    // outfitOn/outfitOff 처리
    responseService.processOutfitChange(response.outfitOn, response.outfitOff);

    // 구매 필요 감지 및 처리
    if (response.purchaseRequired && response.requestedContent) {
      console.log(`Purchase required for: ${response.requestedContent}`);

      try {
        const purchaseResponse = await processLLMResponseWithRetry(
          requestHistory,
          userMessage,
          currentModel,
          systemPrompt,
        );

        // 구매 확인 메시지로 대체
        if (purchaseResponse.dialogue) {
          response.dialogue = purchaseResponse.dialogue;
          response.emotion = purchaseResponse.emotion || response.emotion;
          response.pose = purchaseResponse.pose || response.pose;
        }
      } catch (purchaseError) {
        console.error('구매 확인 메시지 생성 오류:', purchaseError);
      }
    }

    // 프리미엄 콘텐츠 자동 감지 및 수정
    if (response.requestedContent && !response.purchaseRequired) {
      console.log(
        `Auto-detected premium content: ${response.requestedContent}, forcing purchaseRequired to true`,
      );
      response.purchaseRequired = true;
    }

    // 응답 처리 후에 실제 사용자 메시지만 history에 추가
    conversationService.addToHistory('user', userMessage);
    conversationService.addToHistory('assistant', response.dialogue);

    // 클라이언트용 오디오 데이터 생성
    let clientAudioData = null;
    try {
      clientAudioData = await responseService.playResponse(
        response.dialogue,
        response.emotion,
        response.matureTags,
        response.segments,
      );
    } catch (audioError) {
      console.error('Error generating audio data:', audioError);
      clientAudioData = null;
    }

    // 클라이언트에 응답 전송
    res.json({
      message: response.dialogue,
      isPaid: false,
      ...affinityService.getData(),
      pose: response.pose,
      emotion: response.emotion,
      usage: response.usage,
      purchaseRequired: response.purchaseRequired,
      requestedContent: response.requestedContent,
      outfitOn: response.outfitOn,
      outfitOff: response.outfitOff,
      audioData: clientAudioData, // 클라이언트용 오디오 데이터 추가
    });

    // Warudo에 포즈 변경 메시지 전송
    responseService.sendPoseToWarudo(response.pose);
  } catch (error) {
    console.error(`Error calling ${conversationService.getCurrentModel()} API:`, error);
    if (!res.headersSent) {
      res.status(500).json({
        error: `${conversationService.getCurrentModel() === 'claude' ? 'Claude' : 'Grok'} API 호출 중 오류가 발생했습니다.`,
      });
    }
  }
});

// 캐릭터 설정 정보를 반환하는 엔드포인트
router.get('/character-settings', (req, res) => {
  res.json(CHARACTER_SETTINGS);
});

export default router;
