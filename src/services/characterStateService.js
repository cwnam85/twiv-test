import fs from 'fs';
import path from 'path';

class CharacterStateService {
  constructor() {
    this.statePath = path.join(process.cwd(), 'src', 'data', 'character_state.json');
    this.ensureStateFile();
  }

  // 상태 파일이 없으면 기본 구조로 생성
  ensureStateFile() {
    if (!fs.existsSync(this.statePath)) {
      const defaultState = {
        shaki: {
          current_outfit: 'casual',
          current_background: 'default',
          // 새로운 구조: 직접 아이템으로 접근
          bra: true,
          top: true,
          outerwear: true,
          panty: true,
          bottom: true,
          shoes: true,
          hat: false,
          necklace: true,
          belt: true,
        },
        blacknila: {
          current_outfit: 'casual',
          current_background: 'default',
          // 새로운 구조: 직접 아이템으로 접근
          bra: true,
          top: true,
          outerwear: true,
          panty: true,
          bottom: false,
          shoes: true,
          hat: false,
          necklace: true,
          belt: true,
        },
      };
      this.saveState(defaultState);
    }
  }

  // 전체 상태 데이터 로드
  getState() {
    try {
      if (fs.existsSync(this.statePath)) {
        return JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading character state:', error);
    }
    return {};
  }

  // 특정 캐릭터의 상태 로드
  getCharacterState(character) {
    const state = this.getState();
    return state[character] || null;
  }

  // 특정 캐릭터의 현재 복장
  getCurrentOutfit(character) {
    const characterState = this.getCharacterState(character);
    return characterState ? characterState.current_outfit : 'casual';
  }

  // 특정 캐릭터의 현재 배경
  getCurrentBackground(character) {
    const characterState = this.getCharacterState(character);
    return characterState ? characterState.current_background : 'default';
  }

  // 특정 캐릭터의 복장 파트 상태
  getOutfitParts(character) {
    const characterState = this.getCharacterState(character);
    if (!characterState) return null;

    return {
      upper_body: characterState.upper_body || {},
      lower_body: characterState.lower_body || {},
      feet: characterState.feet || {},
      accessories: characterState.accessories || {},
    };
  }

  // 상태 저장
  saveState(state) {
    try {
      fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving character state:', error);
      return false;
    }
  }

  // 특정 캐릭터의 복장 변경
  setCurrentOutfit(character, outfitName) {
    const state = this.getState();

    if (!state[character]) {
      state[character] = {
        current_outfit: 'casual',
        current_background: 'default',
        // 새로운 구조: 직접 아이템으로 접근
        bra: true,
        top: true,
        outerwear: true,
        panty: true,
        bottom: true,
        shoes: true,
        hat: false,
        necklace: true,
        belt: true,
      };
    }

    state[character].current_outfit = outfitName;
    return this.saveState(state);
  }

  // 특정 캐릭터의 배경 변경
  setCurrentBackground(character, backgroundName) {
    const state = this.getState();

    if (!state[character]) {
      state[character] = {
        current_outfit: 'casual',
        current_background: 'default',
        // 새로운 구조: 직접 아이템으로 접근
        bra: true,
        top: true,
        outerwear: true,
        panty: true,
        bottom: true,
        shoes: true,
        hat: false,
        necklace: true,
        belt: true,
      };
    }

    state[character].current_background = backgroundName;
    return this.saveState(state);
  }

  // 특정 캐릭터의 복장 파트 상태 변경
  setOutfitPart(character, parentCategory, category, enabled) {
    const state = this.getState();

    if (!state[character]) {
      state[character] = {
        current_outfit: 'casual',
        current_background: 'default',
        // 새로운 구조: 직접 아이템으로 접근
        bra: true,
        top: true,
        outerwear: true,
        panty: true,
        bottom: true,
        shoes: true,
        hat: false,
        necklace: true,
        belt: true,
      };
    }

    // 새로운 구조: parentCategory와 category가 같은 경우 (직접 아이템)
    if (parentCategory === category) {
      state[character][category] = enabled;
    } else {
      // 기존 구조: 중간 카테고리가 있는 경우
      if (!state[character][parentCategory]) {
        state[character][parentCategory] = {};
      }
      state[character][parentCategory][category] = enabled;
    }

    return this.saveState(state);
  }

  // 모든 캐릭터의 현재 상태 반환 (기존 shopService 호환성)
  getAllCurrentStates() {
    const state = this.getState();
    const result = {};

    Object.keys(state).forEach((character) => {
      result[character] = {
        currentOutfit: state[character].current_outfit,
        currentBackground: state[character].current_background,
      };
    });

    return result;
  }

  // 기본 캐릭터의 현재 상태 반환 (기존 호환성)
  getDefaultCurrentState() {
    const state = this.getState();
    const defaultCharacter = Object.keys(state)[0] || 'shaki';

    return {
      currentOutfit: state[defaultCharacter]?.current_outfit || 'casual',
      currentBackground: state[defaultCharacter]?.current_background || 'default',
    };
  }
}

export default new CharacterStateService();
