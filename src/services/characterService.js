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
    this._initialOutfit = null;
    this._initialOutfitData = null;
    this._systemPrompt = null;
  }

  get activeCharacter() {
    if (this._activeCharacter === null) {
      this._activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';
    }
    return this._activeCharacter;
  }

  get initialOutfit() {
    // 항상 최신 값을 읽도록 캐시 무효화
    this._initialOutfit = this.getInitialOutfit();
    return this._initialOutfit;
  }

  get initialOutfitData() {
    // 항상 최신 값을 읽도록 캐시 무효화
    this._initialOutfitData = this.loadOutfitData();
    return this._initialOutfitData;
  }

  get systemPrompt() {
    if (this._systemPrompt === null) {
      // 실제 affinity 값 사용
      this._systemPrompt = this.loadSystemPrompt();
    }
    return this._systemPrompt;
  }

  getInitialOutfit() {
    // character_state.json에서 복장 정보를 가져오기
    return characterStateService.getCurrentOutfit(this.activeCharacter);
  }

  loadOutfitData() {
    try {
      // 의상 템플릿 로드
      const outfitPath = path.join(
        __dirname,
        `../../vtuber_prompts/characters/${this.activeCharacter}/outfits/${this.initialOutfit}.json`,
      );

      if (fs.existsSync(outfitPath)) {
        const outfitTemplate = JSON.parse(fs.readFileSync(outfitPath, 'utf8'));

        if (!outfitTemplate) {
          return null;
        }

        // 템플릿과 상태를 병합하여 완전한 의상 데이터 생성
        const currentOutfit = JSON.parse(JSON.stringify(outfitTemplate));
        currentOutfit.current_outfit = this.initialOutfit;

        // character_state.json에서 착용 상태 가져오기
        const characterState = characterStateService.getCharacterState(this.activeCharacter);
        if (characterState) {
          Object.keys(characterState).forEach((parentCategory) => {
            if (
              parentCategory !== 'current_outfit' &&
              parentCategory !== 'current_background' &&
              currentOutfit.parts[parentCategory]
            ) {
              Object.keys(characterState[parentCategory]).forEach((category) => {
                if (currentOutfit.parts[parentCategory][category]) {
                  // 착용 상태를 enabled 속성으로 추가
                  currentOutfit.parts[parentCategory][category].enabled =
                    characterState[parentCategory][category];
                }
              });
            }
          });
        }

        return currentOutfit;
      }
    } catch (e) {
      console.error('outfit data 로드 오류:', e);
    }
    return null;
  }

  loadSystemPrompt(outfitData = null) {
    try {
      if (this.activeCharacter) {
        const { affinity } = affinityService.getData();
        const isNSFW = JAILBREAK_CHARACTERS.includes(this.activeCharacter) && affinity >= 80;
        const loader = new SectionLoader(this.activeCharacter);

        const prompt = loader.buildPrompt({
          isNSFW,
          currentOutfit: outfitData || this.initialOutfitData,
          affinity: affinity,
          user: 'user',
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

  updateSystemPrompt(outfitData = null) {
    this._systemPrompt = this.loadSystemPrompt(outfitData);
    return this._systemPrompt;
  }

  changeOutfit(action, category) {
    if (!this.activeCharacter || !this.initialOutfitData) {
      throw new Error('No active character or outfit data');
    }

    // 카테고리 매핑: 최상위 카테고리와 하위 카테고리 매핑
    const categoryMapping = {
      bra: 'upper_body',
      panty: 'lower_body',
      top: 'upper_body',
      outerwear: 'upper_body',
      bottom: 'lower_body',
      shoes: 'feet',
      hat: 'accessories',
      necklace: 'accessories',
      belt: 'accessories',
    };

    const parentCategory = categoryMapping[category];
    if (!parentCategory) {
      throw new Error(`Unknown category: ${category}`);
    }

    // character_state.json에서 상태 변경
    const characterState = characterStateService.getCharacterState(this.activeCharacter);

    if (!characterState) {
      throw new Error('Character state not found');
    }

    // 해당 카테고리의 상태 변경
    if (characterState[parentCategory] && characterState[parentCategory][category] !== undefined) {
      const enabled = action === 'wear';
      characterStateService.setOutfitPart(this.activeCharacter, parentCategory, category, enabled);
    }

    // 메모리상의 initialOutfitData 업데이트
    this._initialOutfitData = this.loadOutfitData();

    console.log(`Outfit changed: ${action} ${category} for ${this.activeCharacter}`);

    return this._initialOutfitData;
  }

  // 상점에서 복장 전체를 변경하는 메서드
  changeToOutfit(outfitName) {
    if (!this.activeCharacter) {
      throw new Error('No active character');
    }

    const outfitPath = path.join(
      __dirname,
      `../../vtuber_prompts/characters/${this.activeCharacter}/outfits/${outfitName}.json`,
    );

    if (!fs.existsSync(outfitPath)) {
      throw new Error(`Outfit file not found: ${outfitPath}`);
    }

    const outfitData = JSON.parse(fs.readFileSync(outfitPath, 'utf8'));

    // character_state.json에서 복장 변경
    characterStateService.setCurrentOutfit(this.activeCharacter, outfitName);

    // 새로운 의상의 기본 착용 상태 생성
    const newOutfit = outfitData;
    const defaultState = {
      upper_body: {},
      lower_body: {},
      feet: {},
      accessories: {},
    };

    // 각 카테고리별로 null이 아닌 아이템들을 기본적으로 착용 상태로 설정
    Object.entries(newOutfit.parts).forEach(([category, items]) => {
      Object.entries(items).forEach(([itemName, item]) => {
        if (item !== null) {
          // null이 아닌 아이템은 기본적으로 착용 상태
          characterStateService.setOutfitPart(this.activeCharacter, category, itemName, true);
        }
      });
    });

    // 현재 복장을 새로운 복장으로 변경
    this._initialOutfit = outfitName;
    this._initialOutfitData = this.loadOutfitData();

    console.log(`Outfit changed to: ${outfitName} for ${this.activeCharacter}`);

    return this._initialOutfitData;
  }

  getActiveCharacter() {
    return this.activeCharacter;
  }

  getOutfitData() {
    // 항상 최신 데이터를 로드
    const currentOutfitData = this.loadOutfitData();
    return {
      outfitName: this.initialOutfit,
      outfitData: currentOutfitData,
    };
  }

  getSystemPrompt() {
    // 실제 affinity 값으로 시스템 프롬프트를 로드
    return this.loadSystemPrompt();
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
