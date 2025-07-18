import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nunjucks from 'nunjucks';
import dotenv from 'dotenv';
import { JAILBREAK_CHARACTERS } from '../../vtuber_prompts/character_settings.js';
import { CHARACTER_SETTINGS } from '../../vtuber_prompts/character_settings.js';
import SectionLoader from '../../vtuber_prompts/section-loader.js';
import affinityService from './affinityService.js';

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
    if (this._initialOutfit === null) {
      this._initialOutfit = this.getInitialOutfit();
    }
    return this._initialOutfit;
  }

  get initialOutfitData() {
    if (this._initialOutfitData === null) {
      this._initialOutfitData = this.loadOutfitData();
    }
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
    // 상점 데이터에서 복장 정보를 우선으로 가져오기
    try {
      const shopDataPath = path.join(process.cwd(), 'src', 'data', 'shop_data.json');
      if (fs.existsSync(shopDataPath)) {
        const shopData = JSON.parse(fs.readFileSync(shopDataPath, 'utf8'));
        if (shopData.currentOutfit) {
          return shopData.currentOutfit;
        }
      }
    } catch (error) {
      console.error('Error reading shop data for initial outfit:', error);
    }

    // 상점 데이터가 없으면 기본값 사용
    return 'casual';
  }

  loadOutfitData() {
    try {
      // 의상 템플릿 로드
      const outfitPath = path.join(
        __dirname,
        `../../vtuber_prompts/characters/${this.activeCharacter}/outfits.json`,
      );

      // 현재 착용 상태 로드
      const statePath = path.join(process.cwd(), 'src', 'data', 'current_outfit_state.json');

      if (fs.existsSync(outfitPath) && fs.existsSync(statePath)) {
        const allOutfits = JSON.parse(fs.readFileSync(outfitPath, 'utf8'));
        const outfitState = JSON.parse(fs.readFileSync(statePath, 'utf8'));

        const outfitTemplate = allOutfits[this.initialOutfit];
        if (!outfitTemplate) {
          return null;
        }

        // 템플릿과 상태를 병합하여 완전한 의상 데이터 생성
        const currentOutfit = JSON.parse(JSON.stringify(outfitTemplate));
        currentOutfit.current_outfit = this.initialOutfit;

        // enabled 상태 적용
        const characterState = outfitState[this.activeCharacter];
        if (characterState) {
          Object.keys(characterState).forEach((parentCategory) => {
            if (parentCategory !== 'current_outfit' && currentOutfit.parts[parentCategory]) {
              Object.keys(characterState[parentCategory]).forEach((category) => {
                if (currentOutfit.parts[parentCategory][category]) {
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
          console.log(
            `Loaded ${isNSFW ? 'NSFW' : 'SFW'} prompt for ${this.activeCharacter} (Affinity: ${affinity}, Outfit: ${outfitData?.current_outfit || this.initialOutfit})`,
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

    // 현재 착용 상태 파일 로드
    const statePath = path.join(process.cwd(), 'src', 'data', 'current_outfit_state.json');
    if (!fs.existsSync(statePath)) {
      throw new Error('Outfit state file not found');
    }

    const outfitState = JSON.parse(fs.readFileSync(statePath, 'utf8'));

    // 해당 캐릭터의 상태가 없으면 초기화
    if (!outfitState[this.activeCharacter]) {
      outfitState[this.activeCharacter] = {
        current_outfit: this.initialOutfit,
        upper_body: { bra: true, top: true, outerwear: true },
        lower_body: { panty: true, bottom: true },
        feet: { shoes: true },
        accessories: { hat: false, necklace: true, belt: true },
      };
    }

    // 해당 카테고리의 상태 변경
    if (
      outfitState[this.activeCharacter][parentCategory] &&
      outfitState[this.activeCharacter][parentCategory][category] !== undefined
    ) {
      if (action === 'remove') {
        outfitState[this.activeCharacter][parentCategory][category] = false;
      } else if (action === 'wear') {
        outfitState[this.activeCharacter][parentCategory][category] = true;
      }
    }

    // 상태 파일 업데이트
    fs.writeFileSync(statePath, JSON.stringify(outfitState, null, 2));

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
      `../../vtuber_prompts/characters/${this.activeCharacter}/outfits.json`,
    );

    if (!fs.existsSync(outfitPath)) {
      throw new Error('Outfit file not found');
    }

    const allOutfits = JSON.parse(fs.readFileSync(outfitPath, 'utf8'));

    if (!allOutfits[outfitName]) {
      throw new Error(`Outfit '${outfitName}' not found`);
    }

    // 현재 착용 상태 파일 업데이트
    const statePath = path.join(process.cwd(), 'src', 'data', 'current_outfit_state.json');
    if (fs.existsSync(statePath)) {
      const outfitState = JSON.parse(fs.readFileSync(statePath, 'utf8'));

      // 해당 캐릭터의 상태가 없으면 초기화
      if (!outfitState[this.activeCharacter]) {
        outfitState[this.activeCharacter] = {};
      }

      // 의상 변경 시 해당 의상의 기본 착용 상태로 초기화
      outfitState[this.activeCharacter].current_outfit = outfitName;

      // 새로운 의상의 기본 착용 상태 생성
      const newOutfit = allOutfits[outfitName];
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
            defaultState[category][itemName] = true;
          }
        });
      });

      // 기존 상태를 새로운 기본 상태로 교체
      outfitState[this.activeCharacter] = {
        current_outfit: outfitName,
        ...defaultState,
      };

      fs.writeFileSync(statePath, JSON.stringify(outfitState, null, 2));
    }

    // 현재 복장을 새로운 복장으로 변경
    this._initialOutfit = outfitName;
    this._initialOutfitData = this.loadOutfitData();

    console.log(`Outfit changed to: ${outfitName} for ${this.activeCharacter}`);

    return this._initialOutfitData;
  }

  // 상점 복장 정보와 서버 복장을 동기화하는 메서드
  syncWithShopOutfit() {
    try {
      const shopDataPath = path.join(process.cwd(), 'src', 'data', 'shop_data.json');

      if (fs.existsSync(shopDataPath)) {
        const shopData = JSON.parse(fs.readFileSync(shopDataPath, 'utf8'));
        const currentShopOutfit = shopData.currentOutfit || 'casual';

        // 상점에서 착용 중인 복장이 있으면 항상 동기화
        if (currentShopOutfit && currentShopOutfit !== this.initialOutfit) {
          console.log(`Syncing server outfit with shop outfit: ${currentShopOutfit}`);
          this.changeToOutfit(currentShopOutfit);
          return true;
        }
      }
    } catch (error) {
      console.error('Error syncing with shop outfit:', error);
    }
    return false;
  }

  getActiveCharacter() {
    return this.activeCharacter;
  }

  getOutfitData() {
    return {
      outfitName: this.initialOutfit,
      outfitData: this.initialOutfitData,
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
