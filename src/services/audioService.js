import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import Speaker from 'speaker';
import path from 'path';
import { fileURLToPath } from 'url';
import { AUDIO_FADE_CONFIG } from '../config/audioConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function playMP3(filename) {
  return new Promise((resolve, reject) => {
    const audioPath = path.join(__dirname, '../../greeting_tts', filename);

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

export function playMatureTTS(type, isFirst = false, isLast = false) {
  return new Promise(async (resolve, reject) => {
    const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';

    // 캐릭터별 mature_tts 폴더 경로 결정
    const characterSpecificDir = path.join(__dirname, '../../mature_tts', activeCharacter, type);
    const defaultDir = path.join(__dirname, '../../mature_tts', type);
    const matureTTSDir = fs.existsSync(characterSpecificDir) ? characterSpecificDir : defaultDir;

    // mp3 파일 읽기
    fs.readdir(matureTTSDir, async (err, files) => {
      if (err) {
        console.error(`Error reading ${type} directory:`, err);
        reject(err);
        return;
      }

      const mp3Files = files.filter((file) => file.endsWith('.mp3'));

      if (mp3Files.length === 0) {
        resolve();
        return;
      }

      // 랜덤 파일 선택
      const randomFile = mp3Files[Math.floor(Math.random() * mp3Files.length)];
      const audioPath = path.join(matureTTSDir, randomFile);

      const speaker = new Speaker({
        channels: 2,
        bitDepth: 16,
        sampleRate: 44100,
      });

      const audioChunks = [];
      const { PassThrough } = await import('stream');
      const passThrough = new PassThrough();

      passThrough.on('data', (chunk) => {
        audioChunks.push(chunk);
      });

      passThrough.on('end', () => {
        try {
          const fullAudio = Buffer.concat(audioChunks);
          let processedAudio = fullAudio;

          // 페이드 효과 적용
          if (!isFirst) {
            processedAudio = applyFadeIn(processedAudio, AUDIO_FADE_CONFIG.fadeInDuration, 44100);
          }

          if (!isLast) {
            processedAudio = applyFadeOut(
              processedAudio,
              AUDIO_FADE_CONFIG.fadeOutDuration,
              44100,
              AUDIO_FADE_CONFIG.minFadeVolume,
            );
          }

          // 음량 증폭 적용 (config)
          processedAudio = applyVolumeBoost(processedAudio, AUDIO_FADE_CONFIG.effectVolumeBoost);

          // 재생
          speaker.write(processedAudio);
          speaker.end();

          speaker.on('close', () => {
            resolve();
          });
        } catch (error) {
          reject(error);
        }
      });

      // ffmpeg로 PCM 데이터 추출
      ffmpeg(audioPath)
        .inputFormat('mp3')
        .audioChannels(2)
        .audioFrequency(44100)
        .toFormat('s16le')
        .on('error', (err) => {
          console.error('Error during PCM extraction:', err);
          reject(err);
        })
        .pipe(passThrough);
    });
  });
}

// 페이드인 효과 적용 함수
function applyFadeIn(pcmData, durationSeconds, sampleRate = 44100) {
  const fadeSamples = Math.floor(durationSeconds * sampleRate);
  const result = Buffer.from(pcmData);

  for (let i = 0; i < fadeSamples; i++) {
    const fadeMultiplier = i / fadeSamples; // 0 ~1.0

    // 스테레오이므로 4바이트
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

// 페이드아웃 효과 적용 함수
function applyFadeOut(pcmData, durationSeconds, sampleRate = 44100, minFadeVolume = 0.2) {
  const fadeSamples = Math.floor(durationSeconds * sampleRate);
  const totalSamples = Math.floor(pcmData.length / 4);
  const result = Buffer.from(pcmData);

  for (let i = 0; i < fadeSamples; i++) {
    // 지수 감소 방식으로 더 자연스러운 페이드아웃
    const fadeMultiplier =
      minFadeVolume + (1.0 - minFadeVolume) * Math.pow(1.0 - i / fadeSamples, 2); // 1.0 → minFadeVolume
    const sampleIndex = (totalSamples - fadeSamples + i) * 4;

    // 왼쪽 채널
    const leftSample = result.readInt16LE(sampleIndex);
    const fadedLeft = Math.max(-32768, Math.min(32767, Math.round(leftSample * fadeMultiplier)));
    result.writeInt16LE(fadedLeft, sampleIndex);

    // 오른쪽 채널
    const rightSample = result.readInt16LE(sampleIndex + 2);
    const fadedRight = Math.max(-32768, Math.min(32767, Math.round(rightSample * fadeMultiplier)));
    result.writeInt16LE(fadedRight, sampleIndex + 2);
  }

  return result;
}

// 음량 증폭 적용 함수
function applyVolumeBoost(pcmData, volumeMultiplier) {
  const result = Buffer.from(pcmData);

  for (let i = 0; i < result.length; i += 2) {
    const sample = result.readInt16LE(i);
    const boostedSample = Math.max(-32768, Math.min(32767, Math.round(sample * volumeMultiplier)));
    result.writeInt16LE(boostedSample, i);
  }

  return result;
}

// 함수들을 export
export { applyFadeIn, applyFadeOut, applyVolumeBoost };
