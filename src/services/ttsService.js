import axios from 'axios';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import Speaker from 'speaker';

export async function playTTSSupertone(response, emotion) {
  // 감정에 따른 voice_id 매핑
  const voiceIdMap = {
    'neutral': '1ZGUVjuoNk52se64NfSpVN',
    'happy': 'fzMCAQiQ5ttUSAvbFoco6a',
    'funny': '5cwZd6ujcYQKLx9fG3ahH7',
    'affectionate': 'jM5CATR5x6TgJx5JWUt5HV',
    'annoyed': '3WecMGvANcdunskVJNZyez',
    'sad': '1ZGUVjuoNk52se64NfSpVN',
    'embarrassed': 'ob4wAp1heaDzEqDepEpJ5Z',
    'dominating': 'axwTSPmp7hCxS4r5HmV8aP'
  };

  const voiceId = voiceIdMap[emotion] || '1ZGUVjuoNk52se64NfSpVN';  // 기본값은 neutral
  const url = `https://supertoneapi.com/sandbox/text-to-speech/${voiceId}?output_format=mp3`;

  const data = {
    text: response,
    language: 'ko',
    model: "sona_speech_1",
    voice_settings: {
      pitch_shift: 0,
      pitch_variance: 1,
      speed: 1
    }
  };

  const headers = {
    'x-sup-api-key': process.env.SUPERTONE_API_KEY,
    'Content-Type': 'application/json'
  };

  const mp3FilePath = './tts_sync.mp3';

  try {
    // API 호출하여 바이너리 오디오 스트림 받기
    const apiResponse = await axios.post(url, data, {
      headers,
      responseType: 'arraybuffer'  // 바이너리 데이터로 받기
    });

    // 오디오 길이 확인 (디버깅용)
    const audioLength = apiResponse.headers['x-audio-length'];
    if (audioLength) {
      console.log(`Audio length: ${audioLength} seconds`);
    }

    // 오디오 데이터를 파일로 저장
    fs.writeFileSync(mp3FilePath, apiResponse.data);

    // 스피커로 재생
    const speaker = new Speaker({
      channels: 2,
      bitDepth: 16,
      sampleRate: 44100
    });

    return new Promise((resolve, reject) => {
      ffmpeg(mp3FilePath)
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

  } catch (error) {
    console.error('Error calling Supertone API:', error.message);
    throw error;
  }
}
