import axios from 'axios';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import Speaker from 'speaker';
import { characterVoiceMaps } from '../data/voiceMaps.js';
import { applyFadeIn, applyFadeOut, applyVolumeBoost } from './audioService.js';
import { AUDIO_FADE_CONFIG } from '../config/audioConfig.js';

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

    // 스피커로 재생 (PCM 버퍼 가공: 페이드 아웃 config 적용)
    const speaker = new Speaker({
      channels: 2,
      bitDepth: 16,
      sampleRate: 44100,
    });

    return new Promise(async (resolve, reject) => {
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

          // 페이드 효과 적용 (TTS는 항상 처음/마지막 적용)
          processedAudio = applyFadeIn(processedAudio, AUDIO_FADE_CONFIG.fadeInDuration, 44100);
          processedAudio = applyFadeOut(
            processedAudio,
            AUDIO_FADE_CONFIG.fadeOutDuration,
            44100,
            AUDIO_FADE_CONFIG.minFadeVolume,
          );

          // 필요시 음량 증폭 (TTS는 config)
          processedAudio = applyVolumeBoost(processedAudio, AUDIO_FADE_CONFIG.ttsVolumeBoost);

          speaker.write(processedAudio);
          speaker.end();

          speaker.on('close', () => {
            // 파일 삭제
            try {
              fs.unlinkSync(mp3FilePath);
            } catch (e) {}
            resolve();
          });
        } catch (error) {
          try {
            fs.unlinkSync(mp3FilePath);
          } catch (e) {}
          reject(error);
        }
      });

      ffmpeg(mp3FilePath)
        .inputFormat('mp3')
        .audioChannels(2)
        .audioFrequency(44100)
        .toFormat('s16le')
        .on('error', (err) => {
          try {
            fs.unlinkSync(mp3FilePath);
          } catch (e) {}
          reject(err);
        })
        .pipe(passThrough);
    });
  } catch (error) {
    console.error('Error calling Supertone API:', error.message);
    throw error;
  }
}
