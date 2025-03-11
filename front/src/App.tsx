import React, { useState } from "react";

function App() {
  const [messages, setMessages] = useState<
    Array<{ text: string; isUser: boolean }>
  >([]);
  const [input, setInput] = useState("");

  const handleSend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim()) {
      // 사용자 메시지 추가
      setMessages((prev) => [...prev, { text: input, isUser: true }]);
      // 벨라의 응답 (예시)
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { text: "안녕하세요! 무엇을 도와드릴까요?", isUser: false },
        ]);
      }, 1000);
      setInput("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-4">Chat with Bella</h1>
      <div className="w-full max-w-md">
        {/* 채팅 메시지 영역 */}
        <div className="bg-gray-100 rounded-lg p-4 h-[400px] overflow-y-auto mb-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-2 ${message.isUser ? "text-right" : "text-left"}`}
            >
              <span
                className={`inline-block rounded-lg px-4 py-2 ${
                  message.isUser
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-800"
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
    </div>
  );
}

export default App;
