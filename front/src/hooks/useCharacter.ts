import { useState, useEffect } from 'react';

const useCharacter = () => {
  const [currentCharacter, setCurrentCharacter] = useState('Default Character');
  const [pose, setPose] = useState('stand');
  const [emotion, setEmotion] = useState('Neutral');

  useEffect(() => {
    const fetchCharacterData = async () => {
      try {
        // 캐릭터 정보 가져오기
        const characterResponse = await fetch('/active-character');
        const characterData = await characterResponse.json();
        const character = characterData.activeCharacter || 'Default Character';
        setCurrentCharacter(character);

        // 캐릭터 설정 정보 가져오기
        const settingsResponse = await fetch('/character-settings');
        const settingsData = await settingsResponse.json();

        return settingsData[character]?.firstMessage;
      } catch (error) {
        console.error('Error fetching character data:', error);
        setCurrentCharacter('Default Character');
        return null;
      }
    };

    fetchCharacterData();
  }, []);

  const updatePose = (newPose: string) => {
    setPose(newPose);
  };

  const updateEmotion = (newEmotion: string) => {
    setEmotion(newEmotion);
  };

  return {
    currentCharacter,
    setCurrentCharacter,
    pose,
    emotion,
    updatePose,
    updateEmotion,
  };
};

export default useCharacter;
