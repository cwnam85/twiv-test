import fs from 'fs';
import path from 'path';

class BackgroundService {
  constructor() {
    this.backgroundsPath = path.join(process.cwd(), 'vtuber_prompts', 'characters');
  }

  // 배경 JSON 파일 로드
  loadBackgroundData(character, backgroundId) {
    try {
      const backgroundPath = path.join(
        this.backgroundsPath,
        character,
        'backgrounds',
        `${backgroundId}.json`,
      );

      if (!fs.existsSync(backgroundPath)) {
        console.warn(`Background file not found: ${backgroundPath}`);
        return null;
      }

      const backgroundData = fs.readFileSync(backgroundPath, 'utf8');
      return JSON.parse(backgroundData);
    } catch (error) {
      console.error(`Error loading background ${backgroundId} for character ${character}:`, error);
      return null;
    }
  }

  // 배경 이름 가져오기 (새로운 JSON 구조 지원)
  getBackgroundName(character, backgroundId) {
    if (!backgroundId || backgroundId === 'default') {
      return 'Default Background';
    }

    const backgroundData = this.loadBackgroundData(character, backgroundId);
    if (backgroundData && backgroundData.name) {
      return backgroundData.name;
    }

    // fallback: 기존 하드코딩된 이름들
    const fallbackNames = {
      school: 'School',
      beach: 'Beach',
      onsen: 'Onsen',
    };

    return fallbackNames[backgroundId] || backgroundId;
  }

  // 배경 설명 가져오기
  getBackgroundDescription(character, backgroundId) {
    if (!backgroundId || backgroundId === 'default') {
      return 'Default background';
    }

    const backgroundData = this.loadBackgroundData(character, backgroundId);
    return backgroundData?.description || 'No description available';
  }

  // 배경의 장소 목록 가져오기
  getBackgroundSpots(character, backgroundId) {
    if (!backgroundId || backgroundId === 'default') {
      return null;
    }

    const backgroundData = this.loadBackgroundData(character, backgroundId);
    return backgroundData?.spots || null;
  }

  // 특정 장소의 정보 가져오기
  getSpotInfo(character, backgroundId, spotName) {
    const spots = this.getBackgroundSpots(character, backgroundId);
    if (!spots || !spotName) {
      return null;
    }

    return spots[spotName] || null;
  }

  // 장소의 기본 의상 가져오기
  getSpotDefaultOutfit(character, backgroundId, spotName) {
    const spotInfo = this.getSpotInfo(character, backgroundId, spotName);
    return spotInfo?.defaultOutfit || null;
  }

  // 장소의 기본 포즈 가져오기
  getSpotDefaultPose(character, backgroundId, spotName) {
    const spotInfo = this.getSpotInfo(character, backgroundId, spotName);
    return spotInfo?.defaultPose || 'stand';
  }

  // 장소에서 허용된 포즈 목록 가져오기
  getSpotAllowedPoses(character, backgroundId, spotName) {
    const spotInfo = this.getSpotInfo(character, backgroundId, spotName);
    return spotInfo?.allowedPoses || ['stand'];
  }

  // 배경의 모든 장소 이름 목록 가져오기
  getSpotNames(character, backgroundId) {
    const spots = this.getBackgroundSpots(character, backgroundId);
    if (!spots) {
      return [];
    }

    return Object.keys(spots);
  }

  // 캐릭터별 사용 가능한 배경 목록 가져오기
  getAvailableBackgrounds(character) {
    try {
      const backgroundsDir = path.join(this.backgroundsPath, character, 'backgrounds');

      if (!fs.existsSync(backgroundsDir)) {
        console.warn(`Backgrounds directory not found: ${backgroundsDir}`);
        return [];
      }

      const files = fs.readdirSync(backgroundsDir);
      const backgrounds = files
        .filter((file) => file.endsWith('.json'))
        .map((file) => {
          const backgroundId = file.replace('.json', '');
          const backgroundData = this.loadBackgroundData(character, backgroundId);

          return {
            id: backgroundId,
            name: backgroundData?.name || backgroundId,
            description: backgroundData?.description || 'No description',
            price: backgroundData?.price || 100,
            hasSpots: backgroundData?.spots ? true : false,
            spotsCount: backgroundData?.spots ? Object.keys(backgroundData.spots).length : 0,
          };
        });

      return backgrounds;
    } catch (error) {
      console.error(`Error getting available backgrounds for ${character}:`, error);
      return [];
    }
  }
}

export default new BackgroundService();
