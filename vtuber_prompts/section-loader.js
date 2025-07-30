import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nunjucks from 'nunjucks';
import shopService from '../src/services/shopService.js';

class SectionLoader {
  constructor(character) {
    this.character = character;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.sharedPath = path.join(__dirname, 'shared');
    this.characterPath = path.join(__dirname, `characters/${character}`);

    // nunjucks 환경 설정 - 여러 경로 추가
    this.env = nunjucks.configure(
      [
        this.characterPath, // 캐릭터 폴더
        this.sharedPath, // 공통 폴더
        __dirname, // 루트 폴더
      ],
      {
        autoescape: false, // 마크다운 텍스트이므로 이스케이프 비활성화
        trimBlocks: true,
        lstripBlocks: true,
      },
    );
  }

  // 줄바꿈 문자 정규화 함수
  normalizeLineEndings(text) {
    if (!text) return text;

    // \r\n을 \n으로 변환
    return text
      .replace(/\r\n/g, '\n') // Windows CRLF를 LF로
      .replace(/\r/g, '\n'); // Mac CR을 LF로
  }

  // shopService 인스턴스 가져오기
  getShopService() {
    try {
      // 동적 import로 shopService 가져오기
      const shopService = require('../src/services/shopService.js').default;
      return shopService;
    } catch (error) {
      console.error('Error getting shop service:', error);
      return null;
    }
  }

  // 활성화된 RP팩 정보 가져오기
  getActiveRpPack() {
    try {
      // shopService를 통해 활성화된 RP팩 정보 가져오기
      const result = shopService.getActiveRpPack();
      return result;
    } catch (error) {
      console.error('Error getting active RP pack:', error);
      return null;
    }
  }

  // RP팩 내용을 프롬프트에 삽입
  insertRpPackContent(renderedPrompt, activeRpPack) {
    try {
      const rpPackId = activeRpPack.id;

      // RP팩별 파일 경로 매핑
      const rpPackFiles = {
        onsen_rp_pack: {
          description: 'onsendate/description.md',
          globalnote: 'onsendate/globalnote.md',
          locationguide: 'onsendate/locationguide.md',
        },
      };

      const files = rpPackFiles[rpPackId];
      if (!files) {
        console.warn(`Unknown RP pack ID: ${rpPackId}`);
        return renderedPrompt;
      }

      // RP팩 내용을 통합하여 rp_pack_content.md에 저장
      let rpPackContent = '';

      // 1. description.md 내용 추가
      const descriptionContent = this.readRpPackFile(files.description);
      if (descriptionContent) {
        rpPackContent += descriptionContent + '\n\n';
      }

      // 2. globalnote, locationguide 내용 추가
      const globalnoteContent = this.readRpPackFile(files.globalnote);
      const locationguideContent = this.readRpPackFile(files.locationguide);

      if (globalnoteContent) {
        rpPackContent += globalnoteContent + '\n\n';
      }

      if (locationguideContent) {
        rpPackContent += locationguideContent + '\n\n';
      }

      // rp_pack_content.md 파일에 통합 내용 저장
      const rpPackContentPath = path.join(this.sharedPath, 'rp_pack_content.md');
      fs.writeFileSync(rpPackContentPath, rpPackContent);

      return renderedPrompt;
    } catch (error) {
      console.error('Error inserting RP pack content:', error);
      return renderedPrompt;
    }
  }

  // RP팩 파일 읽기
  readRpPackFile(filePath) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        return content;
      }
      console.warn(`RP pack file not found: ${fullPath}`);
      return null;
    } catch (error) {
      console.error(`Error reading RP pack file ${filePath}:`, error);
      return null;
    }
  }

  // 특정 줄에 내용 삽입
  insertAtLine(text, lineNumber, content) {
    const lines = text.split('\n');
    if (lineNumber <= 0 || lineNumber > lines.length) {
      return text;
    }

    lines.splice(lineNumber - 1, 0, content);
    return lines.join('\n');
  }

  // RP팩 임시 파일들 정리
  cleanupRpPackFiles() {
    try {
      const filePath = path.join(this.sharedPath, 'rp_pack_content.md');
      if (fs.existsSync(filePath)) {
        // 파일을 완전히 삭제
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error cleaning up RP pack files:', error);
    }
  }

  // 전체 프롬프트 조합 (nunjucks 템플릿 사용)
  buildPrompt(context = {}) {
    const { isNSFW = false, currentOutfit = null, affinity = 1, user = 'user' } = context;

    // RP팩 활성화 상태 확인
    const activeRpPack = this.getActiveRpPack();

    // RP팩 내용 준비
    let rpPackDescription = '';
    let rpPackGlobalNote = '';
    let rpPackLocationGuide = '';

    if (activeRpPack) {
      const rpPackId = activeRpPack.id;

      // 새로운 JSON 기반 RP 팩 시스템 사용
      const shopService = this.getShopService();
      if (shopService) {
        const rpPackContent = shopService.loadRpPackContent(rpPackId, this.character);

        if (rpPackContent) {
          rpPackDescription = rpPackContent.description || '';
          rpPackGlobalNote = rpPackContent.globalnote || '';
          rpPackLocationGuide = rpPackContent.locationguide || '';
        }
      }
    }

    // 템플릿 컨텍스트 구성
    const templateContext = {
      isNSFW,
      currentOutfit,
      affinity,
      user,
      character: this.character,
      outfitDescription: currentOutfit ? this.generateOutfitDescription(currentOutfit) : null,
      activeRpPack,
      rpPackDescription,
      rpPackGlobalNote,
      rpPackLocationGuide,
    };

    // 공통 메인 템플릿 로드 및 렌더링
    const sharedTemplatePath = path.join(this.sharedPath, 'main_template.md');

    if (fs.existsSync(sharedTemplatePath)) {
      try {
        let renderedPrompt = this.env.render('main_template.md', templateContext);

        // nunjucks가 자동으로 profile.md의 동적 섹션을 처리하므로 별도 교체 로직 불필요

        // 줄바꿈 문자 정규화
        return this.normalizeLineEndings(renderedPrompt);
      } catch (error) {
        throw new Error(`Template rendering failed: ${error.message}`);
      }
    } else {
      throw new Error(`Shared template file not found: ${sharedTemplatePath}`);
    }
  }

  // 복장 설명 생성 메서드
  generateOutfitDescription(outfitData) {
    // console.log('generateOutfitDescription input:', JSON.stringify(outfitData, null, 2));

    if (!outfitData || !outfitData.parts) {
      console.warn('Invalid outfit data structure:', outfitData);
      return '**Current Outfit:** Default Style\n\n**Note:** Outfit information not available';
    }

    const { current_outfit, parts } = outfitData;

    let description = `**Current Outfit:** ${current_outfit ? current_outfit.charAt(0).toUpperCase() + current_outfit.slice(1) : 'Default'} Style\n\n`;

    // Upper Body
    if (parts.upper_body) {
      description += '**Upper Body:**\n';
      Object.entries(parts.upper_body).forEach(([part, details]) => {
        if (details && details.enabled) {
          const typeText = part === 'bra' ? '상의 속옷' : '겉옷';
          const partName = details.name ? details.name.replace(/_/g, ' ') : 'unknown';
          description += `- **${part.charAt(0).toUpperCase() + part.slice(1)}:** ${partName} (${typeText}, 착용 중)\n`;
        }
      });
      description += '\n';
    }

    // Lower Body
    if (parts.lower_body) {
      description += '**Lower Body:**\n';
      Object.entries(parts.lower_body).forEach(([part, details]) => {
        if (details && details.enabled) {
          const typeText = part === 'panty' ? '하의 속옷' : '겉옷';
          const partName = details.name ? details.name.replace(/_/g, ' ') : 'unknown';
          description += `- **${part.charAt(0).toUpperCase() + part.slice(1)}:** ${partName} (${typeText}, 착용 중)\n`;
        }
      });
      description += '\n';
    }

    // Feet
    if (parts.feet) {
      description += '**Feet:**\n';
      Object.entries(parts.feet).forEach(([part, details]) => {
        if (details && details.enabled) {
          const partName = details.name ? details.name.replace(/_/g, ' ') : 'unknown';
          description += `- **${part.charAt(0).toUpperCase() + part.slice(1)}:** ${partName} (액세서리, 착용 중)\n`;
        }
      });
      description += '\n';
    }

    // Accessories
    if (parts.accessories) {
      description += '**Accessories:**\n';
      Object.entries(parts.accessories).forEach(([part, details]) => {
        if (details && details.enabled) {
          const partName = details.name ? details.name.replace(/_/g, ' ') : 'unknown';
          description += `- **${part.charAt(0).toUpperCase() + part.slice(1)}:** ${partName} (액세서리, 착용 중)\n`;
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
    } else {
      description += '- The outfit is customized for the current situation\n';
      description += '- Items can be adjusted based on user preferences\n';
      description += '- Maintains character personality through clothing choices\n';
    }

    // console.log('Generated outfit description:', description);
    return description;
  }
}

export default SectionLoader;
