import { useState, useRef, useEffect } from 'react';
import useCharacter from './useCharacter';
import useAffinity from './useAffinity';
import useAppearance from './useAppearance';
import useMessages from './useMessages';
import useModal from './useModal';
import useChatAPI from './useChatAPI';
import usePurchase from './usePurchase';
import useShop from './useShop';
import { useAudioPlayer } from './useAudioPlayer';
import useAutoChat from './useAutoChat';

const useChatting = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);

  // 위치 업데이트 함수에 로그 추가
  const handleLocationUpdate = (location: string | null) => {
    console.log('handleLocationUpdate called with:', location);
    setCurrentLocation(location);
  };

  // 각각의 작은 훅들을 사용
  const { currentCharacter, pose, emotion, updatePose, updateEmotion } = useCharacter();

  const { affinity, point, maxAffinity, updateAffinity, updatePoint, addPoints } = useAffinity();

  const {
    appearance,
    appearanceStateData,
    currentCharacter: appearanceCharacter,
    refreshAppearanceData,
  } = useAppearance();

  const { messages, addUserMessage, addBotMessageFromMessage } = useMessages(currentCharacter);

  const {
    isModalOpen,
    isPurchaseModalOpen,
    purchaseContent,
    originalUserInput,
    openModal,
    openPurchaseModal,
    closePurchaseModal,
  } = useModal();

  // 오디오 플레이어 훅 (일단 콜백 없이)
  const { playAudioData, stopPlayback } = useAudioPlayer(currentCharacter);

  // 자동 대화 훅
  const { isAutoChatMode, startAutoChat, stopAutoChat, triggerAutoMessage } = useAutoChat();

  // 자동모드 상태를 ref로 추적 (클로저 문제 해결)
  const isAutoChatModeRef = useRef(isAutoChatMode);
  useEffect(() => {
    isAutoChatModeRef.current = isAutoChatMode;
    console.log('🔄 자동모드 ref 업데이트:', isAutoChatMode);
  }, [isAutoChatMode]);

  // Shop 훅 설정
  const {
    shopData,
    isShopOpen,
    currentBackground,
    currentAppearance,
    boosterStatus,
    activeRpPack,
    purchaseItem,
    useBooster,
    activateRpPack,
    deactivateRpPack,
    equipItem,
    equipItems,
    openShop,
    closeShop,
  } = useShop({
    onPointUpdate: updatePoint,
    onMessageAdd: (message: string) => addBotMessageFromMessage({ text: message, isUser: false }),
    refreshAppearanceData: async () => {
      const result = await refreshAppearanceData();
      return result?.appearanceData || null;
    },
    onAudioData: playAudioData,
    onLoadingChange: setIsLoading,
    onLocationUpdate: handleLocationUpdate,
  });

  // ChatAPI 훅 설정
  const { sendMessage } = useChatAPI({
    onMessageAdd: addBotMessageFromMessage,
    onAffinityUpdate: updateAffinity,
    onPointUpdate: updatePoint,
    onPoseUpdate: updatePose,
    onEmotionUpdate: updateEmotion,
    onAppearanceRefresh: async () => {
      const result = await refreshAppearanceData();
      return result?.appearanceData || null;
    },
    onModalOpen: openModal,
    onPurchaseModalOpen: openPurchaseModal,
    onAudioData: async (audioData: unknown) => {
      console.log('📢 TTS 재생 시작, 자동모드:', isAutoChatModeRef.current);
      await playAudioData(audioData as Parameters<typeof playAudioData>[0]);
      console.log('✅ TTS 재생 완료, 자동모드:', isAutoChatModeRef.current);

      // TTS 재생 완료 후 자동 대화 트리거
      if (isAutoChatModeRef.current) {
        console.log('🔄 TTS 완료, 2초 후 자동 메시지 전송');
        setTimeout(() => {
          console.log('⏰ 2초 타이머 완료, 자동모드:', isAutoChatModeRef.current);
          if (isAutoChatModeRef.current) {
            console.log('🚀 자동 메시지 트리거 호출');
            triggerAutoMessage(sendMessage);
          } else {
            console.log('❌ 자동모드가 비활성화되어 메시지 전송 취소');
          }
        }, 2000); // 2초 후 자동 메시지
      } else {
        console.log('⏹️ 자동모드 비활성화 상태로 자동 메시지 건너뜀');
      }
    },
    onLocationUpdate: handleLocationUpdate,
    onLoadingChange: setIsLoading,
  });

  // Purchase 훅 설정
  const { handlePurchaseAction, handlePurchaseConfirm: purchaseConfirm } = usePurchase({
    addPoints,
    currentCharacter,
    onMessageAdd: addBotMessageFromMessage,
    onAffinityUpdate: updateAffinity,
    onPointUpdate: updatePoint,
    onPoseUpdate: updatePose,
    onEmotionUpdate: updateEmotion,
  });

  // 메시지 전송 핸들러
  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const currentInput = input.trim();
    setInput('');

    if (currentInput) {
      // 사용자 메시지 추가
      addUserMessage(currentInput);

      // API 호출
      await sendMessage(currentInput);
    }
  };

  // 모달 핸들러들
  const handleConfirm = () => handlePurchaseAction(true);
  const handleClose = () => handlePurchaseAction(false);

  const handlePurchaseConfirm = async () => {
    await purchaseConfirm(purchaseContent, originalUserInput);
    closePurchaseModal();
  };

  const handlePurchaseClose = () => {
    closePurchaseModal();
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
    maxAffinity,
    pose,
    emotion,
    currentCharacter,
    appearance,
    appearanceStateData,
    appearanceCharacter,
    // Shop 관련
    shopData,
    isShopOpen,
    currentBackground,
    currentAppearance,
    boosterStatus,
    activeRpPack,
    purchaseItem,
    useBooster,
    activateRpPack,
    deactivateRpPack,
    equipItem,
    equipItems,
    openShop,
    closeShop,
    // 오디오 관련
    stopPlayback,
    // 로딩 상태
    isLoading,
    // RP팩 위치
    currentLocation,
    // 자동 대화 관련
    isAutoChatMode,
    startAutoChat: () => startAutoChat(sendMessage),
    stopAutoChat,
  };
};

export default useChatting;
