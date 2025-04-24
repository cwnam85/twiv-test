import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import chatRouter from './routers/chat.router.js';

const app = express();
const port = 3333;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

app.use('/', chatRouter);

// 정적 파일 제공 설정
app.use(express.static(path.join(__dirname, '../front/dist')));

// 모든 요청을 index.html로 리다이렉트 (SPA 지원)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../front/dist/index.html'));
});

app.listen(port, () => {
  console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
