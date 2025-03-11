// src/server.js
import express from 'express';

const app = express();
const port = 3333;

app.use(express.json());

app.listen(port, () => {
  console.log(`서버가 http://localhost:${port}에서 실행 중입니다.`);
});
