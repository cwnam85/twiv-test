import { getLLMResponse } from './llmService.js';
import { playTTSSupertone } from './ttsService.js';
import { sendMessageToWarudo } from './warudoService.js';
import characterService from './characterService.js';
import affinityService from './affinityService.js';

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

      return this.parseResponse(responseLLM);
    } catch (error) {
      console.error(`Error calling ${currentModel} API:`, error);
      throw error;
    }
  }

  parseResponse(responseLLM) {
    let dialogue = null;
    let emotion = null;
    let pose = null;
    let usage = null;
    let purchaseRequired = false;
    let requestedContent = null;
    let outfitChange = null;

    try {
      if (typeof responseLLM.dialogue === 'object') {
        const parsed = responseLLM.dialogue;
        dialogue = parsed.dialogue;
        emotion = parsed.emotion;
        pose = parsed.pose;
        purchaseRequired = parsed.purchaseRequired === 'true' || parsed.purchaseRequired === true;
        requestedContent = parsed.requestedContent;
        outfitChange = parsed.outfitChange;

        // affinity 처리
        if (parsed.affinity) {
          this.processAffinityChange(parsed.affinity);
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
            this.processAffinityChange(parsedDialogue.affinity);
          }
        } catch (parseError) {
          console.error('JSON 파싱 중 오류 발생:', parseError);
          // 기존 정규식 방식으로 폴백
          return this.parseWithRegex(responseLLM.dialogue);
        }
      }

      usage = responseLLM.usage;

      return {
        dialogue,
        emotion,
        pose,
        usage,
        purchaseRequired,
        requestedContent,
        outfitChange,
      };
    } catch (error) {
      console.error('Response parsing error:', error);
      return this.parseWithRegex(responseLLM.dialogue);
    }
  }

  parseWithRegex(dialogueText) {
    const matchEmotion = dialogueText.match(/emotion:\s*["']?([^"',}]+)["']?/i);
    const matchDialogue = dialogueText.match(/dialogue:\s*["']([^"']+)["']/i);
    const matchPose = dialogueText.match(/pose:\s*["']?([^"',}]+)["']?/i);

    return {
      dialogue: matchDialogue ? matchDialogue[1].trim() : null,
      emotion: matchEmotion ? matchEmotion[1].trim() : null,
      pose: matchPose ? matchPose[1].trim() : null,
      usage: null,
      purchaseRequired: false,
      requestedContent: null,
      outfitChange: null,
    };
  }

  processAffinityChange(affinityChange) {
    const change = parseInt(affinityChange);
    if (!isNaN(change)) {
      const result = affinityService.updateAffinity(change);

      if (result.levelChanged) {
        // 레벨 변경 시 시스템 프롬프트 업데이트
        const { level } = affinityService.getData();
        characterService.updateSystemPrompt(level);
        console.log(`Level changed to ${result.newLevel}`);
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
        return {
          ...parsed,
          purchaseRequired: false, // 구매 확인 메시지이므로 false로 설정
        };
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

  async playResponse(dialogue, emotion) {
    try {
      await playTTSSupertone(dialogue, emotion);
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
    if (outfitChange && outfitChange.action && outfitChange.category && outfitChange.item) {
      console.log(
        `Processing outfit change: ${outfitChange.action} ${outfitChange.category}.${outfitChange.item}`,
      );

      try {
        characterService.changeOutfit(
          outfitChange.action,
          outfitChange.category,
          outfitChange.item,
        );

        // 시스템 프롬프트 업데이트
        const { level } = affinityService.getData();
        characterService.updateSystemPrompt(level, characterService.getOutfitData().outfitData);
      } catch (outfitError) {
        console.error('Error changing outfit:', outfitError);
      }
    }
  }
}

export default new ResponseService();
