import Modal from './components/Modal';
import useChatting from './hooks/useChatting';
import { useRef, useEffect } from 'react';
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
    purchaseItem,
    equipItem,
    openShop,
    closeShop,
  } = useChatting();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지가 추가될 때마다 자동으로 스크롤을 맨 아래로 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          onClose={closeShop}
        />
      )}
    </div>
  );
}

export default App;
