// 캐릭터별 허용 포즈 매핑
export const CHARACTER_POSES = {
  meuaeng: ['stand', 'sit'],
  leda: ['stand', 'sit'],
  yuara: ['stand', 'sit'],
  shaki: ['stand', 'sit', 'doggy', 'spreadlegs', 'standdoggy', 'missionary'],
  miwoo: ['stand', 'sit', 'doggy', 'spreadlegs', 'standdoggy', 'missionary'],
  dia: ['stand', 'sit', 'doggy', 'spreadlegs', 'standdoggy', 'missionary'],
  hario: ['stand', 'sit', 'doggy', 'spreadlegs', 'standdoggy', 'missionary'],
  blacknila: ['stand', 'sit', 'doggy', 'spreadlegs', 'standdoggy', 'missionary'],
  // 기본값
  default: ['stand', 'sit'],
};

// 캐릭터에 따른 포즈 목록 가져오기
export const getCharacterPoses = (character: string): string[] => {
  return CHARACTER_POSES[character as keyof typeof CHARACTER_POSES] || CHARACTER_POSES.default;
};

// 포즈 목록을 문자열로 변환
export const formatPoseList = (poses: string[]): string => {
  return poses.map((pose) => `- ${pose}`).join('\n');
};
