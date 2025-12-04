import fs from 'fs';
import path from 'path';

class CharacterStateService {
  constructor() {
    this.statePath = path.join(process.cwd(), 'src', 'data', 'character_state.json');
    this.ensureStateFile();
    this.resetAllSpots(); // 서버 시작 시 모든 캐릭터의 spot 초기화
  }

  // 서버 시작 시 모든 캐릭터의 current_spot을 null로 초기화
  resetAllSpots() {
    try {
      const state = this.getState();
      let changed = false;

      Object.keys(state).forEach((character) => {
        if (state[character].current_spot !== null && state[character].current_spot !== undefined) {
          state[character].current_spot = null;
          changed = true;
        }
      });

      if (changed) {
        this.saveState(state);
        console.log('📍 All character spots reset to null on server start');
      }
    } catch (error) {
      console.error('Error resetting spots:', error);
    }
  }

  // 상태 파일이 없으면 기본 구조로 생성
  ensureStateFile() {
    if (!fs.existsSync(this.statePath)) {
      const defaultState = {
        shaki: {
          current_appearance: 'casual',
          current_background: 'default',
          last_pose: 'stand',
          last_action: 'SpeakNatural',
          // 새로운 구조: 직접 아이템으로 접근
          hair: true,
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
          current_appearance: 'casual',
          current_background: 'default',
          last_pose: 'stand',
          last_action: 'SpeakNatural',
          // 새로운 구조: 직접 아이템으로 접근
          hair: true,
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
  getCurrentAppearance(character) {
    const characterState = this.getCharacterState(character);
    return characterState ? characterState.current_appearance : 'casual';
  }

  // 특정 캐릭터의 현재 배경
  getCurrentBackground(character) {
    const characterState = this.getCharacterState(character);
    return characterState ? characterState.current_background : 'default';
  }

  // 특정 캐릭터의 현재 spot
  getCurrentSpot(character) {
    const characterState = this.getCharacterState(character);
    return characterState ? characterState.current_spot : null;
  }

  // 특정 캐릭터의 마지막 포즈
  getLastPose(character) {
    const characterState = this.getCharacterState(character);
    return characterState ? characterState.last_pose : 'stand';
  }

  // 특정 캐릭터의 마지막 액션
  getLastAction(character) {
    const characterState = this.getCharacterState(character);
    return characterState ? characterState.last_action : 'SpeakNatural';
  }

  // 특정 캐릭터의 복장 파트 상태
  getAppearanceParts(character) {
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
  setCurrentAppearance(character, appearanceName) {
    const state = this.getState();

    if (!state[character]) {
      state[character] = {
        current_appearance: 'casual',
        current_background: 'default',
        last_pose: 'stand',
        last_action: 'SpeakNatural',
        // 새로운 구조: 직접 아이템으로 접근
        hair: true,
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

    state[character].current_appearance = appearanceName;
    return this.saveState(state);
  }

  // 특정 캐릭터의 배경 변경
  setCurrentBackground(character, backgroundName) {
    const state = this.getState();

    if (!state[character]) {
      state[character] = {
        current_appearance: 'casual',
        current_background: 'default',
        last_pose: 'stand',
        last_action: 'SpeakNatural',
        // 새로운 구조: 직접 아이템으로 접근
        hair: true,
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

  // 특정 캐릭터의 현재 spot 변경
  setCurrentSpot(character, spot) {
    const state = this.getState();

    if (!state[character]) {
      state[character] = {
        current_appearance: 'casual',
        current_background: 'default',
        current_spot: null,
        last_pose: 'stand',
        last_action: 'SpeakNatural',
        // 새로운 구조: 직접 아이템으로 접근
        hair: true,
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

    state[character].current_spot = spot || null;
    return this.saveState(state);
  }

  // 특정 캐릭터의 마지막 포즈 변경
  setLastPose(character, pose) {
    const state = this.getState();

    if (!state[character]) {
      state[character] = {
        current_appearance: 'casual',
        current_background: 'default',
        current_spot: null,
        last_pose: 'stand',
        last_action: 'SpeakNatural',
        // 새로운 구조: 직접 아이템으로 접근
        hair: true,
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

    state[character].last_pose = pose;
    return this.saveState(state);
  }

  // 특정 캐릭터의 마지막 액션 변경
  setLastAction(character, action) {
    const state = this.getState();

    if (!state[character]) {
      state[character] = {
        current_appearance: 'casual',
        current_background: 'default',
        last_pose: 'stand',
        last_action: 'SpeakNatural',
        // 새로운 구조: 직접 아이템으로 접근
        hair: true,
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

    state[character].last_action = action || '';
    return this.saveState(state);
  }

  // 특정 캐릭터의 복장 파트 상태 변경
  setAppearancePart(character, parentCategory, category, enabled) {
    const state = this.getState();

    if (!state[character]) {
      state[character] = {
        current_appearance: 'casual',
        current_background: 'default',
        last_pose: 'stand',
        last_action: 'SpeakNatural',
        // 새로운 구조: 직접 아이템으로 접근
        hair: true,
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
        currentAppearance: state[character].current_appearance,
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
      currentAppearance: state[defaultCharacter]?.current_appearance || 'casual',
      currentBackground: state[defaultCharacter]?.current_background || 'default',
    };
  }
}

export default new CharacterStateService();
