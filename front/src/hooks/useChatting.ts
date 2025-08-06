import { useState } from 'react';
import useCharacter from './useCharacter';
import useAffinity from './useAffinity';
import useAppearance from './useAppearance';
import useMessages from './useMessages';
import useModal from './useModal';
import useChatAPI from './useChatAPI';
import usePurchase from './usePurchase';
import useShop from './useShop';
import { useAudioPlayer } from './useAudioPlayer';

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

  // 오디오 플레이어 훅
  const { playAudioData, stopPlayback } = useAudioPlayer(currentCharacter);

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
    onAudioData: playAudioData,
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
  };
};

export default useChatting;
