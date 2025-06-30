import Modal from './components/Modal';
import useChatting from './hooks/useChatting';
import { useRef } from 'react';
import OutfitStatus from './components/OutfitStatus';

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
    level,
    point,
    currentCharacter,
    outfitData,
  } = useChatting();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <OutfitStatus outfitData={outfitData} />
      <div className="w-full max-w-md">
        {/* 상태 표시 영역 */}
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Chat with {currentCharacter}</h1>
            <div className="bg-blue-100 px-4 py-2 rounded-lg">
              <span className="text-blue-800 font-semibold">호감도: {affinity}</span>
              <span className="text-blue-800 font-semibold ml-2">Lv.{level}</span>
              <span className="text-blue-800 font-semibold ml-2">포인트: {point}</span>
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
    </div>
  );
}

export default App;
