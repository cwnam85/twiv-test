// 호감도 레벨에 따른 포즈 해금 시스템
export const POSE_UNLOCK_LEVELS = {
  // 레벨 1, 2: 기본 포즈
  1: ['stand', 'sit'],
  2: ['stand', 'sit'],

  // 레벨 3 ,4: 더 많은 포즈
  3: ['stand', 'sit', 'spreadlegs'],
  4: ['stand', 'sit', 'spreadlegs'],

  // 레벨 5 : 모든 포즈
  5: ['stand', 'sit', 'doggy', 'spreadlegs', 'standdoggy', 'missionary', 'cowgirl'],
};

// 캐릭터별 포즈 제한 (선택사항)
export const CHARACTER_POSE_RESTRICTIONS = {
  meuaeng: ['stand', 'sit'], // 특정 캐릭터는 제한적
  leda: ['stand', 'sit'],
  yuara: ['stand', 'sit'],
  // 다른 캐릭터들은 제한 없음 (shaki, miwoo, dia, hario, blacknila 등)
};
