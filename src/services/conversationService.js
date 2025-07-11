import {
  SFW_INITIAL_CONVERSATION_HISTORY,
  SHAKI_JAILBREAK_HISTORY,
  MIWOO_JAILBREAK_HISTORY,
  DIA_JAILBREAK_HISTORY,
  HARIO_JAILBREAK_HISTORY,
} from '../data/initialConversation.js';
import characterService from './characterService.js';
import affinityService from './affinityService.js';
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
    const currentBackground =
      shopData && shopData.currentBackground
        ? this.getBackgroundName(shopData.currentBackground)
        : 'Default Background';
    const currentOutfit =
      shopData && shopData.currentOutfit
        ? this.getOutfitName(shopData.currentOutfit)
        : 'Default Outfit';

    // 보유한 아이템들 정보 가져오기
    const ownedBackgrounds =
      shopData && shopData.ownedBackgrounds
        ? shopData.ownedBackgrounds.map((item) => this.getBackgroundName(item))
        : ['Default Background'];
    const ownedOutfits =
      shopData && shopData.ownedOutfits
        ? shopData.ownedOutfits.map((item) => this.getOutfitName(item))
        : ['Default Outfit'];

    // 현재 affinity 값 가져오기
    const { affinity } = affinityService.getData();

    // 템플릿 컨텍스트
    const templateContext = {
      currentBackground: currentBackground,
      currentOutfit: currentOutfit,
      affinity: affinity,
      ownedBackgrounds: ownedBackgrounds.join(', '),
      ownedOutfits: ownedOutfits.join(', '),
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

  // 배경 이름 가져오기
  getBackgroundName(backgroundId) {
    const backgroundNames = {
      default: 'Default Background',
      school: 'School',
      beach: 'Beach',
    };
    return backgroundNames[backgroundId] || backgroundId;
  }

  // 복장 이름 가져오기
  getOutfitName(outfitId) {
    const outfitNames = {
      default: 'Default Outfit',
      casual: 'Casual',
      school_uniform: 'School Uniform',
      swimsuit: 'Swimsuit',
    };
    return outfitNames[outfitId] || outfitId;
  }
}

export default new ConversationService();
