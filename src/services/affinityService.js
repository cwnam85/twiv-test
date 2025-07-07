import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AFFINITY_FILE_PATH = path.join(__dirname, '../data/affinity.json');
const POINT_FILE_PATH = path.join(__dirname, '../data/point.json');

class AffinityService {
  constructor() {
    this.affinity = 0;
    this.point = 100;
    this.timerId = null; // 타이머 ID 저장
    this.loadData();
  }

  loadData() {
    this.loadAffinity();
    this.loadPoint();
  }

  loadAffinity() {
    try {
      if (fs.existsSync(AFFINITY_FILE_PATH)) {
        const data = fs.readFileSync(AFFINITY_FILE_PATH, 'utf8');
        const parsed = JSON.parse(data);
        this.affinity = parsed.affinity || 0;
      }
    } catch (error) {
      console.error('Error loading affinity data:', error);
    }
  }

  loadPoint() {
    try {
      if (fs.existsSync(POINT_FILE_PATH)) {
        const data = fs.readFileSync(POINT_FILE_PATH, 'utf8');
        const parsed = JSON.parse(data);
        this.point = parsed.point || 100;
      }
    } catch (error) {
      console.error('Error loading point data:', error);
    }
  }

  saveAffinity() {
    try {
      const dataDir = path.dirname(AFFINITY_FILE_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(
        AFFINITY_FILE_PATH,
        JSON.stringify(
          {
            affinity: this.affinity,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      console.error('Error saving affinity data:', error);
    }
  }

  savePoint() {
    try {
      const dataDir = path.dirname(POINT_FILE_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(POINT_FILE_PATH, JSON.stringify({ point: this.point }, null, 2));
    } catch (error) {
      console.error('Error saving point data:', error);
    }
  }

  // 타이머 만료 알림 전송
  async sendTimerExpiredNotification() {
    try {
      const { sendMessageToWarudo } = await import('../services/warudoService.js');
      const notificationMessage = JSON.stringify({
        action: 'TimerExpired',
        data: {
          message: '호감도 타이머가 만료되었습니다!',
          affinity: this.affinity,
        },
      });
      await sendMessageToWarudo(notificationMessage);
    } catch (error) {
      console.error('Error sending timer expired notification:', error);
    }
  }

  // 타이머 시작 메서드
  startTimer() {
    // 기존 타이머가 있으면 취소
    if (this.timerId) {
      clearTimeout(this.timerId);
    }

    // 5분 후에 호감도를 50으로 설정
    this.timerId = setTimeout(
      async () => {
        console.log('Timer expired: Affinity reset to 50');
        this.affinity = 50;
        this.saveAffinity();
        this.timerId = null;

        // 타이머 만료 알림 전송
        await this.sendTimerExpiredNotification();

        // 시스템 프롬프트 업데이트를 위해 characterService 호출
        const characterService = await import('./characterService.js');
        characterService.default.updateSystemPrompt();
      },
      5 * 60 * 1000,
    ); // 5분

    console.log('Timer started: Affinity will reset to 50 in 5 minutes');
  }

  // 타이머 취소 메서드
  cancelTimer() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
      console.log('Timer cancelled');
    }
  }

  // 타이머 상태 확인 메서드
  getTimerStatus() {
    return {
      hasTimer: this.timerId !== null,
      remainingTime: this.timerId ? this.getRemainingTime() : null,
    };
  }

  // 남은 시간 계산 (대략적)
  getRemainingTime() {
    // 타이머가 시작된 시간을 저장하지 않으므로 정확한 시간은 계산할 수 없음
    // 필요하다면 타이머 시작 시간을 저장하는 로직을 추가할 수 있음
    return '약 5분';
  }

  updateAffinity(change) {
    const oldAffinity = this.affinity;
    this.affinity += change;
    this.affinity = Math.max(0, this.affinity); // affinity가 음수가 되지 않도록 처리

    // 호감도가 100 이상이 되면 타이머 시작
    if (this.affinity >= 100 && oldAffinity < 100) {
      this.startTimer();
    }
    // 호감도가 100 미만으로 떨어지면 타이머 취소
    else if (this.affinity < 100 && oldAffinity >= 100) {
      this.cancelTimer();
    }

    this.saveAffinity();
    return { affinityChanged: true, newAffinity: this.affinity };
  }

  updatePoint(change) {
    this.point = Math.max(0, this.point + change);
    this.savePoint();
    return this.point;
  }

  deductPoint(amount = 1) {
    return this.updatePoint(-amount);
  }

  getData() {
    return {
      affinity: this.affinity,
      point: this.point,
      timerStatus: this.getTimerStatus(),
    };
  }

  hasEnoughPoints(required = 1) {
    return this.point >= required;
  }
}

export default new AffinityService();
