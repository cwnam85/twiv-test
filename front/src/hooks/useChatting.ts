import { useState } from 'react';
import { purchaseRequest } from '../api/api';

const useChatting = () => {
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([]);
  const [input, setInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setInput('');
    if (input.trim()) {
      // 사용자 메시지 추가
      setMessages((prev) => [...prev, { text: input, isUser: true }]);

      try {
        // 백엔드 API 호출
        const response = await fetch('http://localhost:3333/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: input }),
        });

        const data = await response.json();

        if (data.isPaid) {
          setIsModalOpen(true);
        }
        // 벨라의 응답 추가
        setMessages((prev) => [...prev, { text: data.message, isUser: false }]);
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

  return { messages, input, setInput, isModalOpen, handleSend, handleConfirm, handleClose };
};
export default useChatting;
