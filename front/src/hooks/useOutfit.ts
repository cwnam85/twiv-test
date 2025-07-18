import { useState, useEffect } from 'react';
import { OutfitData, OutfitStateData, CharacterOutfitState } from '../types';

const useOutfit = () => {
  const [outfitData, setOutfitData] = useState<OutfitData | null>(null);
  const [outfitStateData, setOutfitStateData] = useState<OutfitStateData | null>(null);
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
    const fetchOutfitData = async () => {
      try {
        // 기존 의상 데이터 (템플릿 + 상태 병합된 데이터)
        const outfitResponse = await fetch('http://localhost:3333/current-outfit');
        const outfitData = await outfitResponse.json();
        if (outfitData.outfitData) {
          setOutfitData(outfitData);
        }

        // 새로운 의상 상태 데이터 (캐릭터별 상태)
        const stateResponse = await fetch('http://localhost:3333/outfit-state');
        if (stateResponse.ok) {
          const stateData = await stateResponse.json();
          setOutfitStateData(stateData);
        }
      } catch (error) {
        console.error('Error fetching outfit data:', error);
      }
    };

    fetchOutfitData();
  }, [currentCharacter]);

  const updateOutfitData = (newOutfitData: OutfitData) => {
    setOutfitData(newOutfitData);
  };

  const updateOutfitStateData = (newStateData: OutfitStateData) => {
    setOutfitStateData(newStateData);
  };

  const refreshOutfitData = async () => {
    try {
      let newOutfitData = null;

      // 기존 의상 데이터 새로고침
      const currentOutfitResponse = await fetch('http://localhost:3333/current-outfit');
      if (currentOutfitResponse.ok) {
        newOutfitData = await currentOutfitResponse.json();
        if (newOutfitData.outfitData) {
          setOutfitData(newOutfitData);
        }
      }

      // 새로운 의상 상태 데이터 새로고침
      const stateResponse = await fetch('http://localhost:3333/outfit-state');
      if (stateResponse.ok) {
        const newStateData = await stateResponse.json();
        setOutfitStateData(newStateData);
        return { outfitData: newOutfitData, stateData: newStateData };
      }

      return { outfitData: newOutfitData, stateData: null };
    } catch (error) {
      console.error('Error fetching updated outfit data:', error);
    }
    return null;
  };

  // 현재 캐릭터의 의상 상태 가져오기
  const getCurrentCharacterState = (): CharacterOutfitState | null => {
    if (!outfitStateData || !currentCharacter) return null;
    return outfitStateData[currentCharacter] || null;
  };

  // 특정 카테고리의 착용 상태 확인
  const isItemWorn = (category: string): boolean => {
    const characterState = getCurrentCharacterState();
    if (!characterState) return false;

    const parentCategory = getParentCategory(category);
    if (!parentCategory) return false;

    const categoryState = characterState[parentCategory as keyof CharacterOutfitState];
    if (!categoryState || typeof categoryState !== 'object') return false;

    return (categoryState as Record<string, boolean>)[category] || false;
  };

  // 카테고리 매핑 함수
  const getParentCategory = (category: string): string | null => {
    const categoryMapping: { [key: string]: string } = {
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
    return categoryMapping[category] || null;
  };

  return {
    outfitData,
    outfitStateData,
    currentCharacter,
    updateOutfitData,
    updateOutfitStateData,
    refreshOutfitData,
    getCurrentCharacterState,
    isItemWorn,
  };
};

export default useOutfit;
