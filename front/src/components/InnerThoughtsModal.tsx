import { Message } from '../types';

interface Pose {
  name: string;
  description: string;
  unlock_affinity: number;
  unlock_coercionPoint: number;
  sfw: boolean;
  nsfw: boolean;
}

// poseList 정적 데이터 (src/data/poseList.json과 동기화)
const poseList: Pose[] = [
  { name: 'Stand', description: 'Standing pose', unlock_affinity: 0, unlock_coercionPoint: 0, sfw: true, nsfw: true },
  { name: 'Sit', description: 'Sitting pose', unlock_affinity: 0, unlock_coercionPoint: 0, sfw: true, nsfw: true },
  { name: 'Cunnilingus', description: 'Cunnilingus pose', unlock_affinity: 30, unlock_coercionPoint: 30, sfw: false, nsfw: true },
  { name: 'Handjob', description: 'Handjob pose', unlock_affinity: 30, unlock_coercionPoint: 30, sfw: false, nsfw: true },
  { name: 'LegsUp', description: 'Legs up pose', unlock_affinity: 30, unlock_coercionPoint: 30, sfw: false, nsfw: true },
  { name: 'Masturbation', description: 'Masturbation pose', unlock_affinity: 30, unlock_coercionPoint: 30, sfw: false, nsfw: true },
  { name: 'Oral', description: 'Oral pose', unlock_affinity: 30, unlock_coercionPoint: 30, sfw: false, nsfw: true },
  { name: 'Footjob', description: 'Footjob pose', unlock_affinity: 30, unlock_coercionPoint: 30, sfw: false, nsfw: true },
  { name: 'Cowgirl', description: 'Cowgirl pose', unlock_affinity: 100, unlock_coercionPoint: 100, sfw: false, nsfw: true },
  { name: 'ReverseCowgirl', description: 'Reverse cowgirl pose', unlock_affinity: 100, unlock_coercionPoint: 100, sfw: false, nsfw: true },
  { name: 'Eagle', description: 'Eagle pose', unlock_affinity: 100, unlock_coercionPoint: 100, sfw: false, nsfw: true },
  { name: 'Flation', description: 'Flation pose', unlock_affinity: 100, unlock_coercionPoint: 100, sfw: false, nsfw: true },
  { name: 'Lotus', description: 'Lotus pose', unlock_affinity: 100, unlock_coercionPoint: 100, sfw: false, nsfw: true },
  { name: 'Missionary', description: 'Missionary pose', unlock_affinity: 100, unlock_coercionPoint: 100, sfw: false, nsfw: true },
  { name: 'Doggy', description: 'Doggy style pose', unlock_affinity: 100, unlock_coercionPoint: 100, sfw: false, nsfw: true },
];

interface InnerThoughtsModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  affinity: number;
  coercionPoint: number;
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

// 호감도에 따른 상태 텍스트
const getAffinityStatus = (affinity: number) => {
  if (affinity < 30) {
    return {
      text: '아직 미쿠와 충분히 가까워지지 않았다.',
      emoji: '💔',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
    };
  } else if (affinity < 100) {
    return {
      text: '미쿠랑 어느 정도 가까워졌다.',
      emoji: '💕',
      color: 'text-pink-600',
      bgColor: 'bg-pink-100',
    };
  } else {
    return {
      text: '미쿠와 완전히 가까워졌다.',
      emoji: '❤️‍🔥',
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    };
  }
};

// 협박도에 따른 상태 텍스트
const getCoercionStatus = (coercionPoint: number) => {
  if (coercionPoint < 30) {
    return {
      text: '미쿠가 요구를 들어줄 것 같지 않다.',
      emoji: '🛡️',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
    };
  } else if (coercionPoint < 100) {
    return {
      text: '미쿠가 협박에 떨고 있다.',
      emoji: '😰',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    };
  } else {
    return {
      text: '미쿠가 굴복했다.',
      emoji: '💀',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    };
  }
};

// 사용 가능한 포즈 목록
const getAvailablePoses = (value: number, type: 'affinity' | 'coercion') => {
  const key = type === 'affinity' ? 'unlock_affinity' : 'unlock_coercionPoint';
  return poseList.filter((pose) => !pose.sfw && pose[key] <= value);
};

const InnerThoughtsModal = ({
  isOpen,
  onClose,
  messages,
  affinity,
  coercionPoint,
  currentEmotion,
}: InnerThoughtsModalProps) => {
  if (!isOpen) return null;

  // 최신 봇 메시지 중 inner_thoughts가 있는 것만 찾기
  const latestBotMessage = [...messages]
    .reverse()
    .find((msg) => !msg.isUser && msg.inner_thoughts);

  const affinityStatus = getAffinityStatus(affinity);
  const coercionStatus = getCoercionStatus(coercionPoint);
  const affinityPoses = getAvailablePoses(affinity, 'affinity');
  const coercionPoses = getAvailablePoses(coercionPoint, 'coercion');

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

        {/* 호감도 및 감정 표시 */}
        <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
                <span className="text-purple-700 font-semibold">💜 호감도: {affinity}</span>
              </div>
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
                <span className="text-red-700 font-semibold">🔗 협박도: {coercionPoint}</span>
              </div>
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
                <span className="text-pink-700 font-semibold">
                  {emotionEmojis[currentEmotion] || '😐'} {currentEmotion}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 스크롤 가능한 컨텐츠 영역 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 호감도가 더 높거나 같을 때: 호감도 상태 표시 */}
          {affinity >= coercionPoint && (
            <div className={`rounded-lg p-4 ${affinityStatus.bgColor}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{affinityStatus.emoji}</span>
                <span className={`font-bold ${affinityStatus.color}`}>호감도 상태</span>
              </div>
              <p className={`${affinityStatus.color} mb-3`}>{affinityStatus.text}</p>
              {affinityPoses.length > 0 && (
                <div className="mt-2">
                  <span className="text-sm font-semibold text-gray-700">💕 가능한 행위: </span>
                  <span className="text-sm text-gray-600">
                    {affinityPoses.map((p) => p.name).join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 협박도가 더 높을 때: 협박도 상태 표시 */}
          {coercionPoint > affinity && (
            <div className={`rounded-lg p-4 ${coercionStatus.bgColor}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{coercionStatus.emoji}</span>
                <span className={`font-bold ${coercionStatus.color}`}>협박도 상태</span>
              </div>
              <p className={`${coercionStatus.color} mb-3`}>{coercionStatus.text}</p>
              {coercionPoses.length > 0 && (
                <div className="mt-2">
                  <span className="text-sm font-semibold text-gray-700">🔗 강제 가능한 행위: </span>
                  <span className="text-sm text-gray-600">
                    {coercionPoses.map((p) => p.name).join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 내면의 생각 */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">💭</span>
              <span className="font-bold text-purple-700">최근 내면의 생각</span>
            </div>
            {!latestBotMessage ? (
              <div className="text-center text-gray-400 py-4">
                <p className="text-sm">아직 내면의 생각이 없습니다.</p>
                <p className="text-xs mt-1">대화를 나누면 캐릭터의 속마음을 엿볼 수 있어요!</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-700 leading-relaxed italic">
                  "{latestBotMessage.inner_thoughts}"
                </p>
                {(latestBotMessage.emotion || latestBotMessage.affinity) && (
                  <div className="flex gap-2 pt-3 mt-3 border-t border-purple-200">
                    {latestBotMessage.emotion && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-xs font-medium text-pink-700">
                        {emotionEmojis[latestBotMessage.emotion] || '😐'} {latestBotMessage.emotion}
                      </span>
                    )}
                    {latestBotMessage.affinity && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-xs font-medium text-red-700">
                        ❤️ {latestBotMessage.affinity}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
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
