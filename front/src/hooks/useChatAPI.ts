import { AppearanceData, Message } from '../types';

interface AudioSegment {
  type: 'text' | 'tag';
  content: string;
  audioUrl?: string;
  index: number;
}

interface AudioData {
  dialogue: string;
  emotion: string;
  segments: AudioSegment[];
  infiniteTag?: string;
  matureTags: string[];
}

interface ChatAPIHandlers {
  onMessageAdd: (message: Message) => void;
  onAffinityUpdate: (affinity: number) => void;
  onPointUpdate: (point: number) => void;
  onPoseUpdate: (pose: string) => void;
  onEmotionUpdate: (emotion: string) => void;
  onActionUpdate: (action: string) => void;
  onAppearanceRefresh: () => Promise<AppearanceData | null>;
  onModalOpen: () => void;
  onPurchaseModalOpen: (content: string, userInput: string) => void;
  onAudioData: (audioData: AudioData | null) => void;
  onLocationUpdate?: (location: string | null) => void; // RP팩 위치 업데이트
  onLoadingChange?: (isLoading: boolean) => void;
}

const useChatAPI = ({
  onMessageAdd,
  onAffinityUpdate,
  onPointUpdate,
  onPoseUpdate,
  onEmotionUpdate,
  onActionUpdate,
  onAppearanceRefresh,
  onModalOpen,
  onPurchaseModalOpen,
  onAudioData,
  onLocationUpdate,
  onLoadingChange,
}: ChatAPIHandlers) => {
  const sendMessage = async (userInput: string) => {
    try {
      // 로딩 시작
      onLoadingChange?.(true);
      // 백엔드 API 호출 (템플릿은 백엔드에서 처리)
      const response: Response = await fetch('http://localhost:3333/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userInput,
          history: userInput,
        }),
      });

      const data = await response.json();
      console.log('=== SERVER RESPONSE ===');
      console.log('Full server response:', data);
      console.log('Response keys:', Object.keys(data));

      // outfitToWear/outfitToRemove 처리 (배열 형태 지원)
      if (
        (Array.isArray(data.outfitToWear) && data.outfitToWear.length > 0) ||
        (Array.isArray(data.outfitToRemove) && data.outfitToRemove.length > 0)
      ) {
        // 외모 변경이 발생했으면 최신 외모 데이터를 다시 받아오기
        const newAppearanceData = await onAppearanceRefresh();
        if (newAppearanceData) {
          console.log('Updated appearance data from API:', newAppearanceData);

          // 외모 변경 알림 메시지 추가 (선택사항)
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

          if (Array.isArray(data.outfitToRemove)) {
            for (const category of data.outfitToRemove) {
              const categoryText = categoryMap[category] || category;
              console.log(`외모 변경: ${categoryText}를 벗었어요`);
            }
          }
          if (Array.isArray(data.outfitToWear)) {
            for (const category of data.outfitToWear) {
              const categoryText = categoryMap[category] || category;
              console.log(`외모 변경: ${categoryText}를 입었어요`);
            }
          }
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

      // 벨라의 응답 추가 (narration과 inner_thoughts 포함)
      console.log('📨 Adding message to UI:');
      console.log('  - message:', data.message);
      console.log('  - narration:', data.narration);
      console.log('  - inner_thoughts:', data.inner_thoughts);
      
      onMessageAdd({ 
        text: data.message, 
        narration: data.narration,
        inner_thoughts: data.inner_thoughts,
        isUser: false 
      });

      // 호감도 값 업데이트
      if (data.affinity !== undefined) {
        onAffinityUpdate(data.affinity);
      }
      // 포인트 업데이트
      if (data.point !== undefined) {
        onPointUpdate(data.point);
      }
      // pose, emotion, action 업데이트
      if (data.pose) {
        onPoseUpdate(data.pose);
      }
      if (data.emotion) {
        onEmotionUpdate(data.emotion);
      }
      if (data.action) {
        onActionUpdate(data.action);
      }

      // 오디오 데이터 처리
      if (data.audioData) {
        onAudioData(data.audioData);
      }

      // RP팩 위치 업데이트 (RP팩이 활성화된 경우에만)
      if (data.spot && onLocationUpdate) {
        onLocationUpdate(data.spot);
      }
    } catch (error) {
      console.error('Error:', error);
      // 에러 발생시 에러 메시지 표시
      onMessageAdd({ text: '죄송합니다. 오류가 발생했습니다.', isUser: false });
    } finally {
      // 로딩 종료
      onLoadingChange?.(false);
    }
  };

  return {
    sendMessage,
  };
};

export default useChatAPI;
