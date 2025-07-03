import { POSE_UNLOCK_AFFINITY, CHARACTER_POSE_RESTRICTIONS } from './pose_unlock_levels';

// 캐릭터에 따른 포즈 목록 가져오기 (호감도 affinity 기반)
export const getCharacterPoses = (character: string, affinity: number): string[] => {
  // affinity에 따른 포즈 가져오기
  const affinityKeys = Object.keys(POSE_UNLOCK_AFFINITY)
    .map(Number)
    .sort((a, b) => a - b);
  let selectedAffinity = 0;

  // 현재 affinity에 맞는 포즈 세트 찾기
  for (const key of affinityKeys) {
    if (affinity >= key) {
      selectedAffinity = key;
    } else {
      break;
    }
  }

  const affinityPoses =
    POSE_UNLOCK_AFFINITY[selectedAffinity as keyof typeof POSE_UNLOCK_AFFINITY] ||
    POSE_UNLOCK_AFFINITY[0];

  // 캐릭터별 제한 적용
  const characterRestriction =
    CHARACTER_POSE_RESTRICTIONS[character as keyof typeof CHARACTER_POSE_RESTRICTIONS];

  if (characterRestriction) {
    // 캐릭터 제한이 있으면 교집합
    return affinityPoses.filter((pose: string) => characterRestriction.includes(pose));
  }

  // 제한이 없으면 affinity 포즈 그대로 반환
  return affinityPoses;
};

// 포즈 목록을 문자열로 변환
export const formatPoseList = (poses: string[]): string => {
  return poses.map((pose) => `- ${pose}`).join('\n');
};
