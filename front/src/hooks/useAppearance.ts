import { useState, useEffect } from 'react';
import { AppearanceData, AppearanceStateData, CharacterAppearanceState } from '../types';

const useAppearance = () => {
  const [appearance, setAppearance] = useState<AppearanceData | null>(null);
  const [appearanceStateData, setAppearanceStateData] = useState<AppearanceStateData | null>(null);
  const [currentCharacter, setCurrentCharacter] = useState<string>('shaki');

  useEffect(() => {
    const fetchCharacterData = async () => {
      try {
        // 활성 캐릭터 정보 가져오기
        const characterResponse = await fetch('http://localhost:3333/character-info');
        const characterData = await characterResponse.json();
        setCurrentCharacter(characterData.activeCharacter || 'shaki');
      } catch (error) {
        console.error('Error fetching character data:', error);
      }
    };

    fetchCharacterData();
  }, []);

  useEffect(() => {
    const fetchAppearanceData = async () => {
      try {
        // 기존 외모 데이터 (템플릿 + 상태 병합된 데이터)
        const appearanceResponse = await fetch('http://localhost:3333/current-appearance');
        if (appearanceResponse.ok) {
          const appearanceData = await appearanceResponse.json();
          if (appearanceData.appearanceData) {
            setAppearance(appearanceData);
          }
        }

        // 새로운 의상 상태 데이터 (캐릭터별 상태)
        const stateResponse = await fetch('http://localhost:3333/appearance-state');
        if (stateResponse.ok) {
          const stateData = await stateResponse.json();
          setAppearanceStateData(stateData);
        }
      } catch (error) {
        console.error('Error fetching appearance data:', error);
      }
    };

    fetchAppearanceData();
  }, [currentCharacter]);

  const updateAppearanceData = (newAppearanceData: AppearanceData) => {
    setAppearance(newAppearanceData);
  };

  const updateAppearanceStateData = (newStateData: AppearanceStateData) => {
    setAppearanceStateData(newStateData);
  };

  const refreshAppearanceData = async () => {
    try {
      let newAppearanceData = null;

      // 기존 외모 데이터 새로고침
      const currentAppearanceResponse = await fetch('http://localhost:3333/current-appearance');
      if (currentAppearanceResponse.ok) {
        newAppearanceData = await currentAppearanceResponse.json();
        if (newAppearanceData.appearanceData) {
          setAppearance(newAppearanceData);
        }
      }

      // 새로운 의상 상태 데이터 새로고침
      const stateResponse = await fetch('http://localhost:3333/appearance-state');
      if (stateResponse.ok) {
        const newStateData = await stateResponse.json();
        setAppearanceStateData(newStateData);
        return { appearanceData: newAppearanceData, stateData: newStateData };
      }

      return { appearanceData: newAppearanceData, stateData: null };
    } catch (error) {
      console.error('Error fetching updated appearance data:', error);
    }
    return null;
  };

  // 현재 캐릭터의 의상 상태 가져오기
  const getCurrentCharacterState = (): CharacterAppearanceState | null => {
    if (!appearanceStateData || !currentCharacter) return null;
    return appearanceStateData[currentCharacter] || null;
  };

  // 특정 카테고리의 착용 상태 확인
  const isItemWorn = (category: string): boolean => {
    const characterState = getCurrentCharacterState();
    if (!characterState) return false;

    // 새로운 구조: 직접 아이템에 접근
    return (characterState as Record<string, boolean>)[category] || false;
  };

  return {
    appearance,
    appearanceStateData,
    currentCharacter,
    updateAppearanceData,
    updateAppearanceStateData,
    refreshAppearanceData,
    getCurrentCharacterState,
    isItemWorn,
  };
};

export default useAppearance;
