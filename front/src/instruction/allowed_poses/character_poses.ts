import { POSE_UNLOCK_LEVELS, CHARACTER_POSE_RESTRICTIONS } from './pose_unlock_levels';

// 캐릭터에 따른 포즈 목록 가져오기 (호감도 레벨 기반)
export const getCharacterPoses = (character: string, level: number): string[] => {
  // 레벨에 따른 포즈 가져오기
  const levelPoses =
    POSE_UNLOCK_LEVELS[level as keyof typeof POSE_UNLOCK_LEVELS] || POSE_UNLOCK_LEVELS[1];

  // 캐릭터별 제한 적용
  const characterRestriction =
    CHARACTER_POSE_RESTRICTIONS[character as keyof typeof CHARACTER_POSE_RESTRICTIONS];

  if (characterRestriction) {
    // 캐릭터 제한이 있으면 교집합
    return levelPoses.filter((pose: string) => characterRestriction.includes(pose));
  }

  // 제한이 없으면 레벨 포즈 그대로 반환
  return levelPoses;
};

// 포즈 목록을 문자열로 변환
export const formatPoseList = (poses: string[]): string => {
  return poses.map((pose) => `- ${pose}`).join('\n');
};
