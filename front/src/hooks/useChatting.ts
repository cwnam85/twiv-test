import { useState, useEffect } from 'react';
import { getChatPrompt, ThankYouPrompt } from '../instruction/input_instruction';
import { CHARACTER_MESSAGES } from '../data/characterMessages';

interface OutfitItem {
  name: string;
  enabled: boolean;
  type: string;
  layer_order: number;
  removable: {
    access: string;
    min_affinity: number | null;
  };
}

interface OutfitParts {
  [category: string]: {
    [itemName: string]: OutfitItem;
  };
}

interface OutfitData {
  outfitName: string;
  outfitData: {
    current_outfit: string;
    parts: OutfitParts;
  };
}

const useChatting = () => {
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([]);
  const [input, setInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseContent, setPurchaseContent] = useState('');
  const [originalUserInput, setOriginalUserInput] = useState('');
  const [affinity, setAffinity] = useState(0);
  const [point, setPoint] = useState(100);
  const [pose, setPose] = useState('stand');
  const [emotion, setEmotion] = useState('Neutral');
  const [currentCharacter, setCurrentCharacter] = useState('Default Character');
  const [outfitData, setOutfitData] = useState<OutfitData | null>(null);

  useEffect(() => {
    // 백엔드에서 activeCharacter와 affinity 정보 가져오기
    const fetchData = async () => {
      try {
        // 캐릭터 정보 가져오기
        const characterResponse = await fetch('/active-character');
        const characterData = await characterResponse.json();
        const character = characterData.activeCharacter || 'Default Character';
        setCurrentCharacter(character);

        // affinity 정보 가져오기
        const affinityResponse = await fetch('http://localhost:3333/affinity');
        const affinityData = await affinityResponse.json();
        if (affinityData.affinity !== undefined) {
          setAffinity(affinityData.affinity);
        }
        if (affinityData.point !== undefined) {
          setPoint(affinityData.point);
        }

        // 현재 복장 정보 가져오기
        const outfitResponse = await fetch('http://localhost:3333/current-outfit');
        const outfitData = await outfitResponse.json();
        if (outfitData.outfitData) {
          setOutfitData(outfitData);
        }

        // 캐릭터 설정 정보 가져오기
        const settingsResponse = await fetch('/character-settings');
        const settingsData = await settingsResponse.json();

        // 현재 캐릭터의 첫 메시지가 있다면 메시지 배열에 추가
        const firstMessage = settingsData[character]?.firstMessage;
        if (firstMessage) {
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              text: firstMessage,
              isUser: false,
            },
          ]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setCurrentCharacter('Default Character');
      }
    };

    fetchData();
  }, []);

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const currentInput = input.trim();
    setInput('');
    if (currentInput) {
      // 사용자 메시지 추가
      setMessages((prev) => [...prev, { text: currentInput, isUser: true }]);

      try {
        // 백엔드 API 호출
        const chatPrompt = getChatPrompt(
          currentCharacter,
          affinity,
          currentInput,
          outfitData || undefined,
        );
        const response: Response = await fetch('http://localhost:3333/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: chatPrompt,
            history: currentInput,
          }),
        });

        const data = await response.json();

        // outfitChange 처리
        if (
          data.outfitChange &&
          data.outfitChange.action &&
          data.outfitChange.category &&
          data.outfitChange.item
        ) {
          console.log('Processing outfit change:', data.outfitChange);

          // 백엔드에서 보내는 업데이트된 복장 데이터 사용
          if (data.updatedOutfitData) {
            setOutfitData(data.updatedOutfitData);
            console.log('Updated outfit data from response:', data.updatedOutfitData);
          } else {
            // 백업: 최신 outfitData 다시 받아오기
            try {
              const currentOutfitResponse = await fetch('http://localhost:3333/current-outfit');
              if (currentOutfitResponse.ok) {
                const newOutfitData = await currentOutfitResponse.json();
                if (newOutfitData.outfitData) {
                  setOutfitData(newOutfitData);
                  console.log('Updated outfit data from API:', newOutfitData);
                }
              }
            } catch (error) {
              console.error('Error fetching updated outfit data:', error);
            }
          }
        }

        // 포인트 부족 플래그를 확인하여 모달 표시
        if (data.isPointDepleted) {
          setIsModalOpen(true);
        }

        // 구매 필요 플래그를 확인하여 구매 모달 표시
        if (data.purchaseRequired && data.requestedContent) {
          setOriginalUserInput(currentInput);
          setIsPurchaseModalOpen(true);
          setPurchaseContent(data.requestedContent);
        }

        // 벨라의 응답 추가
        setMessages((prev) => [...prev, { text: data.message, isUser: false }]);

        // 호감도 값 업데이트
        if (data.affinity !== undefined) {
          setAffinity(data.affinity);
        }
        // 포인트 업데이트
        if (data.point !== undefined) {
          setPoint(data.point);
        }
        // pose와 emotion 업데이트
        if (data.pose) {
          setPose(data.pose);
        }
        if (data.emotion) {
          setEmotion(data.emotion);
        }
      } catch (error) {
        console.error('Error:', error);
        // 에러 발생시 에러 메시지 표시
        setMessages((prev) => [
          ...prev,
          { text: '죄송합니다. 오류가 발생했습니다.', isUser: false },
        ]);
      }
    }
  };

  const handlePurchaseAction = async (purchase: boolean) => {
    if (purchase) {
      try {
        const response = await fetch('http://localhost:3333/affinity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ point: point + 100 }),
        });
        const data = await response.json();
        setPoint(data.point);

        // 포인트 충전 후 캐릭터별 감사 인사 메시지 전송
        const characterMessages = CHARACTER_MESSAGES[currentCharacter.toLowerCase()];
        const randomThankYou =
          characterMessages.thankYou[Math.floor(Math.random() * characterMessages.thankYou.length)];

        const thankYouPrompt = ThankYouPrompt(
          currentCharacter,
          affinity,
          randomThankYou.message,
          outfitData || undefined,
        );
        const chatResponse = await fetch('http://localhost:3333/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: thankYouPrompt,
            history: `시스템 : 사용자가 포인트를 결제하였습니다. 사용자에게 감사하다는 인사를 자연스럽게 해주세요. 예시는 이렇습니다.\n예시 : ${randomThankYou.message}`,
          }),
        });
        const chatData = await chatResponse.json();
        setMessages((prev) => [...prev, { text: chatData.message, isUser: false }]);
      } catch (error) {
        console.error('Error updating point:', error);
      }
    }
    setIsModalOpen(false);
  };

  const handleConfirm = () => handlePurchaseAction(true);
  const handleClose = () => handlePurchaseAction(false);

  const handlePurchaseConfirm = async () => {
    try {
      // 구매 API 호출
      const response = await fetch('http://localhost:3333/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestedContent: purchaseContent,
          userMessage: originalUserInput,
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.error('Purchase error:', data.error);
        return;
      }

      // 구매 완료 응답을 메시지에 추가
      setMessages((prev) => [...prev, { text: data.message, isUser: false }]);

      // 상태 업데이트
      if (data.affinity !== undefined) {
        setAffinity(data.affinity);
      }
      if (data.point !== undefined) {
        setPoint(data.point);
      }
      if (data.pose) {
        setPose(data.pose);
      }
      if (data.emotion) {
        setEmotion(data.emotion);
      }

      // 구매 모달 닫기
      setIsPurchaseModalOpen(false);
      setPurchaseContent('');
      setOriginalUserInput('');
    } catch (error) {
      console.error('Purchase confirmation error:', error);
    }
  };

  const handlePurchaseClose = () => {
    setIsPurchaseModalOpen(false);
    setPurchaseContent('');
    setOriginalUserInput('');
  };

  return {
    messages,
    input,
    setInput,
    isModalOpen,
    isPurchaseModalOpen,
    purchaseContent,
    handleSend,
    handleConfirm,
    handleClose,
    handlePurchaseConfirm,
    handlePurchaseClose,
    affinity,
    point,
    pose,
    emotion,
    currentCharacter,
    outfitData,
  };
};
export default useChatting;
