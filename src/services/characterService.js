import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nunjucks from 'nunjucks';
import dotenv from 'dotenv';
import { JAILBREAK_CHARACTERS } from '../../vtuber_prompts/character_settings.js';
import { CHARACTER_SETTINGS } from '../../vtuber_prompts/character_settings.js';
import SectionLoader from '../../vtuber_prompts/section-loader.js';
import affinityService from './affinityService.js';
import characterStateService from './characterStateService.js';

// 환경 변수 로드
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CharacterService {
  constructor() {
    this._activeCharacter = null;
    this._initialAppearance = null;
    this._initialAppearanceData = null;
    this._systemPrompt = null;
  }

  get activeCharacter() {
    if (this._activeCharacter === null) {
      this._activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';
    }
    return this._activeCharacter;
  }

  get initialAppearance() {
    // 항상 최신 값을 읽도록 캐시 무효화
    this._initialAppearance = this.getInitialAppearance();
    return this._initialAppearance;
  }

  get initialAppearanceData() {
    // 항상 최신 값을 읽도록 캐시 무효화
    this._initialAppearanceData = this.loadAppearanceData();
    return this._initialAppearanceData;
  }

  get systemPrompt() {
    if (this._systemPrompt === null) {
      // 실제 affinity 값 사용
      this._systemPrompt = this.loadSystemPrompt();
    }
    return this._systemPrompt;
  }

  getInitialAppearance() {
    // character_state.json에서 복장 정보를 가져오기
    return characterStateService.getCurrentAppearance(this.activeCharacter);
  }

  loadAppearanceData() {
    try {
      // 의상 템플릿 로드
      const appearancePath = path.join(
        __dirname,
        `../../vtuber_prompts/characters/${this.activeCharacter}/appearance/${this.initialAppearance}.json`,
      );

      if (fs.existsSync(appearancePath)) {
        const appearanceTemplate = JSON.parse(fs.readFileSync(appearancePath, 'utf8'));

        if (!appearanceTemplate) {
          return null;
        }

        // 템플릿과 상태를 병합하여 완전한 의상 데이터 생성
        const currentAppearance = JSON.parse(JSON.stringify(appearanceTemplate));
        currentAppearance.current_appearance = this.initialAppearance;

        // character_state.json에서 착용 상태 가져오기
        const characterState = characterStateService.getCharacterState(this.activeCharacter);
        if (characterState) {
          Object.keys(characterState).forEach((parentCategory) => {
            if (
              parentCategory !== 'current_appearance' &&
              parentCategory !== 'current_background' &&
              currentAppearance.parts[parentCategory]
            ) {
              // 중간 카테고리가 있는 경우 (기존 구조 호환성)
              if (
                typeof currentAppearance.parts[parentCategory] === 'object' &&
                currentAppearance.parts[parentCategory] !== null &&
                !currentAppearance.parts[parentCategory].name
              ) {
                Object.keys(characterState[parentCategory]).forEach((category) => {
                  if (currentAppearance.parts[parentCategory][category]) {
                    // 착용 상태를 enabled 속성으로 추가
                    currentAppearance.parts[parentCategory][category].enabled =
                      characterState[parentCategory][category];
                  }
                });
              } else {
                // 새로운 구조: 직접 아이템에 접근
                if (currentAppearance.parts[parentCategory]) {
                  currentAppearance.parts[parentCategory].enabled = characterState[parentCategory];
                }
              }
            }
          });
        }

        return currentAppearance;
      }
    } catch (e) {
      console.error('outfit data 로드 오류:', e);
    }
    return null;
  }

  loadSystemPrompt(appearanceData = null, context = {}) {
    try {
      if (this.activeCharacter) {
        const { affinity } = affinityService.getData();
        const isNSFW = JAILBREAK_CHARACTERS.includes(this.activeCharacter) && affinity >= 80;
        const loader = new SectionLoader(this.activeCharacter);

        const prompt = loader.buildPrompt({
          isNSFW,
          currentAppearance: appearanceData || this.initialAppearanceData,
          affinity: affinity,
          user: 'user',
          userLastResponses: context.userLastResponses || [],
          llmLastResponses: context.llmLastResponses || [],
        });

        if (prompt) {
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

  // RP팩 활성화/비활성화 시 프롬프트 새로고침
  refreshPromptForRpPack() {
    try {
      // 현재 프롬프트를 새로 로드
      const newPrompt = this.loadSystemPrompt();
      if (newPrompt) {
        this.currentSystemPrompt = newPrompt;
      }
    } catch (error) {
      console.error('Error refreshing prompt for RP pack:', error);
    }
  }

  updateSystemPrompt(appearanceData = null) {
    this._systemPrompt = this.loadSystemPrompt(appearanceData);
    return this._systemPrompt;
  }

  changeAppearance(action, category) {
    if (!this.activeCharacter || !this.initialAppearanceData) {
      throw new Error('No active character or outfit data');
    }

    // 새로운 구조: 직접 아이템에 접근
    if (!this.initialAppearanceData.parts[category]) {
      throw new Error(`Unknown category: ${category}`);
    }

    // character_state.json에서 상태 변경
    const characterState = characterStateService.getCharacterState(this.activeCharacter);

    if (!characterState) {
      throw new Error('Character state not found');
    }

    // 해당 카테고리의 상태 변경
    const enabled = action === 'wear';
    characterStateService.setAppearancePart(this.activeCharacter, category, category, enabled);

    // 메모리상의 initialAppearanceData 업데이트
    this._initialAppearanceData = this.loadAppearanceData();

    console.log(`Appearance changed: ${action} ${category} for ${this.activeCharacter}`);

    return this._initialAppearanceData;
  }

  // 상점에서 복장 전체를 변경하는 메서드
  changeToAppearance(appearanceName) {
    if (!this.activeCharacter) {
      throw new Error('No active character');
    }

    const appearancePath = path.join(
      __dirname,
      `../../vtuber_prompts/characters/${this.activeCharacter}/appearance/${appearanceName}.json`,
    );

    if (!fs.existsSync(appearancePath)) {
      throw new Error(`Appearance file not found: ${appearancePath}`);
    }

    const appearanceData = JSON.parse(fs.readFileSync(appearancePath, 'utf8'));

    // character_state.json에서 복장 변경
    characterStateService.setCurrentAppearance(this.activeCharacter, appearanceName);

    // 새로운 의상의 기본 착용 상태 생성
    const newAppearance = appearanceData;

    // 각 아이템별로 null이 아닌 아이템들을 기본적으로 착용 상태로 설정
    Object.entries(newAppearance.parts).forEach(([itemName, item]) => {
      if (item !== null) {
        // null이 아닌 아이템은 기본적으로 착용 상태
        characterStateService.setAppearancePart(this.activeCharacter, itemName, itemName, true);
      }
    });

    // 현재 복장을 새로운 복장으로 변경
    this._initialAppearance = appearanceName;
    this._initialAppearanceData = this.loadAppearanceData();

    console.log(`Appearance changed to: ${appearanceName} for ${this.activeCharacter}`);

    return this._initialAppearanceData;
  }

  getActiveCharacter() {
    return this.activeCharacter;
  }

  getAppearanceData() {
    // 항상 최신 데이터를 로드
    const currentAppearanceData = this.loadAppearanceData();
    return {
      appearanceName: this.initialAppearance,
      appearanceData: currentAppearanceData,
    };
  }

  getSystemPrompt(context = {}) {
    // 실제 affinity 값으로 시스템 프롬프트를 로드
    return this.loadSystemPrompt(null, context);
  }

  isJailbreakCharacter() {
    return JAILBREAK_CHARACTERS.includes(this.activeCharacter);
  }

  getFirstMessage() {
    return CHARACTER_SETTINGS[this.activeCharacter]?.firstMessage;
  }

  renderJailbreakHistory(history, affinityLevel) {
    try {
      const env = nunjucks.configure({
        autoescape: false,
        trimBlocks: true,
        lstripBlocks: true,
      });

      return history.map((message) => {
        if (message.content && Array.isArray(message.content)) {
          const renderedContent = message.content.map((content) => {
            if (content.type === 'text' && content.text) {
              return {
                ...content,
                text: env.renderString(content.text, { affinity: affinityLevel }),
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
}

export default new CharacterService();
