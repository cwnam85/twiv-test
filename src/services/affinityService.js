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

  updateAffinity(change) {
    this.affinity += change;
    this.affinity = Math.max(0, this.affinity); // affinity가 음수가 되지 않도록 처리
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
    };
  }

  hasEnoughPoints(required = 1) {
    return this.point >= required;
  }
}

export default new AffinityService();
