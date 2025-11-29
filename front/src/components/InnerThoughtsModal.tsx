import { Message } from '../types';

interface InnerThoughtsModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  affinity: number;
  currentEmotion: string;
}

// 감정별 이모티콘 매핑
const emotionEmojis: { [key: string]: string } = {
  Neutral: '😐',
  Happy: '😊',
  Funny: '😄',
  Affectionate: '🥰',
  Annoyed: '😒',
  Sad: '😢',
  Embarrassed: '😳',
  Dominating: '😏',
  Aroused: '😍',
  Angry: '😠',
};

const InnerThoughtsModal = ({
  isOpen,
  onClose,
  messages,
  affinity,
  currentEmotion,
}: InnerThoughtsModalProps) => {
  if (!isOpen) return null;

  // 봇 메시지만 필터링하고 inner_thoughts가 있는 것만
  const botMessages = messages.filter((msg) => !msg.isUser && msg.inner_thoughts);

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💭</span>
            <h2 className="text-2xl font-bold text-gray-800">내면의 생각</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* 호감도 및 현재 감정 표시 */}
        <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
                <span className="text-purple-700 font-semibold">호감도: {affinity}</span>
              </div>
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
                <span className="text-pink-700 font-semibold">
                  현재 감정: {emotionEmojis[currentEmotion] || '😐'} {currentEmotion}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 내면의 생각 목록 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {botMessages.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p className="text-lg">아직 내면의 생각이 없습니다.</p>
              <p className="text-sm mt-2">대화를 나누면 캐릭터의 속마음을 엿볼 수 있어요!</p>
            </div>
          ) : (
            botMessages.map((message, index) => (
              <div
                key={index}
                className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow space-y-3"
              >
                {/* 나레이션 */}
                {message.narration && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 font-semibold mb-1">📝 나레이션</div>
                    <p className="text-gray-700 italic">{message.narration}</p>
                  </div>
                )}

                {/* 내면의 생각 */}
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💭</span>
                  <div className="flex-1">
                    <div className="text-xs text-purple-500 font-semibold mb-1">내면의 생각</div>
                    <p className="text-gray-700 leading-relaxed">{message.inner_thoughts}</p>
                  </div>
                </div>

                {/* 감정 및 호감도 정보 */}
                {(message.emotion || message.affinity) && (
                  <div className="flex gap-2 pt-2 border-t border-purple-200">
                    {message.emotion && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-xs font-medium text-pink-700">
                        {emotionEmojis[message.emotion] || '😐'} {message.emotion}
                      </span>
                    )}
                    {message.affinity && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-xs font-medium text-red-700">
                        ❤️ {message.affinity}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-purple-500 text-white py-2 rounded-lg hover:bg-purple-600 transition-colors font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default InnerThoughtsModal;
