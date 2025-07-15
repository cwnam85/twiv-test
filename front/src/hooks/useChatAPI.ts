import { generateChatPrompt } from '../instruction/templateRenderer';
import { OutfitData, Message } from '../types';

interface ChatAPIHandlers {
  currentCharacter: string;
  affinity: number;
  outfitData: OutfitData | null;
  currentBackground: string;
  onMessageAdd: (message: Message) => void;
  onAffinityUpdate: (affinity: number) => void;
  onPointUpdate: (point: number) => void;
  onPoseUpdate: (pose: string) => void;
  onEmotionUpdate: (emotion: string) => void;
  onOutfitRefresh: () => Promise<OutfitData | null>;
  onModalOpen: () => void;
  onPurchaseModalOpen: (content: string, userInput: string) => void;
}

const useChatAPI = ({
  currentCharacter,
  affinity,
  outfitData,
  currentBackground,
  onMessageAdd,
  onAffinityUpdate,
  onPointUpdate,
  onPoseUpdate,
  onEmotionUpdate,
  onOutfitRefresh,
  onModalOpen,
  onPurchaseModalOpen,
}: ChatAPIHandlers) => {
  const sendMessage = async (userInput: string) => {
    try {
      // 백엔드 API 호출
      const chatPrompt = await generateChatPrompt(
        currentCharacter,
        affinity,
        userInput,
        outfitData || undefined,
        currentBackground,
      );

      const response: Response = await fetch('http://localhost:3333/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: chatPrompt,
          history: userInput,
        }),
      });

      const data = await response.json();

      // outfitChange 처리
      if (data.outfitChange && data.outfitChange.action && data.outfitChange.category) {
        console.log('Processing outfit change:', data.outfitChange);

        // 복장 변경이 발생했으면 최신 복장 데이터를 다시 받아오기
        const newOutfitData = await onOutfitRefresh();
        if (newOutfitData) {
          console.log('Updated outfit data from API:', newOutfitData);

          // 복장 변경 알림 메시지 추가 (선택사항)
          const actionText = data.outfitChange.action === 'remove' ? '벗었어요' : '입었어요';
          const categoryMap: { [key: string]: string } = {
            bra: '브라',
            panty: '팬티',
            top: '상의',
            outerwear: '겉옷',
            bottom: '하의',
            shoes: '신발',
            hat: '모자',
            necklace: '목걸이',
            belt: '벨트',
          };
          const categoryText =
            categoryMap[data.outfitChange.category] || data.outfitChange.category;

          console.log(`복장 변경: ${categoryText}를 ${actionText}`);
        }
      }

      // 포인트 부족 플래그를 확인하여 모달 표시
      if (data.isPointDepleted) {
        onModalOpen();
      }

      // 구매 필요 플래그를 확인하여 구매 모달 표시
      if (data.purchaseRequired && data.requestedContent) {
        onPurchaseModalOpen(data.requestedContent, userInput);
      }

      // 벨라의 응답 추가
      onMessageAdd({ text: data.message, isUser: false });

      // 호감도 값 업데이트
      if (data.affinity !== undefined) {
        onAffinityUpdate(data.affinity);
      }
      // 포인트 업데이트
      if (data.point !== undefined) {
        onPointUpdate(data.point);
      }
      // pose와 emotion 업데이트
      if (data.pose) {
        onPoseUpdate(data.pose);
      }
      if (data.emotion) {
        onEmotionUpdate(data.emotion);
      }
    } catch (error) {
      console.error('Error:', error);
      // 에러 발생시 에러 메시지 표시
      onMessageAdd({ text: '죄송합니다. 오류가 발생했습니다.', isUser: false });
    }
  };

  return {
    sendMessage,
  };
};

export default useChatAPI;
