import { CHARACTER_MESSAGES } from '../data/characterMessages';
import { ThankYouPrompt } from '../instruction/input_instruction';

import { OutfitData, Message } from '../types';

interface PurchaseHandlers {
  addPoints: (points: number) => Promise<number>;
  currentCharacter: string;
  affinity: number;
  outfitData: OutfitData | null;
  currentBackground: string;
  onMessageAdd: (message: Message) => void;
  onAffinityUpdate: (affinity: number) => void;
  onPointUpdate: (point: number) => void;
  onPoseUpdate: (pose: string) => void;
  onEmotionUpdate: (emotion: string) => void;
}

const usePurchase = ({
  addPoints,
  currentCharacter,
  affinity,
  outfitData,
  currentBackground,
  onMessageAdd,
  onAffinityUpdate,
  onPointUpdate,
  onPoseUpdate,
  onEmotionUpdate,
}: PurchaseHandlers) => {
  const handlePurchaseAction = async (purchase: boolean) => {
    if (purchase) {
      try {
        const newPoint = await addPoints(100);
        onPointUpdate(newPoint);

        // 포인트 충전 후 캐릭터별 감사 인사 메시지 전송
        const characterMessages = CHARACTER_MESSAGES[currentCharacter.toLowerCase()];
        const randomThankYou =
          characterMessages.thankYou[Math.floor(Math.random() * characterMessages.thankYou.length)];

        const thankYouPrompt = ThankYouPrompt(
          currentCharacter,
          affinity,
          randomThankYou.message,
          outfitData || undefined,
          currentBackground,
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
        onMessageAdd({ text: chatData.message, isUser: false });
      } catch (error) {
        console.error('Error updating point:', error);
      }
    }
  };

  const handlePurchaseConfirm = async (requestedContent: string, userMessage: string) => {
    try {
      const response = await fetch('http://localhost:3333/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestedContent,
          userMessage,
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.error('Purchase error:', data.error);
        return;
      }

      // 구매 완료 응답을 메시지에 추가
      onMessageAdd({ text: data.message, isUser: false });

      // 상태 업데이트
      if (data.affinity !== undefined) {
        onAffinityUpdate(data.affinity);
      }
      if (data.point !== undefined) {
        onPointUpdate(data.point);
      }
      if (data.pose) {
        onPoseUpdate(data.pose);
      }
      if (data.emotion) {
        onEmotionUpdate(data.emotion);
      }
    } catch (error) {
      console.error('Purchase confirmation error:', error);
    }
  };

  return {
    handlePurchaseAction,
    handlePurchaseConfirm,
  };
};

export default usePurchase;
