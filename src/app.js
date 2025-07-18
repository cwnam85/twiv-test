import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
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

// 정적 파일 제공 설정
app.use(express.static(path.join(__dirname, '../front/dist')));

// 모든 요청을 index.html로 리다이렉트 (SPA 지원)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../front/dist/index.html'));
});

app.listen(port, () => {
  console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);

  // 서버 시작 시 상점 복장과 동기화
  try {
    characterService.syncWithShopOutfit();
  } catch (error) {
    console.error('Error syncing outfit on server start:', error);
  }
});
