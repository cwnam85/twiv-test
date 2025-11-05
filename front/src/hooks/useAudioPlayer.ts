import { useCallback, useRef } from 'react';
import { AUDIO_CONFIG } from '../config/audioConfig';

interface AudioSegment {
  type: 'text' | 'tag';
  content: string;
  audioUrl?: string;
  index: number;
}

interface AudioData {
  dialogue: string;
  emotion: string;
  segments: AudioSegment[];
  infiniteTag?: string;
  infiniteEffectUrl?: string;
  backgroundAudio?: string;
  singleBackgroundAudio?: string; // TTS 완료 후 한 번만 재생되는 배경음
  matureTags: string[];
}

export const useAudioPlayer = (
  currentCharacter: string = 'shaki',
  onPlaybackComplete?: () => void,
) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const ttsGainNodeRef = useRef<GainNode | null>(null);
  const effectGainNodeRef = useRef<GainNode | null>(null);
  const isPlayingRef = useRef(false);
  const infiniteIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const backgroundAudioRef = useRef<boolean>(false);
  const infinitePlayingRef = useRef<boolean>(false);

  // TTS 파일명 추출 함수
  const extractFileName = useCallback((audioUrl: string): string | null => {
    try {
      const url = new URL(audioUrl, window.location.origin);
      const pathParts = url.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];
      return fileName || null;
    } catch (error) {
      console.error('[CLIENT] Error extracting filename from URL:', error);
      return null;
    }
  }, []);

  // TTS 파일 재생 완료 시 서버에 삭제 요청
  const notifyTTSSFilePlayed = useCallback(async (fileName: string) => {
    try {
      const response = await fetch('/delete-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName }),
      });

      if (response.ok) {
        console.log(`[CLIENT] Notified server to delete TTS file: ${fileName}`);
      } else {
        console.warn(`[CLIENT] Failed to notify server about TTS file deletion: ${fileName}`);
      }
    } catch (error) {
      console.error(`[CLIENT] Error notifying server about TTS file deletion:`, error);
    }
  }, []);

  // AudioContext 초기화
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

      // TTS용 gainNode 생성
      ttsGainNodeRef.current = audioContextRef.current.createGain();
      ttsGainNodeRef.current.connect(audioContextRef.current.destination);

      // 효과음용 gainNode 생성
      effectGainNodeRef.current = audioContextRef.current.createGain();
      effectGainNodeRef.current.connect(audioContextRef.current.destination);
    }
  }, []);

  // 오디오 파일 다운로드 및 디코딩
  const loadAudioBuffer = useCallback(
    async (audioUrl: string): Promise<AudioBuffer> => {
      if (!audioContextRef.current) {
        initAudioContext();
      }

      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      return await audioContextRef.current!.decodeAudioData(arrayBuffer);
    },
    [initAudioContext],
  );

  // 페이드 효과가 적용된 오디오 재생
  const playWithFade = useCallback(
    async (
      audioBuffer: AudioBuffer,
      _isFirst: boolean,
      _isLast: boolean,
      isEffect: boolean = false,
      audioUrl?: string, // TTS 파일 URL 추가
    ): Promise<void> => {
      if (!audioContextRef.current || !ttsGainNodeRef.current || !effectGainNodeRef.current) {
        initAudioContext();
      }

      const audioContext = audioContextRef.current!;
      // 오디오 타입에 따라 적절한 gainNode 선택
      const gainNode = isEffect ? effectGainNodeRef.current! : ttsGainNodeRef.current!;

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNode);

      const startTime = audioContext.currentTime;

      // 효과음인 경우 볼륨 조절
      const volumeMultiplier = isEffect
        ? AUDIO_CONFIG.EFFECT_VOLUME_MULTIPLIER
        : AUDIO_CONFIG.TTS_VOLUME_MULTIPLIER;

      // 페이드 효과 제거 - 모든 오디오를 즉시 재생
      if (audioContext.state === 'suspended') {
        try {
          await audioContext.resume();
          console.log(`[CLIENT] AudioContext resumed for audio playback`);
        } catch (error) {
          console.error(`[CLIENT] Error resuming AudioContext:`, error);
        }
      }
      gainNode.gain.setValueAtTime(volumeMultiplier, startTime);

      // 페이드 아웃 효과 제거 - 모든 오디오를 자연스럽게 끝냄

      source.start();

      return new Promise((resolve) => {
        source.onended = () => {
          // TTS 파일인 경우 재생 완료 후 서버에 삭제 요청
          if (!isEffect && audioUrl) {
            const fileName = extractFileName(audioUrl);
            if (fileName) {
              notifyTTSSFilePlayed(fileName);
            }
          }
          resolve();
        };
      });
    },
    [initAudioContext, extractFileName, notifyTTSSFilePlayed],
  );

  // 효과음 재생
  const playEffect = useCallback(
    async (
      effectType: string,
      audioUrl: string,
      isFirst: boolean,
      isLast: boolean,
    ): Promise<void> => {
      console.log(`[CLIENT] Playing effect: ${effectType} (first: ${isFirst}, last: ${isLast})`);

      if (!audioUrl) {
        console.warn(`[CLIENT] No audio URL for effect: ${effectType}`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 대기
        return;
      }

      try {
        const audioBuffer = await loadAudioBuffer(audioUrl);
        await playWithFade(audioBuffer, isFirst, isLast, true); // isEffect: true
        console.log(`[CLIENT] ✓ Effect ${effectType} completed`);
      } catch (error) {
        console.error(`[CLIENT] Error playing effect ${effectType}:`, error);
        // 에러 발생시 대기만
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    },
    [loadAudioBuffer, playWithFade],
  );

  // 무한재생 중지 (즉시 끊기)
  const stopInfinitePlayback = useCallback(() => {
    if (infiniteIntervalRef.current) {
      clearInterval(infiniteIntervalRef.current);
      infiniteIntervalRef.current = null;
    }

    // 무한재생 전용 플래그를 false로 설정하여 재귀 호출을 즉시 중단
    infinitePlayingRef.current = false;

    // 현재 재생 중인 오디오도 즉시 중단
    if (audioContextRef.current && ttsGainNodeRef.current && effectGainNodeRef.current) {
      try {
        // TTS와 효과음 모두 볼륨을 즉시 0으로 설정하여 소리 끄기
        ttsGainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime);
        effectGainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime);
        // AudioContext 일시정지
        audioContextRef.current.suspend();
        console.log(`[CLIENT] Immediately stopped current audio playback`);
      } catch (error) {
        console.error(`[CLIENT] Error stopping audio immediately:`, error);
      }
    }

    console.log(`[CLIENT] Stopped infinite playback (immediate stop)`);
  }, []);

  // 세그먼트 순차 재생
  const playSegments = useCallback(
    async (segments: AudioSegment[]): Promise<void> => {
      if (isPlayingRef.current) {
        console.log(
          '[CLIENT] Already playing, stopping current TTS playback (keeping background audio)',
        );
        // 배경음은 유지하고 TTS만 중지
        isPlayingRef.current = false;
        infinitePlayingRef.current = false;
      }

      isPlayingRef.current = true;
      console.log(`[CLIENT] Starting playback of ${segments.length} segments`);

      try {
        // 1단계: TTS 파일들 병렬 다운로드
        const ttsSegments = segments.filter((s) => s.type === 'text');
        console.log(`[CLIENT] Downloading ${ttsSegments.length} TTS files...`);

        const audioBuffers = await Promise.all(
          ttsSegments.map(async (segment) => {
            const audioBuffer = await loadAudioBuffer(segment.audioUrl!);
            return { index: segment.index, audioBuffer, audioUrl: segment.audioUrl };
          }),
        );

        console.log(`[CLIENT] All TTS files downloaded successfully`);

        // 2단계: 순차 재생
        for (let i = 0; i < segments.length; i++) {
          if (!isPlayingRef.current) break; // 중단 신호 확인

          const segment = segments[i];
          const isFirst = i === 0;
          const isLast = i === segments.length - 1;

          // 첫 번째 세그먼트가 재생되기 시작할 때 이전 오디오 즉시 중단
          if (isFirst) {
            console.log(`[CLIENT] First segment starting - stopping previous audio immediately`);
            if (audioContextRef.current && ttsGainNodeRef.current && effectGainNodeRef.current) {
              try {
                // 이전 오디오 즉시 중단 (TTS와 효과음 모두)
                ttsGainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime);
                effectGainNodeRef.current.gain.setValueAtTime(
                  0,
                  audioContextRef.current.currentTime,
                );
                audioContextRef.current.suspend();
                console.log(`[CLIENT] Previous audio stopped immediately`);
              } catch (error) {
                console.error(`[CLIENT] Error stopping previous audio:`, error);
              }
            }
          }

          console.log(`[CLIENT] Playing segment ${i + 1}/${segments.length}: ${segment.type}`);

          if (segment.type === 'text') {
            const audioElement = audioBuffers.find((ae) => ae.index === segment.index);
            if (audioElement) {
              await playWithFade(
                audioElement.audioBuffer,
                isFirst,
                isLast,
                false,
                audioElement.audioUrl,
              );
              console.log(`[CLIENT] ✓ TTS segment ${i + 1} completed`);
            }
          } else {
            await playEffect(segment.content, segment.audioUrl || '', isFirst, isLast);
            console.log(`[CLIENT] ✓ Effect segment ${i + 1} completed`);
          }
        }

        console.log(`[CLIENT] All segments completed`);
      } catch (error) {
        console.error('[CLIENT] Error during playback:', error);
      }
      // 무한재생이 시작될 예정이므로 여기서 isPlayingRef를 false로 설정하지 않음
    },
    [loadAudioBuffer, playWithFade, playEffect],
  );

  // 한 번만 재생되는 배경음 함수
  const playSingleBackgroundAudio = useCallback(
    async (effectType: string): Promise<void> => {
      console.log(`[DEBUG SINGLE] playSingleBackgroundAudio called with effectType: ${effectType}`);

      // 기존 배경음 중지
      if (backgroundAudioRef.current) {
        console.log(`[CLIENT] Stopping previous background audio for single background audio`);
        backgroundAudioRef.current = false;

        // 현재 재생 중인 오디오 즉시 중지
        if (audioContextRef.current && effectGainNodeRef.current) {
          try {
            effectGainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime);
            console.log(
              `[CLIENT] Previous background audio stopped immediately for single background audio`,
            );
          } catch (error) {
            console.error(
              `[CLIENT] Error stopping previous background audio for single background audio:`,
              error,
            );
          }
        }
      }

      try {
        console.log(`[DEBUG SINGLE] Fetching random effect for: ${effectType}`);
        // 랜덤 효과음 파일 선택을 위해 백엔드 API 호출
        const response = await fetch(`/api/effects/random/${effectType}`);
        if (!response.ok) {
          throw new Error(`Failed to get random effect URL for ${effectType}`);
        }
        const { url } = await response.json();

        console.log(`[CLIENT] Playing single background audio: ${url}`);
        const audioBuffer = await loadAudioBuffer(url);

        console.log(`[DEBUG SINGLE] About to call playWithFade with isEffect: true`);
        // 한 번만 재생 (isEffect: true로 효과음 볼륨 적용)
        await playWithFade(audioBuffer, true, true, true);
        console.log(`[CLIENT] ✓ Single background audio completed`);
      } catch (error) {
        console.error(`[CLIENT] Error playing single background audio ${effectType}:`, error);
      }
    },
    [loadAudioBuffer, playWithFade],
  );

  // 배경음 재생 시작 (큰 볼륨으로)
  const startBackgroundAudio = useCallback(
    async (effectType: string) => {
      // 기존 배경음 중지
      if (backgroundAudioRef.current) {
        console.log(`[CLIENT] Stopping previous background audio`);
        backgroundAudioRef.current = false;

        // 현재 재생 중인 오디오 즉시 중지
        if (audioContextRef.current && effectGainNodeRef.current) {
          try {
            effectGainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime);
            console.log(`[CLIENT] Previous background audio stopped immediately`);
          } catch (error) {
            console.error(`[CLIENT] Error stopping previous background audio:`, error);
          }
        }
      }

      // AudioContext 다시 활성화 (이전에 suspend된 경우)
      if (audioContextRef.current) {
        try {
          await audioContextRef.current.resume();
          console.log(`[CLIENT] AudioContext resumed for background audio`);
        } catch (error) {
          console.error(`[CLIENT] Error resuming AudioContext for background audio:`, error);
        }
      }

      backgroundAudioRef.current = true;
      console.log(`[CLIENT] Starting LOUD background audio: ${effectType}`);

      const playNextBackgroundEffect = async () => {
        // 매번 체크하여 중지 요청 시 즉시 종료
        if (!backgroundAudioRef.current) {
          console.log(`[CLIENT] Background audio stopped for ${effectType}`);
          return;
        }

        try {
          // 랜덤 효과음 파일 선택을 위해 백엔드 API 호출
          const response = await fetch(`/api/effects/random/${effectType}`);
          if (!response.ok) {
            throw new Error(`Failed to get random effect URL for ${effectType}`);
          }
          const { url } = await response.json();
          console.log(`[CLIENT] Using random background: ${url}`);
          console.log(`[CLIENT] Playing loud background: ${url}`);
          const audioBuffer = await loadAudioBuffer(url);

          // 재생 직전에 다시 한 번 체크
          if (!backgroundAudioRef.current) {
            console.log(`[CLIENT] Background audio cancelled before playback for ${effectType}`);
            return;
          }

          // 배경음은 큰 볼륨으로 재생
          await playWithFade(audioBuffer, true, true, true);

          // 재생 완료 후에도 체크하여 중지 요청 시 재귀 호출 중단
          if (backgroundAudioRef.current) {
            console.log(`[CLIENT] Background audio continues for ${effectType}`);
            playNextBackgroundEffect();
          } else {
            console.log(`[CLIENT] Background audio stopped after playback for ${effectType}`);
          }
        } catch (error) {
          console.error(`[CLIENT] Error playing background effect ${effectType}:`, error);
          // 에러 발생 시에도 중지 체크
          if (backgroundAudioRef.current) {
            // 짧은 대기 후 재시도 (재시도 전에도 체크)
            setTimeout(() => {
              if (backgroundAudioRef.current) {
                playNextBackgroundEffect();
              } else {
                console.log(
                  `[CLIENT] Background audio stopped during error retry for ${effectType}`,
                );
              }
            }, 1000);
          }
        }
      };

      playNextBackgroundEffect();
    },
    [loadAudioBuffer, playWithFade],
  );

  // 무한재생 시작
  const startInfinitePlayback = useCallback(
    async (effectType: string, effectUrl?: string) => {
      // 기존 무한재생 중지
      stopInfinitePlayback();

      // AudioContext 다시 활성화 (이전에 suspend된 경우)
      if (audioContextRef.current) {
        try {
          await audioContextRef.current.resume();
          console.log(`[CLIENT] AudioContext resumed for infinite playback`);
        } catch (error) {
          console.error(`[CLIENT] Error resuming AudioContext for infinite playback:`, error);
        }
      }

      // 무한재생 플래그 설정
      infinitePlayingRef.current = true;
      console.log(`[CLIENT] Starting infinite playback of ${effectType}`);

      // 재귀적으로 효과음을 재생하는 함수
      const playNextEffect = async () => {
        // 무한재생 전용 플래그 체크 (더 즉각적인 중지)
        if (!infinitePlayingRef.current) {
          console.log(`[CLIENT] Infinite playback stopped for ${effectType}`);
          return;
        }

        console.log(`[CLIENT] Playing infinite effect: ${effectType}`);
        try {
          // 서버에서 제공한 URL 사용, 없으면 클라이언트에서 생성
          const url =
            effectUrl ||
            `/api/effects/${currentCharacter.toLowerCase()}/${effectType}/${effectType}_${Math.floor(Math.random() * 2) + 1}.mp3`;
          const audioBuffer = await loadAudioBuffer(url);

          // 재생 시작 전에 다시 한 번 체크
          if (!infinitePlayingRef.current) {
            console.log(
              `[CLIENT] Infinite playback cancelled before audio playback for ${effectType}`,
            );
            return;
          }

          await playWithFade(audioBuffer, true, true, true); // isFirst: true, isLast: true, isEffect: true

          // 효과음 재생 완료 후 바로 다음 효과음 재생 (다시 체크)
          if (infinitePlayingRef.current) {
            playNextEffect();
          } else {
            console.log(
              `[CLIENT] Infinite playback stopped after audio completion for ${effectType}`,
            );
          }
        } catch (error) {
          console.error(`[CLIENT] Error playing infinite effect ${effectType}:`, error);
          // 에러 발생시에도 플래그 체크 후 재시도
          if (infinitePlayingRef.current) {
            playNextEffect();
          }
        }
      };

      // 첫 번째 효과음 재생 시작
      playNextEffect();
    },
    [loadAudioBuffer, playWithFade, currentCharacter, stopInfinitePlayback],
  );

  // 메인 재생 함수
  const playAudioData = useCallback(
    async (audioData: AudioData | null) => {
      if (!audioData || !audioData.segments || audioData.segments.length === 0) {
        console.log('[CLIENT] No audio data to play');
        return;
      }

      // 새로운 재생을 위해 AudioContext 다시 활성화
      if (audioContextRef.current) {
        try {
          await audioContextRef.current.resume();
          console.log(`[CLIENT] AudioContext resumed for new playback`);
        } catch (error) {
          console.error(`[CLIENT] Error resuming AudioContext:`, error);
        }
      }

      // 이전 배경음 중지
      if (backgroundAudioRef.current) {
        console.log(`[CLIENT] Stopping previous background audio for new playback`);
        backgroundAudioRef.current = false;

        // 현재 재생 중인 오디오 즉시 중지
        if (audioContextRef.current && effectGainNodeRef.current) {
          try {
            effectGainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime);
            console.log(`[CLIENT] Previous background audio stopped immediately for new playback`);
          } catch (error) {
            console.error(
              `[CLIENT] Error stopping previous background audio for new playback:`,
              error,
            );
          }
        }
      }

      // 배경음 시작 (TTS와 동시 재생)
      if (audioData.backgroundAudio) {
        console.log(`[CLIENT] Starting background audio: ${audioData.backgroundAudio}`);
        await startBackgroundAudio(audioData.backgroundAudio);
      }

      // 세그먼트 재생 (배경음과 동시에)
      await playSegments(audioData.segments);

      // TTS 완료 후 한 번만 재생되는 배경음
      if (audioData.singleBackgroundAudio) {
        console.log(
          `[CLIENT] Playing single background audio after TTS: ${audioData.singleBackgroundAudio}`,
        );
        console.log(
          `[DEBUG CLIENT] singleBackgroundAudio: ${audioData.singleBackgroundAudio}, backgroundAudio: ${audioData.backgroundAudio}, infiniteTag: ${audioData.infiniteTag}`,
        );
        await playSingleBackgroundAudio(audioData.singleBackgroundAudio);
      }

      // 무한재생 시작
      if (audioData.infiniteTag) {
        console.log('[CLIENT] Starting infinite playback, then calling completion callback');
        console.log(
          `[DEBUG INFINITE] infiniteTag: ${audioData.infiniteTag}, infiniteEffectUrl: ${audioData.infiniteEffectUrl}`,
        );
        isPlayingRef.current = true; // 무한재생을 위해 true로 설정
        await startInfinitePlayback(audioData.infiniteTag, audioData.infiniteEffectUrl);
      } else {
        // 무한재생이 없으면 재생 상태를 false로 설정
        console.log(`[DEBUG INFINITE] No infiniteTag, setting isPlayingRef to false`);
        isPlayingRef.current = false;
      }

      // TTS 재생 완료 콜백 호출 (무한재생 시작 후)
      if (onPlaybackComplete) {
        console.log('[CLIENT] TTS playback completed (including infinite setup), calling callback');
        onPlaybackComplete();
      }
    },
    [
      playSegments,
      startInfinitePlayback,
      startBackgroundAudio,
      playSingleBackgroundAudio,
      onPlaybackComplete,
    ],
  );

  return {
    playAudioData,
    // stopPlayback, // 더 이상 외부에서 사용하지 않음
    isPlaying: isPlayingRef.current,
  };
};
