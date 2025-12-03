import fs from 'fs';
import path from 'path';

// 감정별 스토리 포인트 맵핑
const EMOTION_STORY_POINTS = {
  Neutral: 1,
  Happy: 4,
  Funny: 3,
  Affectionate: 3,
  Annoyed: 3,
  Sad: 3,
  Embarrassed: 3,
  Dominating: 3,
  Aroused: 4,
  Angry: 4,
};

class StoryPointService {
  constructor() {
    this.storyPointFilePath = path.join(process.cwd(), 'src', 'data', 'storyPoint.json');
    this.storyPoint = 0; // ✅ 메모리에 캐시
    this.loadStoryPoint(); // ✅ 초기화 시 로드
  }

  // ✅ 파일에서 스토리 포인트 로드 (초기화 및 재로드용)
  loadStoryPoint() {
    try {
      if (fs.existsSync(this.storyPointFilePath)) {
        const data = fs.readFileSync(this.storyPointFilePath, 'utf8');
        const parsed = JSON.parse(data);
        this.storyPoint = parsed.storyPoint || 0;
        console.log(`[STORY POINT] Loaded from file: ${this.storyPoint}`);
      } else {
        // 파일이 없으면 초기화
        this.storyPoint = 0;
        this.saveStoryPoint();
        console.log('[STORY POINT] Initialized with 0 points');
      }
    } catch (error) {
      console.error('[STORY POINT] Error loading story point:', error);
      this.storyPoint = 0;
    }
  }

  // ✅ 현재 스토리 포인트 가져오기 (메모리에서)
  getStoryPoint() {
    return this.storyPoint;
  }

  // ✅ 스토리 포인트 저장 (메모리 → 파일)
  saveStoryPoint() {
    try {
      const data = { storyPoint: this.storyPoint };
      fs.writeFileSync(this.storyPointFilePath, JSON.stringify(data, null, 2));
      console.log(`[STORY POINT] Saved to file: ${this.storyPoint}`);
    } catch (error) {
      console.error('[STORY POINT] Error saving story point:', error);
    }
  }

  // ✅ 스토리 포인트 증가 (메모리 업데이트 + 파일 저장)
  addStoryPoint(points) {
    this.storyPoint += points;
    this.saveStoryPoint();
    console.log(`[STORY POINT] +${points} → Total: ${this.storyPoint}`);
    return this.storyPoint;
  }

  // 채팅 입력 시 기본 +1 증가
  addChatInputPoint() {
    return this.addStoryPoint(1);
  }

  // 감정에 따른 포인트 증가
  addEmotionPoint(emotion) {
    const points = EMOTION_STORY_POINTS[emotion] || 1;
    console.log(`[STORY POINT] Emotion '${emotion}' → +${points}`);
    return this.addStoryPoint(points);
  }

  // 스토리 포인트 리셋 (관리자용)
  resetStoryPoint() {
    this.storyPoint = 0;
    this.saveStoryPoint();
    console.log('[STORY POINT] Reset to 0');
    return 0;
  }

  // 감정별 포인트 맵핑 가져오기
  getEmotionPointMapping() {
    return EMOTION_STORY_POINTS;
  }

  // ✅ 전체 데이터 가져오기 (affinityService.getData()와 유사)
  getData() {
    return {
      storyPoint: this.storyPoint,
    };
  }
}

export default new StoryPointService();

