// 호감도 affinity에 따른 포즈 해금 시스템
export const POSE_UNLOCK_AFFINITY = {
  // affinity 0-79: 기본 포즈
  0: ['stand', 'sit'],
  // affinity 80-99: 중간 포즈
  80: ['stand', 'sit', 'doggy', 'spreadlegs'],
  // affinity 100+: 모든 포즈
  100: ['stand', 'sit', 'doggy', 'spreadlegs', 'standdoggy', 'missionary', 'cowgirl'],
};

// 성인용 캐릭터 구분 (jinza 템플릿용)
export const characterForAdult: { [key: string]: boolean } = {
  meuaeng: false,
  leda: false,
  yuara: false,
  shaki: true,
  miwoo: true,
  dia: true,
  hario: true,
  blacknila: true,
};

// 캐릭터별 포즈 제한 (선택사항)
export const CHARACTER_POSE_RESTRICTIONS = {
  meuaeng: ['stand', 'sit'], // 특정 캐릭터는 제한적
  leda: ['stand', 'sit'],
  yuara: ['stand', 'sit'],
  // 다른 캐릭터들은 제한 없음 (shaki, miwoo, dia, hario, blacknila 등)
};
