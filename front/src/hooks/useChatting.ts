import { useState, useEffect } from 'react';
import { purchaseRequest } from '../api/api';
import { getChatPrompt } from '../template/nsfw_template';

const useChatting = () => {
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([]);
  const [input, setInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [affinity, setAffinity] = useState(0);
  const [level, setLevel] = useState(1);
  const [point, setPoint] = useState(100);
  const [pose, setPose] = useState('stand');
  const [emotion, setEmotion] = useState('Neutral');
  const [currentCharacter, setCurrentCharacter] = useState('Default Character');

  useEffect(() => {
    // 백엔드에서 activeCharacter와 affinity 정보 가져오기
    const fetchData = async () => {
      try {
        // 캐릭터 정보 가져오기
        const characterResponse = await fetch('/active-character');
        const characterData = await characterResponse.json();
        setCurrentCharacter(characterData.activeCharacter || 'Default Character');

        // affinity 정보 가져오기
        const affinityResponse = await fetch('http://localhost:3333/affinity');
        const affinityData = await affinityResponse.json();
        if (affinityData.affinity !== undefined) {
          setAffinity(affinityData.affinity);
        }
        if (affinityData.level !== undefined) {
          setLevel(affinityData.level);
        }
        if (affinityData.point !== undefined) {
          setPoint(affinityData.point);
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
    setInput('');
    if (input.trim()) {
      // 사용자 메시지 추가
      setMessages((prev) => [...prev, { text: input, isUser: true }]);

      try {
        // 백엔드 API 호출
        const response: Response = await fetch('http://localhost:3333/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: getChatPrompt(currentCharacter, level, input),
            history: input,
          }),
        });

        const data = await response.json();

        if (data.isPaid) {
          setIsModalOpen(true);
        }
        // 벨라의 응답 추가
        setMessages((prev) => [...prev, { text: data.message, isUser: false }]);

        // 호감도 값 업데이트
        if (data.affinity !== undefined) {
          setAffinity(data.affinity);
        }
        // 레벨 업데이트
        if (data.level !== undefined) {
          setLevel(data.level);
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
    const data = await purchaseRequest(purchase);
    setMessages((prev) => [...prev, { text: data.message, isUser: false }]);
    setIsModalOpen(false);
  };

  const handleConfirm = () => handlePurchaseAction(true);
  const handleClose = () => handlePurchaseAction(false);

  return {
    messages,
    input,
    setInput,
    isModalOpen,
    handleSend,
    handleConfirm,
    handleClose,
    affinity,
    level,
    point,
    pose,
    emotion,
    currentCharacter,
  };
};
export default useChatting;
