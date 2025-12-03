import fs from 'fs';
import path from 'path';

class CoercionPointService {
  constructor() {
    this.coercionPointFilePath = path.join(process.cwd(), 'src', 'data', 'coercionPoint.json');
    this.coercionPoint = 0; // 메모리에 캐시
    this.loadCoercionPoint(); // 초기화 시 로드
  }

  // 파일에서 협박도 로드 (초기화 및 재로드용)
  loadCoercionPoint() {
    try {
      if (fs.existsSync(this.coercionPointFilePath)) {
        const data = fs.readFileSync(this.coercionPointFilePath, 'utf8');
        const parsed = JSON.parse(data);
        this.coercionPoint = parsed.coercionPoint || 0;
        console.log(`[COERCION POINT] Loaded from file: ${this.coercionPoint}`);
      } else {
        // 파일이 없으면 초기화
        this.coercionPoint = 0;
        this.saveCoercionPoint();
        console.log('[COERCION POINT] Initialized with 0 points');
      }
    } catch (error) {
      console.error('[COERCION POINT] Error loading coercion point:', error);
      this.coercionPoint = 0;
    }
  }

  // 현재 협박도 가져오기 (메모리에서)
  getCoercionPoint() {
    return this.coercionPoint;
  }

  // 협박도 저장 (메모리 → 파일)
  saveCoercionPoint() {
    try {
      const data = { coercionPoint: this.coercionPoint };
      fs.writeFileSync(this.coercionPointFilePath, JSON.stringify(data, null, 2));
      console.log(`[COERCION POINT] Saved to file: ${this.coercionPoint}`);
    } catch (error) {
      console.error('[COERCION POINT] Error saving coercion point:', error);
    }
  }

  // 협박도 설정 (LLM output 기반)
  setCoercionPoint(points) {
    // 0~100 범위로 제한
    this.coercionPoint = Math.max(0, Math.min(100, points));
    this.saveCoercionPoint();
    console.log(`[COERCION POINT] Set to: ${this.coercionPoint}`);
    return this.coercionPoint;
  }

  // 협박도 증가 (메모리 업데이트 + 파일 저장)
  addCoercionPoint(points) {
    this.coercionPoint = Math.max(0, Math.min(100, this.coercionPoint + points));
    this.saveCoercionPoint();
    console.log(`[COERCION POINT] +${points} → Total: ${this.coercionPoint}`);
    return this.coercionPoint;
  }

  // 협박도 리셋 (관리자용)
  resetCoercionPoint() {
    this.coercionPoint = 0;
    this.saveCoercionPoint();
    console.log('[COERCION POINT] Reset to 0');
    return 0;
  }

  // 전체 데이터 가져오기
  getData() {
    return {
      coercionPoint: this.coercionPoint,
    };
  }
}

export default new CoercionPointService();
