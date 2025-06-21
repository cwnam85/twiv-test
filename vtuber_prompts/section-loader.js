import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

class SectionLoader {
  constructor(character) {
    this.character = character;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.sharedPath = path.join(__dirname, 'shared');
    this.characterPath = path.join(__dirname, `characters/${character}`);
  }

  // 공통 섹션들
  loadConfiguration() {
    return this.loadSharedFile('configuration.md');
  }

  loadSharedGuidelines(isNSFW = false) {
    let guidelines = this.loadSharedFile('guidelines.md');

    if (isNSFW) {
      // mature content를 user-interaction 다음에 삽입
      const matureContent = this.loadSharedFile('guidelines/mature-content.md');
      guidelines = guidelines.replace('[Violent Content]', matureContent + '\n\n[Violent Content]');
    }

    return guidelines;
  }

  loadAffinity() {
    return this.loadSharedFile('affinity.md');
  }

  loadAdditionalInstructions() {
    return this.loadSharedFile('additional-instructions.md');
  }

  // 캐릭터별 섹션들
  loadCharacterProfile(isNSFW = false) {
    let profile = this.loadCharacterFile('profile.md');

    if (isNSFW) {
      // 포즈를 NSFW 버전으로 교체
      const nsfwPoses = this.loadSharedFile('poses/poses-nsfw.md');
      const sfwPoses = this.loadSharedFile('poses/poses-sfw.md');
      profile = profile.replace(sfwPoses, nsfwPoses);
    }

    return profile;
  }

  // 헬퍼 메서드들
  loadSharedFile(relativePath) {
    const filePath = path.join(this.sharedPath, relativePath);
    return this.loadFile(filePath);
  }

  loadCharacterFile(relativePath) {
    const filePath = path.join(this.characterPath, relativePath);
    return this.loadFile(filePath);
  }

  loadFile(filePath) {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
    console.warn(`File not found: ${filePath}`);
    return '';
  }

  // 전체 프롬프트 조합
  buildPrompt(isNSFW = false) {
    const sections = [
      this.loadConfiguration(),
      this.loadCharacterProfile(isNSFW), // references (포즈와 affinity 포함)
      this.loadSharedGuidelines(isNSFW), // 가이드라인들 (mature content 포함)
      this.loadAdditionalInstructions(),
    ];

    return sections.filter((section) => section.trim()).join('\n\n');
  }
}

export default SectionLoader;
