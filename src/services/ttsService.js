import axios from 'axios';
import fs from 'fs';
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

    // 현재는 파일만 생성하고 클라이언트에서 재생하므로 파일 경로 반환
    console.log(`[TTS] File created for client playback: ${mp3FilePath}`);
    return Promise.resolve(mp3FilePath);
  } catch (error) {
    console.error('Error calling Supertone API:', error.message);
    throw error;
  }
}

// 재생 완료 후 삭제 방식으로 변경되었으므로 정리 함수들 제거
