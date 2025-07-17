import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import Speaker from 'speaker';
import path from 'path';
import { fileURLToPath } from 'url';
// audioConfig.js 파일이 제거되었으므로 import 제거

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

// playMatureTTS 함수 제거 - 클라이언트에서 오디오 재생 처리

// 오디오 처리 함수들 제거 - 클라이언트에서 처리
