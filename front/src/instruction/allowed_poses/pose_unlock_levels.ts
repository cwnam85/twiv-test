// 호감도 affinity에 따른 포즈 해금 시스템
export const POSE_UNLOCK_AFFINITY = {
  // affinity 0-99: 기본 포즈
  0: ['stand', 'sit'],
  // affinity 100+: 모든 포즈
  100: ['stand', 'sit', 'doggy', 'spreadlegs', 'standdoggy', 'missionary', 'cowgirl'],
};

// 캐릭터별 포즈 제한 (선택사항)
export const CHARACTER_POSE_RESTRICTIONS = {
  meuaeng: ['stand', 'sit'], // 특정 캐릭터는 제한적
  leda: ['stand', 'sit'],
  yuara: ['stand', 'sit'],
  // 다른 캐릭터들은 제한 없음 (shaki, miwoo, dia, hario, blacknila 등)
};
