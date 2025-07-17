// 오디오 페이드 및 볼륨 관련 설정
export const AUDIO_FADE_CONFIG = {
  fadeInDuration: 0.2, // 초 (TTS/효과음 공통)
  fadeOutDuration: 0.2, // 초 (TTS/효과음 공통)
  minFadeVolume: 0.1, // 0.0 ~ 1.0 (페이드 아웃 최소 볼륨 비율)
  ttsVolumeBoost: 1.0, // TTS 음량 증폭 배수
  effectVolumeBoost: 4.0, // 효과음 음량 증폭 배수
};
