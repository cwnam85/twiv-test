import { getLLMResponse } from './llmService.js';
import { playTTSSupertone } from './ttsService.js';
import { sendMessageToWarudo } from './warudoService.js';
import characterService from './characterService.js';
import affinityService from './affinityService.js';
import { playMatureTTS } from './audioService.js';

class ResponseService {
  constructor() {
    this.purchaseCost = 100;
  }

  async processLLMResponse(requestHistory, userMessage, currentModel, systemPrompt) {
    try {
      const responseLLM = await getLLMResponse(
        [...requestHistory, { role: 'user', content: [{ type: 'text', text: userMessage }] }],
        currentModel,
        systemPrompt,
      );

      console.log('LLM Output:\n', responseLLM);

      // 포인트 차감
      affinityService.deductPoint(1);

      return await this.parseResponse(responseLLM);
    } catch (error) {
      console.error(`Error calling ${currentModel} API:`, error);
      throw error;
    }
  }

  async parseResponse(responseLLM) {
    let dialogue = null;
    let emotion = null;
    let pose = null;
    let usage = null;
    let matureTags = [];
    let segments = [];

    try {
      // 새로운 응답 처리 함수 사용
      const { processAIResponse } = await import('../utils/responseProcessor.js');
      const processedResponse = processAIResponse(responseLLM);

      dialogue = processedResponse.dialogue;
      emotion = processedResponse.emotion;
      pose = processedResponse.pose;
      const affinity = processedResponse.affinity;
      const outfitChange = processedResponse.outfitChange;
      matureTags = processedResponse.matureTags || [];
      segments = processedResponse.segments || [];

      // affinity 처리
      if (affinity) {
        this.processAffinityChange(affinity);
      }

      usage = responseLLM.usage;

      return {
        dialogue,
        emotion,
        pose,
        usage,
        affinity,
        outfitChange,
        matureTags,
        segments,
      };
    } catch (error) {
      console.error('Response parsing error:', error);
      // 폴백: 기존 정규식 방식 사용
      return this.parseWithRegex(responseLLM.dialogue);
    }
  }

  parseWithRegex(dialogueText) {
    const matchEmotion = dialogueText.match(/emotion:\s*["']?([^"',}]+)["']?/i);
    const matchDialogue = dialogueText.match(/dialogue:\s*["']([^"']+)["']/i);
    const matchPose = dialogueText.match(/pose:\s*["']?([^"',}]+)["']?/i);
    const matchAffinity = dialogueText.match(/affinity:\s*["']?([^"',}]+)["']?/i);
    const matchOutfitChange = dialogueText.match(/outfitChange:\s*\{[\s\S]*?\}/i);

    let outfitChange = null;
    if (matchOutfitChange) {
      try {
        // outfitChange JSON 객체 추출
        const outfitChangeText = matchOutfitChange[0].replace(/outfitChange:\s*/, '');
        outfitChange = JSON.parse(outfitChangeText);
      } catch (e) {
        console.warn('Failed to parse outfitChange from regex:', e);
      }
    }

    return {
      dialogue: matchDialogue ? matchDialogue[1].trim() : null,
      emotion: matchEmotion ? matchEmotion[1].trim() : null,
      pose: matchPose ? matchPose[1].trim() : null,
      usage: null,
      affinity: matchAffinity ? matchAffinity[1].trim() : null,
      outfitChange,
      matureTags: [],
      segments: [],
    };
  }

  processAffinityChange(affinityChange) {
    const change = parseInt(affinityChange);
    if (!isNaN(change)) {
      const result = affinityService.updateAffinity(change);

      if (result.affinityChanged) {
        // affinity 변경 시 시스템 프롬프트 업데이트
        characterService.updateSystemPrompt();
        console.log(`Affinity changed to ${result.newAffinity}`);
      }
    }
  }

  async processPurchaseRequest(
    requestHistory,
    userMessage,
    requestedContent,
    currentModel,
    systemPrompt,
  ) {
    if (!affinityService.hasEnoughPoints(this.purchaseCost)) {
      throw new Error('포인트가 부족합니다.');
    }

    // 포인트 차감
    affinityService.deductPoint(this.purchaseCost);

    const purchaseMessage = `사용자가 "${userMessage}"라고 바로 전에 언급했으며, ${requestedContent}를 구매하려고 합니다. 맥락에 맞는 구매 확인 메시지를 생성해주세요.`;

    try {
      const purchaseResponse = await getLLMResponse(
        [...requestHistory, { role: 'user', content: [{ type: 'text', text: purchaseMessage }] }],
        currentModel,
        systemPrompt,
      );

      const parsed = this.parseResponse(purchaseResponse);

      // 구매 확인 메시지로 대체
      if (parsed.dialogue) {
        return parsed;
      }
    } catch (purchaseError) {
      console.error('구매 확인 메시지 생성 오류:', purchaseError);
      throw purchaseError;
    }
  }

  async processPurchaseCompletion(
    requestHistory,
    userMessage,
    requestedContent,
    currentModel,
    systemPrompt,
  ) {
    const purchaseCompleteMessage = `사용자가 ${requestedContent} 구매를 완료했습니다. 원래 요청 "${userMessage}"에 따라 해당 콘텐츠를 제공해주세요.`;

    try {
      const purchaseResponse = await getLLMResponse(
        [
          ...requestHistory,
          { role: 'user', content: [{ type: 'text', text: purchaseCompleteMessage }] },
        ],
        currentModel,
        systemPrompt,
      );

      return this.parseResponse(purchaseResponse);
    } catch (error) {
      console.error('구매 완료 처리 중 오류가 발생했습니다.', error);
      throw error;
    }
  }

  async playResponse(dialogue, emotion, matureTags = [], segments = []) {
    try {
      if (segments && segments.length > 0) {
        // segments가 있으면 순차적으로 재생
        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];

          if (segment.type === 'text' && segment.content.trim()) {
            // 텍스트 세그먼트는 TTS로 재생
            await playTTSSupertone(segment.content, emotion);
          } else if (segment.type === 'tag') {
            // 태그 세그먼트는 mature 오디오로 재생
            const type = segment.content.replace(/_/g, ''); // _moan_ -> moan
            await playMatureTTS(type);
          }
        }
      } else {
        // segments가 없으면 기존 방식 사용 (호환성)
        await playTTSSupertone(dialogue, emotion);

        // mature 태그들 순차적으로 재생
        for (const tag of matureTags) {
          const type = tag.replace(/_/g, ''); // _kiss_ -> kiss
          await playMatureTTS(type);
        }
      }
    } catch (error) {
      console.error('Error during TTS playback:', error);
    }
  }

  sendPoseToWarudo(pose) {
    if (pose) {
      const messageWarudo = JSON.stringify({
        action: 'Pose',
        data: pose,
      });
      sendMessageToWarudo(messageWarudo);
    }
  }

  processOutfitChange(outfitChange) {
    if (outfitChange && outfitChange.action && outfitChange.category) {
      console.log(`Processing outfit change: ${outfitChange.action} ${outfitChange.category}`);

      try {
        characterService.changeOutfit(outfitChange.action, outfitChange.category);

        // 시스템 프롬프트 업데이트
        characterService.updateSystemPrompt(characterService.getOutfitData().outfitData);
      } catch (outfitError) {
        console.error('Error changing outfit:', outfitError);
      }
    }
  }
}

export default new ResponseService();
