import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nunjucks from 'nunjucks';

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

  // 전체 프롬프트 조합 (nunjucks 템플릿 사용)
  buildPrompt(context = {}) {
    const { isNSFW = false, currentOutfit = null, affinity = 1, user = 'user' } = context;

    // 템플릿 컨텍스트 구성
    const templateContext = {
      isNSFW,
      currentOutfit,
      affinity,
      user,
      character: this.character,
      outfitDescription: currentOutfit ? this.generateOutfitDescription(currentOutfit) : null,
    };

    // 공통 메인 템플릿 로드 및 렌더링
    const sharedTemplatePath = path.join(this.sharedPath, 'main_template.md');

    if (fs.existsSync(sharedTemplatePath)) {
      try {
        let renderedPrompt = this.env.render('main_template.md', templateContext);

        // nunjucks가 자동으로 profile.md의 동적 섹션을 처리하므로 별도 교체 로직 불필요
        console.log('Using shared nunjucks template rendering for dynamic content');

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
          const typeText = details.type === 'underwear' ? '속옷' : '겉옷';
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
          const typeText = details.type === 'underwear' ? '속옷' : '겉옷';
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
