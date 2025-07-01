import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nunjucks from 'nunjucks';
import dotenv from 'dotenv';
import { JAILBREAK_CHARACTERS } from '../../vtuber_prompts/character_settings.js';
import { CHARACTER_SETTINGS } from '../../vtuber_prompts/character_settings.js';
import SectionLoader from '../../vtuber_prompts/section-loader.js';

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
      this._systemPrompt = this.loadSystemPrompt();
    }
    return this._systemPrompt;
  }

  getInitialOutfit() {
    const outfitEnvKey = `${this.activeCharacter?.toUpperCase()}_OUTFIT`;
    return process.env[outfitEnvKey] || 'casual';
  }

  loadOutfitData() {
    try {
      const outfitPath = path.join(
        __dirname,
        `../../vtuber_prompts/characters/${this.activeCharacter}/outfits.json`,
      );
      if (fs.existsSync(outfitPath)) {
        const allOutfits = JSON.parse(fs.readFileSync(outfitPath, 'utf8'));
        return allOutfits[this.initialOutfit] || null;
      }
    } catch (e) {
      console.error('outfits.json 로드 오류:', e);
    }
    return null;
  }

  loadSystemPrompt(level = 1, outfitData = null) {
    try {
      if (this.activeCharacter) {
        const isNSFW = JAILBREAK_CHARACTERS.includes(this.activeCharacter) && level >= 2;
        const loader = new SectionLoader(this.activeCharacter);

        const prompt = loader.buildPrompt({
          isNSFW,
          currentOutfit: outfitData || this.initialOutfitData,
          affinityLevel: level,
          user: 'user',
        });

        if (prompt) {
          console.log(
            `Loaded ${isNSFW ? 'NSFW' : 'SFW'} prompt for ${this.activeCharacter} (Level: ${level}, Outfit: ${outfitData?.current_outfit || this.initialOutfit})`,
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

  updateSystemPrompt(level, outfitData = null) {
    this._systemPrompt = this.loadSystemPrompt(level, outfitData);
    return this._systemPrompt;
  }

  changeOutfit(action, category, item) {
    if (!this.activeCharacter || !this.initialOutfitData) {
      throw new Error('No active character or outfit data');
    }

    const outfitPath = path.join(
      __dirname,
      `../../vtuber_prompts/characters/${this.activeCharacter}/outfits.json`,
    );

    if (!fs.existsSync(outfitPath)) {
      throw new Error('Outfit file not found');
    }

    const allOutfits = JSON.parse(fs.readFileSync(outfitPath, 'utf8'));
    const currentOutfit = allOutfits[this.initialOutfit];

    if (!currentOutfit || !currentOutfit.parts[category] || !currentOutfit.parts[category][item]) {
      throw new Error('Item not found');
    }

    // 복장 상태 변경
    if (action === 'remove') {
      currentOutfit.parts[category][item].enabled = false;
    } else if (action === 'wear') {
      currentOutfit.parts[category][item].enabled = true;
    } else {
      throw new Error('Invalid action. Use "remove" or "wear"');
    }

    // outfits.json 파일 업데이트
    fs.writeFileSync(outfitPath, JSON.stringify(allOutfits, null, 2));

    // 메모리상의 initialOutfitData도 업데이트
    this._initialOutfitData = currentOutfit;

    console.log(`Outfit changed: ${action} ${category}.${item} for ${this.activeCharacter}`);

    return currentOutfit;
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
    return this.systemPrompt;
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
}

export default new CharacterService();
