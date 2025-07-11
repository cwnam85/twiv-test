import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import shopService from './shopService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AFFINITY_FILE_PATH = path.join(__dirname, '../data/affinity.json');
const POINT_FILE_PATH = path.join(__dirname, '../data/point.json');

class AffinityService {
  constructor() {
    this.affinity = 0;
    this.point = 100;
    this.maxAffinity = 200; // 호감도 최대치
    this.boosterActive = false;
    this.boosterExpiresAt = null;
    this.loadData();
    this.initializeBoosterStatus(); // 서버 시작 시 부스터 상태 초기화
  }

  loadData() {
    this.loadAffinity();
    this.loadPoint();
  }

  // 서버 시작 시 부스터 상태 초기화
  initializeBoosterStatus() {
    try {
      const shopData = shopService.getOwnedItems();

      if (shopData.activeBooster) {
        const now = new Date();
        const expiresAt = new Date(shopData.activeBooster.expiresAt);

        if (now >= expiresAt) {
          // 만료된 부스터는 비활성화
          this.boosterActive = false;
          this.boosterExpiresAt = null;
          console.log('Booster expired on server start');
        } else {
          // 아직 유효한 부스터는 활성화
          this.boosterActive = true;
          this.boosterExpiresAt = expiresAt;
          console.log('Booster still active on server start');
        }
      } else {
        // 활성화된 부스터가 없으면 비활성화 상태
        this.boosterActive = false;
        this.boosterExpiresAt = null;
      }
    } catch (error) {
      console.error('Error initializing booster status:', error);
      this.boosterActive = false;
      this.boosterExpiresAt = null;
    }
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

  // 부스터 활성화
  activateBooster() {
    const shopData = shopService.getOwnedItems();

    if (!shopData.activeBooster) {
      throw new Error('활성화된 부스터가 없습니다.');
    }

    this.boosterActive = true;
    this.boosterExpiresAt = new Date(shopData.activeBooster.expiresAt);

    // 호감도를 100으로 설정
    this.affinity = 100;
    this.saveAffinity();

    console.log('Booster activated: Affinity set to 100');
    return { success: true, affinity: this.affinity };
  }

  // 부스터 만료 확인 및 처리
  checkBoosterStatus() {
    if (!this.boosterActive || !this.boosterExpiresAt) {
      return { active: false };
    }

    const now = new Date();
    if (now >= this.boosterExpiresAt) {
      // 부스터 만료
      this.boosterActive = false;
      this.boosterExpiresAt = null;
      console.log('Booster expired: Affinity can now change normally');
      return { expired: true };
    }

    return {
      active: true,
      remainingTime: this.boosterExpiresAt.getTime() - now.getTime(),
    };
  }

  updateAffinity(change) {
    // 부스터가 활성화되어 있으면 호감도 변경을 무시
    const boosterStatus = this.checkBoosterStatus();
    if (boosterStatus.active) {
      console.log('Booster active: Affinity change ignored');
      return { affinityChanged: false, newAffinity: this.affinity, boosterActive: true };
    }

    const oldAffinity = this.affinity;
    this.affinity += change;

    // 호감도 범위 제한 (0 ~ maxAffinity)
    this.affinity = Math.max(0, Math.min(this.maxAffinity, this.affinity));

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
    const boosterStatus = this.checkBoosterStatus();
    return {
      affinity: this.affinity,
      point: this.point,
      maxAffinity: this.maxAffinity,
      boosterActive: boosterStatus.active,
      boosterRemainingTime: boosterStatus.active ? boosterStatus.remainingTime : null,
    };
  }

  hasEnoughPoints(required = 1) {
    return this.point >= required;
  }
}

export default new AffinityService();
