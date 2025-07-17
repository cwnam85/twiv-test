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
  matureTags: string[];
}

export const useAudioPlayer = (currentCharacter: string = 'shaki') => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const isPlayingRef = useRef(false);
  const infiniteIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // AudioContext 초기화
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
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
      isFirst: boolean,
      isLast: boolean,
      isEffect: boolean = false,
    ): Promise<void> => {
      if (!audioContextRef.current || !gainNodeRef.current) {
        initAudioContext();
      }

      const audioContext = audioContextRef.current!;
      const gainNode = gainNodeRef.current!;

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNode);

      const startTime = audioContext.currentTime;
      const duration = audioBuffer.duration;

      // 효과음인 경우 볼륨 조절
      const volumeMultiplier = isEffect
        ? AUDIO_CONFIG.EFFECT_VOLUME_MULTIPLIER
        : AUDIO_CONFIG.TTS_VOLUME_MULTIPLIER;

      // 페이드 효과 적용
      if (!isFirst) {
        // 페이드 인
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(
          volumeMultiplier,
          startTime + AUDIO_CONFIG.FADE_IN_DURATION,
        );
      } else {
        // 첫 번째 세그먼트인 경우 즉시 볼륨 설정
        gainNode.gain.setValueAtTime(volumeMultiplier, startTime);
      }

      if (!isLast) {
        // 페이드 아웃
        gainNode.gain.setValueAtTime(
          volumeMultiplier,
          startTime + duration - AUDIO_CONFIG.FADE_OUT_DURATION,
        );
        gainNode.gain.linearRampToValueAtTime(
          AUDIO_CONFIG.MIN_FADE_VOLUME * volumeMultiplier,
          startTime + duration,
        );
      }

      source.start();

      return new Promise((resolve) => {
        source.onended = () => resolve();
      });
    },
    [initAudioContext],
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

  // 세그먼트 순차 재생
  const playSegments = useCallback(
    async (segments: AudioSegment[]): Promise<void> => {
      if (isPlayingRef.current) {
        console.log('[CLIENT] Already playing, stopping current playback');
        stopPlayback();
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
            return { index: segment.index, audioBuffer };
          }),
        );

        console.log(`[CLIENT] All TTS files downloaded successfully`);

        // 2단계: 순차 재생
        for (let i = 0; i < segments.length; i++) {
          if (!isPlayingRef.current) break; // 중단 신호 확인

          const segment = segments[i];
          const isFirst = i === 0;
          const isLast = i === segments.length - 1;

          console.log(`[CLIENT] Playing segment ${i + 1}/${segments.length}: ${segment.type}`);

          if (segment.type === 'text') {
            const audioElement = audioBuffers.find((ae) => ae.index === segment.index);
            if (audioElement) {
              await playWithFade(audioElement.audioBuffer, isFirst, isLast);
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

  // 무한재생 시작
  const startInfinitePlayback = useCallback(
    (effectType: string, effectUrl?: string) => {
      if (infiniteIntervalRef.current) {
        clearInterval(infiniteIntervalRef.current);
      }

      console.log(`[CLIENT] Starting infinite playback of ${effectType}`);

      // 재귀적으로 효과음을 재생하는 함수
      const playNextEffect = async () => {
        if (!isPlayingRef.current) {
          console.log(`[CLIENT] Infinite playback stopped for ${effectType}`);
          return;
        }

        console.log(`[CLIENT] Playing infinite effect: ${effectType}`);
        try {
          // 서버에서 제공한 URL 사용, 없으면 클라이언트에서 생성
          const url =
            effectUrl ||
            (currentCharacter.toLowerCase() === 'blacknila'
              ? `/api/effects/blacknila/${effectType}/${effectType}_${Math.floor(Math.random() * 2) + 1}.mp3`
              : `/api/effects/${effectType}/${effectType}_${Math.floor(Math.random() * 2) + 1}.mp3`);
          const audioBuffer = await loadAudioBuffer(url);
          await playWithFade(audioBuffer, true, true, true); // isFirst: true, isLast: true, isEffect: true

          // 효과음 재생 완료 후 바로 다음 효과음 재생
          if (isPlayingRef.current) {
            playNextEffect();
          }
        } catch (error) {
          console.error(`[CLIENT] Error playing infinite effect ${effectType}:`, error);
          // 에러 발생시에도 바로 재시도
          if (isPlayingRef.current) {
            playNextEffect();
          }
        }
      };

      // 첫 번째 효과음 재생 시작
      playNextEffect();
    },
    [loadAudioBuffer, playWithFade],
  );

  // 무한재생 중지
  const stopInfinitePlayback = useCallback(() => {
    if (infiniteIntervalRef.current) {
      clearInterval(infiniteIntervalRef.current);
      infiniteIntervalRef.current = null;
    }
    // isPlayingRef.current = false로 설정하여 재귀 호출을 중단
    console.log(`[CLIENT] Stopped infinite playback`);
  }, []);

  // 전체 재생 중지
  const stopPlayback = useCallback(() => {
    console.log(`[CLIENT] Stopping all playback (was playing: ${isPlayingRef.current})`);
    isPlayingRef.current = false;
    stopInfinitePlayback();
    console.log(`[CLIENT] Stopped all playback`);
  }, [stopInfinitePlayback]);

  // 메인 재생 함수
  const playAudioData = useCallback(
    async (audioData: AudioData | null) => {
      if (!audioData || !audioData.segments || audioData.segments.length === 0) {
        console.log('[CLIENT] No audio data to play');
        return;
      }

      // 이전 재생 중지
      stopPlayback();

      // 세그먼트 재생
      await playSegments(audioData.segments);

      // 무한재생 시작
      if (audioData.infiniteTag) {
        isPlayingRef.current = true; // 무한재생을 위해 true로 설정
        startInfinitePlayback(audioData.infiniteTag, audioData.infiniteEffectUrl);
      } else {
        // 무한재생이 없으면 재생 상태를 false로 설정
        isPlayingRef.current = false;
      }
    },
    [playSegments, startInfinitePlayback, stopPlayback],
  );

  return {
    playAudioData,
    stopPlayback,
    isPlaying: isPlayingRef.current,
  };
};
