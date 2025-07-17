import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import Speaker from 'speaker';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function playMP3(filename) {
  return new Promise((resolve, reject) => {
    const audioPath = path.join(__dirname, '../../greeting_tts', filename);

    // 스피커로 재생
    const speaker = new Speaker({
      channels: 2,
      bitDepth: 16,
      sampleRate: 44100,
    });

    ffmpeg(audioPath)
      .inputFormat('mp3')
      .audioChannels(2)
      .audioFrequency(44100)
      .toFormat('s16le')
      .on('error', (err) => {
        console.error('Error during playback:', err.message);
        reject(err);
      })
      .on('end', () => {
        resolve();
      })
      .pipe(speaker);
  });
}

// 페이드 없이 mature 효과음 재생하는 백업 함수
function playMatureTTSWithoutFade(type, audioPath, startTime, durationMs) {
  return new Promise((resolve, reject) => {
    const speaker = new Speaker({
      channels: 2,
      bitDepth: 16,
      sampleRate: 44100,
    });

    let playbackStarted = false;
    let playbackEnded = false;

    ffmpeg(audioPath)
      .inputFormat('mp3')
      .audioChannels(2)
      .audioFrequency(44100)
      .audioFilters('volume=4.0') // 음량 증폭만 적용
      .toFormat('s16le')
      .on('start', () => {
        playbackStarted = true;
      })
      .on('error', (err) => {
        console.error('Error during mature TTS playback without fade:', err.message);
        reject(err);
      })
      .on('end', () => {
        playbackEnded = true;

        // 실제 오디오 길이만큼 대기
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, durationMs - elapsed);

        setTimeout(() => {
          console.log(`[MATURE] ✓ Playback completed (no fade - fallback)`);
          resolve();
        }, remaining);
      })
      .pipe(speaker);

    // 스피커 종료 이벤트도 감지
    speaker.on('close', () => {
      if (playbackEnded) {
        // 스피커 종료 확인 (디버깅용으로 남겨둠)
      }
    });
  });
}

export function playMatureTTS(type, isFirst = false, isLast = false) {
  return new Promise(async (resolve, reject) => {
    const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';

    // 캐릭터별 mature_tts 폴더 경로 결정
    let matureTTSDir;

    // 캐릭터별 폴더가 존재하는지 확인
    const characterSpecificDir = path.join(__dirname, '../../mature_tts', activeCharacter, type);
    const defaultDir = path.join(__dirname, '../../mature_tts', type);

    // 캐릭터별 폴더가 존재하면 사용, 없으면 기본 폴더 사용
    if (fs.existsSync(characterSpecificDir)) {
      matureTTSDir = characterSpecificDir;
    } else {
      matureTTSDir = defaultDir;
    }

    console.log(`Using mature TTS directory for ${activeCharacter}: ${matureTTSDir}`);

    // 해당 폴더의 모든 mp3 파일 읽기
    fs.readdir(matureTTSDir, async (err, files) => {
      if (err) {
        console.error(`Error reading ${type} directory:`, err);
        reject(err);
        return;
      }

      // mp3 파일만 필터링
      const mp3Files = files.filter((file) => file.endsWith('.mp3'));

      if (mp3Files.length === 0) {
        console.warn(`No mp3 files found in ${type} directory`);
        resolve();
        return;
      }

      // 랜덤 파일 선택
      const randomFile = mp3Files[Math.floor(Math.random() * mp3Files.length)];
      const audioPath = path.join(matureTTSDir, randomFile);

      console.log(`Playing ${type} sound: ${randomFile}`);

      // 오디오 길이 확인
      ffmpeg.ffprobe(audioPath, async (err, metadata) => {
        if (err) {
          console.error(`Error getting audio metadata for ${randomFile}:`, err);
          reject(err);
          return;
        }

        const audioDuration = metadata.format.duration; // 초 단위
        const durationMs = audioDuration * 1000; // 밀리초 단위

        // 스피커로 재생
        const speaker = new Speaker({
          channels: 2,
          bitDepth: 16,
          sampleRate: 44100,
        });

        let playbackStarted = false;
        let playbackEnded = false;
        const startTime = Date.now();

        // JavaScript 레벨 페이드 효과 구현
        const audioChunks = [];
        const { PassThrough } = await import('stream');
        const passThrough = new PassThrough();

        // PassThrough 스트림에서 데이터 수집
        passThrough.on('data', (chunk) => {
          audioChunks.push(chunk);
        });

        passThrough.on('end', () => {
          try {
            // 모든 데이터를 하나로 합치기
            const fullAudio = Buffer.concat(audioChunks);
            console.log(`[MATURE] Audio data size: ${fullAudio.length} bytes`);

            // JavaScript로 페이드 효과 적용
            let processedAudio = fullAudio;

            if (!isFirst) {
              console.log(`[MATURE] Applying fade-in effect`);
              processedAudio = applyFadeIn(processedAudio, 0.5); // 0.5초 페이드 인
            }

            if (!isLast) {
              console.log(`[MATURE] Applying fade-out effect`);
              processedAudio = applyFadeOut(processedAudio, 0.5); // 0.5초 페이드 아웃
            }

            // 음량 증폭 적용 (volume=4.0)
            processedAudio = applyVolumeBoost(processedAudio, 4);

            // 처리된 오디오를 Speaker로 재생
            console.log(`[MATURE] Writing ${processedAudio.length} bytes to speaker`);
            speaker.write(processedAudio);
            speaker.end();

            speaker.on('close', () => {
              playbackEnded = true;
              const fadeInfo = [];
              if (!isFirst) fadeInfo.push('fade-in');
              if (!isLast) fadeInfo.push('fade-out');
              console.log(
                `[MATURE] ✓ Playback completed ${fadeInfo.length > 0 ? `(${fadeInfo.join(', ')})` : '(no fade)'}`,
              );
              resolve();
            });
          } catch (error) {
            console.error('[MATURE] Error during audio processing:', error);
            reject(error);
          }
        });

        // ffmpeg로 raw PCM 데이터 추출 (필터 없이)
        ffmpeg(audioPath)
          .inputFormat('mp3')
          .audioChannels(2)
          .audioFrequency(44100)
          .toFormat('s16le')
          .on('error', (err) => {
            console.error(`[MATURE] Error during PCM extraction:`, err);
            reject(err);
          })
          .pipe(passThrough);
      });
    });
  });
}

// 페이드인 효과 적용
function applyFadeIn(pcmData, durationSeconds, sampleRate = 44100) {
  const fadeSamples = Math.floor(durationSeconds * sampleRate);
  const result = Buffer.from(pcmData);

  for (let i = 0; i < fadeSamples; i++) {
    const fadeMultiplier = i / fadeSamples; // 0 ~1.0

    // 스테레오이므로 4리
    const sampleIndex = i * 4;

    // 왼쪽 채널
    const leftSample = result.readInt16LE(sampleIndex);
    const fadedLeft = Math.round(leftSample * fadeMultiplier);
    result.writeInt16LE(fadedLeft, sampleIndex);

    // 오른쪽 채널
    const rightSample = result.readInt16LE(sampleIndex + 2);
    const fadedRight = Math.round(rightSample * fadeMultiplier);
    result.writeInt16LE(fadedRight, sampleIndex + 2);
  }

  return result;
}

// 페이드아웃 효과 적용
function applyFadeOut(pcmData, durationSeconds, sampleRate = 44100) {
  const fadeSamples = Math.floor(durationSeconds * sampleRate);
  const totalSamples = Math.floor(pcmData.length / 4);
  const result = Buffer.from(pcmData);

  for (let i = 0; i < fadeSamples; i++) {
    // 지수 감소 방식으로 더 자연스러운 페이드아웃
    const fadeMultiplier = Math.pow(1.0 - i / fadeSamples, 2); // 1.0
    const sampleIndex = (totalSamples - fadeSamples + i) * 4;

    // 왼쪽 채널
    const leftSample = result.readInt16LE(sampleIndex);
    const fadedLeft = Math.round(leftSample * fadeMultiplier);
    result.writeInt16LE(fadedLeft, sampleIndex);

    // 오른쪽 채널
    const rightSample = result.readInt16LE(sampleIndex + 2);
    const fadedRight = Math.round(rightSample * fadeMultiplier);
    result.writeInt16LE(fadedRight, sampleIndex + 2);
  }

  return result;
}

// 음량 증폭 적용
function applyVolumeBoost(pcmData, volumeMultiplier) {
  const result = Buffer.from(pcmData);

  for (let i = 0; i < result.length; i += 2) {
    const sample = result.readInt16LE(i);
    const boostedSample = Math.max(-32768, Math.min(32767, Math.round(sample * volumeMultiplier)));
    result.writeInt16LE(boostedSample, i);
  }

  return result;
}
