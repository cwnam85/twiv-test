import { useState } from 'react';
import useCharacter from './useCharacter';
import useAffinity from './useAffinity';
import useOutfit from './useOutfit';
import useMessages from './useMessages';
import useModal from './useModal';
import useChatAPI from './useChatAPI';
import usePurchase from './usePurchase';
import useShop from './useShop';
import { useAudioPlayer } from './useAudioPlayer';

const useChatting = () => {
  const [input, setInput] = useState('');

  // 각각의 작은 훅들을 사용
  const { currentCharacter, pose, emotion, updatePose, updateEmotion } = useCharacter();

  const { affinity, point, maxAffinity, updateAffinity, updatePoint, addPoints } = useAffinity();

  const { outfitData, refreshOutfitData } = useOutfit();

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
    currentOutfit,
    boosterStatus,
    purchaseItem,
    useBooster,
    equipItem,
    openShop,
    closeShop,
  } = useShop({
    point,
    onPointUpdate: updatePoint,
    onMessageAdd: addBotMessageFromMessage,
    refreshOutfitData, // useOutfit의 refreshOutfitData 함수 전달
  });

  // ChatAPI 훅 설정
  const { sendMessage } = useChatAPI({
    currentCharacter,
    affinity,
    outfitData,
    currentBackground,
    onMessageAdd: addBotMessageFromMessage,
    onAffinityUpdate: updateAffinity,
    onPointUpdate: updatePoint,
    onPoseUpdate: updatePose,
    onEmotionUpdate: updateEmotion,
    onOutfitRefresh: refreshOutfitData,
    onModalOpen: openModal,
    onPurchaseModalOpen: openPurchaseModal,
    onAudioData: playAudioData,
  });

  // Purchase 훅 설정
  const { handlePurchaseAction, handlePurchaseConfirm: purchaseConfirm } = usePurchase({
    addPoints,
    currentCharacter,
    affinity,
    outfitData,
    currentBackground,
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
    outfitData,
    // Shop 관련
    shopData,
    isShopOpen,
    currentBackground,
    currentOutfit,
    boosterStatus,
    purchaseItem,
    useBooster,
    equipItem,
    openShop,
    closeShop,
    // 오디오 관련
    stopPlayback,
  };
};

export default useChatting;
