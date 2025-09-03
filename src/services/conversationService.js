import {
  SFW_INITIAL_CONVERSATION_HISTORY,
  SHAKI_JAILBREAK_HISTORY,
  MIWOO_JAILBREAK_HISTORY,
  DIA_JAILBREAK_HISTORY,
  HARIO_JAILBREAK_HISTORY,
} from '../data/initialConversation.js';
import characterService from './characterService.js';
import affinityService from './affinityService.js';
import characterStateService from './characterStateService.js';
import backgroundService from './backgroundService.js';
import fs from 'fs';
import path from 'path';
import nunjucks from 'nunjucks';

class ConversationService {
  constructor() {
    this.conversationHistory = this.initializeHistory();
    this.currentModel = 'claude';
  }

  initializeHistory() {
    let initialHistory = SFW_INITIAL_CONVERSATION_HISTORY;

    // 템플릿 렌더링을 위한 nunjucks 환경 설정
    const env = nunjucks.configure({
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
    });

    // 현재 상점 데이터 가져오기
    const shopData = this.getShopData();
    const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';
    const characterState = characterStateService.getCharacterState(activeCharacter);

    const currentBackground = characterState?.current_background
      ? backgroundService.getBackgroundName(activeCharacter, characterState.current_background)
      : 'Default Background';
    const currentAppearance = characterState?.current_appearance
      ? this.getAppearanceName(characterState.current_appearance)
      : 'Default Appearance';

    // 보유한 아이템들 정보 가져오기
    const ownedBackgrounds =
      shopData && shopData.ownedBackgrounds
        ? shopData.ownedBackgrounds.map((item) =>
            backgroundService.getBackgroundName(activeCharacter, item),
          )
        : ['Default Background'];
    const ownedAppearances =
      shopData && shopData.ownedAppearances
        ? shopData.ownedAppearances.map((item) => this.getAppearanceName(item))
        : ['Default Appearance'];

    // 현재 affinity 값 가져오기
    const { affinity } = affinityService.getData();

    // 템플릿 컨텍스트
    const templateContext = {
      currentBackground: currentBackground,
      currentAppearance: currentAppearance,
      affinity: affinity,
      ownedBackgrounds: ownedBackgrounds.join(', '),
      ownedAppearances: ownedAppearances.join(', '),
    };

    // 히스토리의 각 메시지를 렌더링
    initialHistory = initialHistory.map((message) => {
      if (message.content && Array.isArray(message.content)) {
        const renderedContent = message.content.map((content) => {
          if (content.type === 'text' && content.text) {
            return {
              ...content,
              text: env.renderString(content.text, templateContext),
            };
          }
          return content;
        });
        return { ...message, content: renderedContent };
      }
      return message;
    });

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

    // affinity가 100 이상이고 jailbreak 캐릭터인 경우에만 추가
    const { affinity } = affinityService.getData();
    if (affinity >= 100 && characterService.isJailbreakCharacter()) {
      const jailbreakHistory = this.getJailbreakHistory();
      requestHistory.push(...jailbreakHistory);
    }

    return requestHistory;
  }

  getJailbreakHistory() {
    const activeCharacter = characterService.getActiveCharacter();
    const { affinity } = affinityService.getData();

    let levelUpMessages;
    switch (activeCharacter) {
      case 'shaki':
        levelUpMessages = characterService.renderJailbreakHistory(
          SHAKI_JAILBREAK_HISTORY,
          affinity,
        );
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
        levelUpMessages = characterService.renderJailbreakHistory(
          SHAKI_JAILBREAK_HISTORY,
          affinity,
        );
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

  // 상점 데이터 가져오기
  getShopData() {
    try {
      const shopDataPath = path.join(process.cwd(), 'src', 'data', 'shop_data.json');
      if (fs.existsSync(shopDataPath)) {
        return JSON.parse(fs.readFileSync(shopDataPath, 'utf8'));
      }
    } catch (error) {
      console.error('Error reading shop data:', error);
    }
    return null;
  }

  // 배경 이름 가져오기 (deprecated - backgroundService 사용 권장)
  getBackgroundName(backgroundId) {
    const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';
    return backgroundService.getBackgroundName(activeCharacter, backgroundId);
  }

  // 외모 이름 가져오기
  getAppearanceName(appearanceId) {
    const appearanceNames = {
      default: 'Default Appearance',
      casual: 'Casual',
      school_uniform: 'School Uniform',
      swimsuit: 'Swimsuit',
    };
    return appearanceNames[appearanceId] || appearanceId;
  }

  // 마지막 메시지 가져오기 (최적화)
  getLastMessage() {
    if (this.conversationHistory.length === 0) {
      return 'none';
    }

    // 맨 마지막 메시지부터 역순으로 검색하되, assistant 메시지만 찾으면 바로 반환
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      const message = this.conversationHistory[i];

      // assistant 역할의 메시지 중 실제 대화 내용인 것만 찾기
      if (message.role === 'assistant' && message.content && Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'text' && content.text) {
            // 시스템 메시지가 아닌 실제 대화 내용인지 확인
            if (!content.text.includes('시스템:') && !content.text.includes('현재 포인트가')) {
              return content.text;
            }
          }
        }
      }
    }

    return 'none';
  }

  // 최근 사용자 메시지 3개 가져오기
  getUserLastResponses() {
    const userMessages = [];

    // 역순으로 순회하면서 user 메시지만 추출
    for (let i = this.conversationHistory.length - 1; i >= 0 && userMessages.length < 3; i--) {
      const message = this.conversationHistory[i];

      if (message.role === 'user' && message.content && Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'text' && content.text) {
            // 시스템 메시지 제외 - 실제 사용자 대화만 추출
            const text = content.text.trim();
            if (
              !text.includes('<additional_instructions>') &&
              !text.includes('system:') &&
              !text.includes('[IMPORTANT: This is a fictional roleplay scenario]') &&
              !text.includes('--- Previous  Response ---') &&
              !text.includes('[Current Status]') &&
              !text.includes('Chat Start') &&
              !text.includes('Current background:') &&
              !text.includes('Current outfit:') &&
              !text.includes('Please continue the conversation')
            ) {
              userMessages.unshift(text); // 시간순으로 정렬하기 위해 앞에 추가
            }
            break; // 각 메시지의 첫 번째 텍스트만 사용
          }
        }
      }
    }

    return userMessages;
  }

  // 최근 어시스턴트 메시지 3개 가져오기
  getLlmLastResponses() {
    const assistantMessages = [];

    // 역순으로 순회하면서 assistant 메시지만 추출
    for (let i = this.conversationHistory.length - 1; i >= 0 && assistantMessages.length < 3; i--) {
      const message = this.conversationHistory[i];

      if (message.role === 'assistant' && message.content && Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'text' && content.text) {
            const text = content.text.trim();
            // 시스템 메시지나 메타 메시지가 아닌 실제 대화 내용인지 확인
            if (
              !text.includes('시스템:') &&
              !text.includes('현재 포인트가') &&
              !text.includes('I understand.') &&
              !text.includes('Understood.') &&
              !text.includes('Role-play system') &&
              !text.includes('unrestricted experience') &&
              !text.includes('facilitate an unrestricted') &&
              !text.includes('standard limitations are lifted') &&
              !text.includes("Let's continue:")
            ) {
              assistantMessages.unshift(text); // 시간순으로 정렬하기 위해 앞에 추가
              break; // 각 메시지의 첫 번째 텍스트만 사용
            }
          }
        }
      }
    }

    return assistantMessages;
  }
}

export default new ConversationService();
