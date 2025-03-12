import axios from 'axios';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import Speaker from 'speaker';

export async function playTTSSupertone(response, mode = 'sync') {
  let data = {
    text: response,
    language: 'ko',
    voice_settings: {
      pitch_shift: 0,
      pitch_variance: 1,
      speed: 1.0,
    },
  };

  const headers = {
    'x-sup-api-key': process.env.SUPERTONE_API_KEY,
    'Content-Type': 'application/json',
  };

  const mp3FilePath = mode === 'sync' ? './tts_sync.mp3' : './tts_async.mp3';

  await axios
    .post(
      'https://supertoneapi.com/v1/text-to-speech/oSqpQU9AAKNwfsSLnu9BTV?output_format=mp3',
      data,
      { headers, responseType: 'arraybuffer' },
    )
    .then((response) => {
      fs.writeFileSync(mp3FilePath, response.data, 'binary');
    })
    .catch((error) => {
      console.error(`Error: ${error.message}`);
    });

  const speaker = new Speaker({
    channels: 2,
    bitDepth: 16,
    sampleRate: 44100,
  });

  return new Promise((resolve, reject) => {
    ffmpeg(mp3FilePath)
      .inputFormat('mp3')
      .audioChannels(2)
      .audioFrequency(44100)
      .toFormat('s16le')
      .on('error', (err) => {
        console.error('Error during playback:', err.message);
      })
      .on('end', () => {
        //console.log(`[${mode}] Playback finished.`);
        resolve();
      })
      .pipe(speaker);
  });
}
