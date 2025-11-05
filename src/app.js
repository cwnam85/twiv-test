import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import chatRouter from './routers/chat.router.js';
import shopRouter from './routers/shop.router.js';
import characterService from './services/characterService.js';

// 환경 변수 로드
dotenv.config();

const app = express();
const port = 3333;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

app.use('/', chatRouter);
app.use('/shop', shopRouter);

// 오디오 파일 제공 API
app.use('/api/audio', express.static(path.join(__dirname, '..')));
// 효과음 파일 제공 API
app.use('/api/effects', express.static(path.join(__dirname, '../mature_tts')));
// blacknila 효과음 파일 제공 API
app.use('/api/effects/blacknila', express.static(path.join(__dirname, '../mature_tts/blacknila')));

// 랜덤 효과음 API
app.get('/api/effects/random/:effectType', (req, res) => {
  try {
    const { effectType } = req.params;
    const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';

    // NSFW 효과음은 기본 폴더 사용
    const nsfwEffectTypes = ['touching', 'insertion', 'intercourse', 'boobjob'];
    let effectDir;

    if (nsfwEffectTypes.includes(effectType)) {
      effectDir = path.join(__dirname, '../mature_tts', effectType);
    } else {
      // 일반 효과음은 캐릭터별 폴더 우선
      const characterSpecificDir = path.join(
        __dirname,
        '../mature_tts',
        activeCharacter,
        effectType,
      );
      if (fs.existsSync(characterSpecificDir)) {
        effectDir = characterSpecificDir;
      } else {
        effectDir = path.join(__dirname, '../mature_tts', effectType);
      }
    }

    if (!fs.existsSync(effectDir)) {
      return res.status(404).json({ error: `Effect directory not found: ${effectDir}` });
    }

    const files = fs.readdirSync(effectDir).filter((file) => file.endsWith('.mp3'));
    if (files.length === 0) {
      return res.status(404).json({ error: `No MP3 files found in: ${effectDir}` });
    }

    const randomFile = files[Math.floor(Math.random() * files.length)];

    // 캐릭터 전용 폴더를 사용 중인지 확인
    const isUsingCharacterFolder = effectDir.includes(`/${activeCharacter}/`);
    const url = isUsingCharacterFolder
      ? `/api/effects/${activeCharacter}/${effectType}/${randomFile}`
      : `/api/effects/${effectType}/${randomFile}`;

    res.json({ url });
  } catch (error) {
    console.error(`[API] Error getting random effect:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 정적 파일 제공 설정
app.use(express.static(path.join(__dirname, '../front/dist')));

// 모든 요청을 index.html로 리다이렉트 (SPA 지원)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../front/dist/index.html'));
});

app.listen(port, () => {
  console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
