import Modal from './components/Modal';
import useChatting from './hooks/useChatting';
import { useRef, useEffect, useState } from 'react';
import OutfitStatus from './components/OutfitStatus';
import Shop from './components/Shop';

function App() {
  const {
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
    pose,
    emotion,
    point,

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
  } = useChatting();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [boosterStartTime, setBoosterStartTime] = useState<number | null>(null);

  // 메시지가 추가될 때마다 자동으로 스크롤을 맨 아래로 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 부스터 상태가 변경될 때 시작 시간 설정
  useEffect(() => {
    if (
      boosterStatus?.affinityBoosterStatus.boosterActive &&
      boosterStatus.affinityBoosterStatus.boosterRemainingTime
    ) {
      // 서버에서 받은 남은 시간을 기준으로 시작 시간 계산
      const remainingTime = boosterStatus.affinityBoosterStatus.boosterRemainingTime;
      const startTime = Date.now() - (600000 - remainingTime); // 10분(600000ms)에서 남은 시간을 빼서 시작 시간 계산
      setBoosterStartTime(startTime);
    } else if (!boosterStatus?.affinityBoosterStatus.boosterActive) {
      setBoosterStartTime(null);
    }
  }, [
    boosterStatus?.affinityBoosterStatus.boosterActive,
    boosterStatus?.affinityBoosterStatus.boosterRemainingTime,
  ]);

  // 실시간 타이머 업데이트
  useEffect(() => {
    if (boosterStatus?.affinityBoosterStatus.boosterActive && boosterStartTime) {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000); // 1초마다 업데이트

      return () => clearInterval(interval);
    }
  }, [boosterStatus?.affinityBoosterStatus.boosterActive, boosterStartTime]);

  const getBackgroundStyle = () => {
    switch (currentBackground) {
      case 'default':
        return 'bg-white';
      case 'school':
        return 'bg-gradient-to-br from-blue-100 to-blue-200';
      case 'beach':
        return 'bg-gradient-to-br from-yellow-100 to-blue-100';
      default:
        return 'bg-white';
    }
  };

  // 부스터 상태 표시
  const renderBoosterStatus = () => {
    if (!boosterStatus?.affinityBoosterStatus.boosterActive || !boosterStartTime) {
      return null;
    }

    // 부스터 지속 시간 (10분 = 600초 = 600000ms)
    const BOOSTER_DURATION = 600000; // 10분

    // 현재 시간과 시작 시간의 차이를 계산
    const elapsedTime = currentTime - boosterStartTime;
    const remainingTime = BOOSTER_DURATION - elapsedTime;

    if (remainingTime <= 0) {
      return null; // 만료된 경우 표시하지 않음
    }

    const minutes = Math.floor(remainingTime / 60000);
    const seconds = Math.floor((remainingTime % 60000) / 1000);

    return (
      <div className="bg-orange-100 px-4 py-2 rounded-lg mb-2">
        <span className="text-orange-800 font-semibold">
          ⚡ 호감도 부스터 활성화 중: {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
      </div>
    );
  };

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-4 ${getBackgroundStyle()}`}
    >
      <OutfitStatus
        outfitData={outfitData}
        currentOutfit={currentOutfit}
        shopOutfits={shopData.outfits}
      />
      <div className="w-full max-w-md">
        {/* 상태 표시 영역 */}
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Chat with {currentCharacter}</h1>
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 px-4 py-2 rounded-lg">
                <span className="text-blue-800 font-semibold">호감도: {affinity}</span>
                <span className="text-blue-800 font-semibold ml-2">포인트: {point}</span>
              </div>
              <button
                onClick={openShop}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
              >
                상점
              </button>
            </div>
          </div>
          {renderBoosterStatus()}
          <div className="flex gap-2">
            <div className="bg-green-100 px-4 py-2 rounded-lg flex-1">
              <span className="text-green-800 font-semibold">감정: {emotion}</span>
            </div>
            <div className="bg-purple-100 px-4 py-2 rounded-lg flex-1">
              <span className="text-purple-800 font-semibold">포즈: {pose}</span>
            </div>
          </div>
        </div>

        {/* 채팅 메시지 영역 */}
        <div className="bg-gray-100 rounded-lg p-4 h-[400px] overflow-y-auto mb-4">
          {messages.map((message, index) => (
            <div key={index} className={`mb-2 ${message.isUser ? 'text-right' : 'text-left'}`}>
              <span
                className={`inline-block rounded-lg px-4 py-2 ${
                  message.isUser ? 'bg-blue-500 text-white' : 'bg-white text-gray-800'
                }`}
              >
                {message.text}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 입력 영역 */}
        <form className="flex gap-2" onSubmit={handleSend}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="메시지를 입력하세요..."
          />
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            전송
          </button>
        </form>
      </div>
      <Modal
        isOpen={isModalOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="포인트 구매"
        message="100포인트를 구매하시겠습니까?"
      />
      <Modal
        isOpen={isPurchaseModalOpen}
        onClose={handlePurchaseClose}
        onConfirm={handlePurchaseConfirm}
        title="프리미엄 콘텐츠 구매"
        message={`${purchaseContent}를 구매하시겠습니까?`}
      />
      {isShopOpen && (
        <Shop
          shopData={shopData}
          point={point}
          currentBackground={currentBackground}
          currentOutfit={currentOutfit}
          onPurchase={purchaseItem}
          onEquip={equipItem}
          onUseBooster={useBooster}
          onClose={closeShop}
        />
      )}
    </div>
  );
}

export default App;
