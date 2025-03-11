import React, { useState } from 'react';
import Modal from './components/Modal';

function App() {
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([]);
  const [input, setInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim()) {
      // 사용자 메시지 추가
      setMessages((prev) => [...prev, { text: input, isUser: true }]);

      try {
        // 백엔드 API 호출
        const response = await fetch('http://localhost:3333/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: input }),
        });

        const data = await response.json();

        if (data.isPaid) {
          setIsModalOpen(true);
        }
        // 벨라의 응답 추가
        setMessages((prev) => [...prev, { text: data.message, isUser: false }]);
      } catch (error) {
        console.error('Error:', error);
        // 에러 발생시 에러 메시지 표시
        setMessages((prev) => [
          ...prev,
          { text: '죄송합니다. 오류가 발생했습니다.', isUser: false },
        ]);
      }

      setInput('');
    }
  };

  const handleConfirm = () => {
    setIsModalOpen(false);
  };

  const handleClose = async () => {
    setIsModalOpen(false);
    const response = await fetch('http://localhost:3333/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: '미안. 생각해보니까, 지금은 때가 아닌 거 같아.' }),
    });
    const data = await response.json();
    setMessages((prev) => [...prev, { text: data.message, isUser: false }]);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-4">Chat with Bella</h1>
      <div className="w-full max-w-md">
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
