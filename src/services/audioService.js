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

export function playMatureTTS(type) {
  return new Promise((resolve, reject) => {
    const matureTTSDir = path.join(__dirname, '../../mature_tts', type);

    // 해당 폴더의 모든 mp3 파일 읽기
    fs.readdir(matureTTSDir, (err, files) => {
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
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
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

        ffmpeg(audioPath)
          .inputFormat('mp3')
          .audioChannels(2)
          .audioFrequency(44100)
          .toFormat('s16le')
          .on('start', () => {
            playbackStarted = true;
          })
          .on('error', (err) => {
            console.error('Error during mature TTS playback:', err.message);
            reject(err);
          })
          .on('end', () => {
            playbackEnded = true;

            // 실제 오디오 길이만큼 대기
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, durationMs - elapsed);

            setTimeout(() => {
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
    });
  });
}
