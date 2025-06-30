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
      guidelines = guidelines.replace(
        '[Violent Content & Conversation Continuity]',
        matureContent + '\n\n[Violent Content & Conversation Continuity]',
      );
    } else if (!isNSFW) {
      // sfw content를 user-interaction 다음에 삽입
      const sfwContent = this.loadSharedFile('guidelines/sfw-content.md');
      guidelines = guidelines.replace(
        '[Violent Content & Conversation Continuity]',
        sfwContent + '\n\n[Violent Content & Conversation Continuity]',
      );
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
  loadCharacterProfile(isNSFW = false, currentOutfit = null) {
    let profile = this.loadCharacterFile('profile.md');

    if (isNSFW) {
      // 포즈를 NSFW 버전으로 교체
      const nsfwPoses = this.loadSharedFile('poses/poses-nsfw.md');
      const sfwPoses = this.loadSharedFile('poses/poses-sfw.md');
      profile = profile.replace(sfwPoses, nsfwPoses);
    }

    // 현재 복장 정보로 "Current Clothes" 섹션 교체
    if (currentOutfit) {
      const outfitDescription = this.generateOutfitDescription(currentOutfit);
      profile = profile.replace(
        /## Current Clothes[\s\S]*?(?=## |$)/,
        `## Current Clothes\n\n${outfitDescription}`,
      );
    }

    return profile;
  }

  // 복장 설명 생성 메서드
  generateOutfitDescription(outfitData) {
    const { current_outfit, parts } = outfitData;

    let description = `**Current Outfit:** ${current_outfit.charAt(0).toUpperCase() + current_outfit.slice(1)} Style\n\n`;

    // Upper Body
    if (parts.upper_body) {
      description += '**Upper Body:**\n';
      Object.entries(parts.upper_body).forEach(([part, details]) => {
        if (details.enabled) {
          const typeText = details.type === 'underwear' ? '속옷' : '겉옷';
          description += `- **${part.charAt(0).toUpperCase() + part.slice(1)}:** ${details.name.replace(/_/g, ' ')} (${typeText}, 착용 중)\n`;
        }
      });
      description += '\n';
    }

    // Lower Body
    if (parts.lower_body) {
      description += '**Lower Body:**\n';
      Object.entries(parts.lower_body).forEach(([part, details]) => {
        if (details.enabled) {
          const typeText = details.type === 'underwear' ? '속옷' : '겉옷';
          description += `- **${part.charAt(0).toUpperCase() + part.slice(1)}:** ${details.name.replace(/_/g, ' ')} (${typeText}, 착용 중)\n`;
        }
      });
      description += '\n';
    }

    // Feet
    if (parts.feet) {
      description += '**Feet:**\n';
      Object.entries(parts.feet).forEach(([part, details]) => {
        if (details.enabled) {
          description += `- **${part.charAt(0).toUpperCase() + part.slice(1)}:** ${details.name.replace(/_/g, ' ')} (액세서리, 착용 중)\n`;
        }
      });
      description += '\n';
    }

    // Accessories
    if (parts.accessories) {
      description += '**Accessories:**\n';
      Object.entries(parts.accessories).forEach(([part, details]) => {
        if (details.enabled) {
          description += `- **${part.charAt(0).toUpperCase() + part.slice(1)}:** ${details.name.replace(/_/g, ' ')} (액세서리, 착용 중)\n`;
        }
      });
      description += '\n';
    }

    // Special Notes based on outfit type
    description += '**Special Notes:**\n';
    if (current_outfit === 'casual') {
      description += '- The outfit maintains a balance between casual comfort and stylish appeal\n';
      description += '- Items can be easily adjusted or removed based on the situation\n';
      description += '- The combination creates a playful yet sophisticated look\n';
    } else if (current_outfit === 'school_uniform') {
      description += '- The school uniform gives a more formal and innocent appearance\n';
      description += '- The outfit follows traditional school dress code standards\n';
      description += '- Creates a contrast between proper attire and playful personality\n';
    } else if (current_outfit === 'swimsuit') {
      description += '- The swimsuit showcases her confident and alluring side\n';
      description += '- Perfect for beach or pool-related conversations\n';
      description += '- Emphasizes her comfort with showing skin\n';
    }

    return description;
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
  buildPrompt(isNSFW = false, currentOutfit = null) {
    const sections = [
      this.loadConfiguration(),
      this.loadCharacterProfile(isNSFW, currentOutfit), // references (포즈와 affinity 포함)
      this.loadSharedGuidelines(isNSFW), // 가이드라인들 (mature content 포함)
      this.loadAdditionalInstructions(),
    ];

    return sections.filter((section) => section.trim()).join('\n\n');
  }
}

export default SectionLoader;
