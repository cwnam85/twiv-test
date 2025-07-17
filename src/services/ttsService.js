import axios from 'axios';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import Speaker from 'speaker';
import { characterVoiceMaps } from '../data/voiceMaps.js';

export async function playTTSSupertone(response, emotion, returnFilePath = false) {
  // 현재 활성화된 캐릭터의 voice map 가져오기
  const activeCharacter = process.env.ACTIVE_CHARACTER || 'shaki';
  const voiceIdMap = characterVoiceMaps[activeCharacter] || characterVoiceMaps['shaki'];

  const voiceId = voiceIdMap[emotion] || voiceIdMap['neutral']; // 기본값은 neutral
  const url = `https://supertoneapi.com/v1/text-to-speech/${voiceId}?output_format=mp3`;

  const data = {
    text: response,
    language: 'ko',
    model: 'sona_speech_1',
    voice_settings: {
      pitch_shift: 0,
      pitch_variance: 1,
      speed: 1,
    },
  };

  const headers = {
    'x-sup-api-key': process.env.SUPERTONE_API_KEY,
    'Content-Type': 'application/json',
  };

  // 고유한 파일명 생성 (타임스탬프 + 랜덤)
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  const mp3FilePath = `./tts_${timestamp}_${random}.mp3`;

  try {
    // API 호출하여 바이너리 오디오 스트림 받기
    const apiResponse = await axios.post(url, data, {
      headers,
      responseType: 'arraybuffer', // 바이너리 데이터로 받기
    });

    // 오디오 길이 확인
    const audioLength = apiResponse.headers['x-audio-length'];

    // 오디오 데이터를 파일로 저장
    fs.writeFileSync(mp3FilePath, apiResponse.data);

    // returnFilePath가 true이면 파일 경로만 반환하고 재생하지 않음
    if (returnFilePath) {
      console.log(`[TTS] File created for later playback: ${mp3FilePath}`);
      return Promise.resolve(mp3FilePath);
    }

    // 스피커로 재생
    const speaker = new Speaker({
      channels: 2,
      bitDepth: 16,
      sampleRate: 44100,
    });

    return new Promise((resolve, reject) => {
      let playbackStarted = false;
      let playbackEnded = false;
      const startTime = Date.now();

      const ffmpegProcess = ffmpeg(mp3FilePath)
        .inputFormat('mp3')
        .audioChannels(2)
        .audioFrequency(44100)
        .toFormat('s16le')
        .on('start', () => {
          playbackStarted = true;
        })
        .on('error', (err) => {
          console.error('Error during playback:', err.message);
          // 에러 발생 시 임시 파일 삭제
          try {
            fs.unlinkSync(mp3FilePath);
          } catch (unlinkError) {
            console.error('Error deleting temp file:', unlinkError);
          }
          reject(err);
        })
        .on('end', () => {
          playbackEnded = true;

          // returnFilePath가 true가 아닐 때만 파일 삭제
          if (!returnFilePath) {
            try {
              fs.unlinkSync(mp3FilePath);
            } catch (unlinkError) {
              console.error('Error deleting temp file:', unlinkError);
            }
          }

          // 실제 오디오 길이만큼 대기 (오디오 길이가 없으면 기본값 사용)
          const duration = audioLength ? parseFloat(audioLength) * 1000 : 3000; // 기본 3초
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, duration - elapsed);

          setTimeout(() => {
            if (returnFilePath) {
              resolve(mp3FilePath); // 파일 경로 반환
            } else {
              resolve();
            }
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
  } catch (error) {
    console.error('Error calling Supertone API:', error.message);
    throw error;
  }
}
