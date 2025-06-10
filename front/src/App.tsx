import Modal from './components/Modal';
import useChatting from './hooks/useChatting';
import { useEffect, useRef, useState } from 'react';

function App() {
  const {
    messages,
    input,
    setInput,
    isModalOpen,
    handleSend,
    handleConfirm,
    handleClose,
    affinity,
    pose,
    emotion,
    level,
    point,
  } = useChatting();
  const [currentCharacter, setCurrentCharacter] = useState('Loading...');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 백엔드에서 activeCharacter 가져오기
    fetch('/active-character')
      .then((response) => response.json())
      .then((data) => {
        setCurrentCharacter(data.activeCharacter || 'Default Character');
      })
      .catch((error) => {
        console.error('Error fetching active character:', error);
        setCurrentCharacter('Default Character');
      });
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
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
        title="상품 구매"
        message="이 상품을 구매하시겠습니까?"
      />
    </div>
  );
}

export default App;
