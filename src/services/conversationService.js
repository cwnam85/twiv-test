import {
  SFW_INITIAL_CONVERSATION_HISTORY,
  SHAKI_JAILBREAK_HISTORY,
  MIWOO_JAILBREAK_HISTORY,
  DIA_JAILBREAK_HISTORY,
  HARIO_JAILBREAK_HISTORY,
} from '../data/initialConversation.js';
import characterService from './characterService.js';
import affinityService from './affinityService.js';

class ConversationService {
  constructor() {
    this.conversationHistory = this.initializeHistory();
    this.currentModel = 'claude';
  }

  initializeHistory() {
    let initialHistory = SFW_INITIAL_CONVERSATION_HISTORY;

    // 복장 정보 history에 추가
    const outfitData = characterService.getOutfitData();
    if (characterService.getActiveCharacter() && outfitData.outfitData) {
      initialHistory.push({
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `현재 ${characterService.getActiveCharacter()}는 "${outfitData.outfitName}" 복장을 입고 있습니다.`,
          },
        ],
      });
    }

    // 캐릭터의 첫 메시지 추가
    const firstMessage = characterService.getFirstMessage();
    if (firstMessage) {
      initialHistory.push({
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: firstMessage,
          },
        ],
      });
    }

    // content 필드가 없는 메시지 필터링
    return initialHistory.filter(
      (message) => message.content && Array.isArray(message.content) && message.content.length > 0,
    );
  }

  addToHistory(role, content) {
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
    if (affinityService.getData().point === 0) {
      const systemMessage = {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '시스템: 현재 포인트가 0입니다. 사용자에게 포인트 충전이 필요합니다.',
          },
        ],
      };
      this.conversationHistory.push(systemMessage);
    }

    this.conversationHistory.push(message);
  }

  getHistory() {
    return [...this.conversationHistory];
  }

  getRequestHistory() {
    let requestHistory = [...this.conversationHistory];

    // 레벨 2 이상이고 jailbreak 캐릭터인 경우에만 임시로 추가
    const { level } = affinityService.getData();
    if (level >= 2 && characterService.isJailbreakCharacter()) {
      const jailbreakHistory = this.getJailbreakHistory();
      requestHistory.push(...jailbreakHistory);
    }

    return requestHistory;
  }

  getJailbreakHistory() {
    const { level } = affinityService.getData();
    const activeCharacter = characterService.getActiveCharacter();

    let levelUpMessages;
    switch (activeCharacter) {
      case 'shaki':
        levelUpMessages = characterService.renderJailbreakHistory(SHAKI_JAILBREAK_HISTORY, level);
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
        levelUpMessages = characterService.renderJailbreakHistory(SHAKI_JAILBREAK_HISTORY, level);
    }
    return levelUpMessages;
  }

  getCurrentModel() {
    return this.currentModel;
  }

  setCurrentModel(model) {
    this.currentModel = model;
  }

  // 시스템 메시지를 대화 기록에 추가 (Grok 모델에만 적용)
  addSystemMessageIfNeeded() {
    if (this.currentModel === 'grok') {
      const systemPrompt = characterService.getSystemPrompt();
      if (systemPrompt) {
        const systemMessage = {
          role: 'system',
          content: systemPrompt,
        };
        this.conversationHistory.push(systemMessage);
      }
    }
  }
}

export default new ConversationService();
