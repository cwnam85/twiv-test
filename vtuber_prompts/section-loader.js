import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nunjucks from 'nunjucks';
import shopService from '../src/services/shopService.js';
import backgroundService from '../src/services/backgroundService.js';
import characterStateService from '../src/services/characterStateService.js';
import coercionPointService from '../src/services/coercionPointService.js';
import cotService from '../src/services/cotService.js';

// poseList.json 로드
function loadPoseList() {
  const poseListPath = path.join(process.cwd(), 'src', 'data', 'poseList.json');
  try {
    const data = fs.readFileSync(poseListPath, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.poseList || [];
  } catch (error) {
    console.error('Error loading poseList.json:', error);
    return [];
  }
}

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
      // 이미 import된 shopService 사용
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
    const {
      isNSFW = false,
      currentAppearance = null,
      affinity = 1,
      user = 'user',
      userLastResponses = [],
      llmLastResponses = [],
    } = context;

    // RP팩 활성화 상태 확인
    const activeRpPack = this.getActiveRpPack();

    // RP팩 내용 준비
    let rpPackDescription = '';
    let rpPackGlobalNote = '';
    let rpPackLocationGuide = '';
    let rpPackMessagePrompt = { context: '', atmosphere: '', behavior: '' };

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
          rpPackMessagePrompt = rpPackContent.messagePrompt || {
            context: '',
            atmosphere: '',
            behavior: '',
          };
          console.log(
            `SectionLoader - rpPackMessagePrompt loaded: ${rpPackMessagePrompt ? (typeof rpPackMessagePrompt === 'object' ? JSON.stringify(rpPackMessagePrompt).substring(0, 100) + '...' : rpPackMessagePrompt.substring(0, 100) + '...') : 'empty'}`,
          );
        }
      }
    }

    // 배경 서비스에서 spots 정보 가져오기 (templateRenderer.js와 동일한 방식)
    let location = null;
    if (activeRpPack) {
      try {
        const currentBackground = characterStateService.getCurrentBackground(this.character);
        location = backgroundService.getBackgroundSpots(this.character, currentBackground);
      } catch (error) {
        console.error('Error getting background spots in SectionLoader:', error);
      }
    }

    // poseList 로드
    const poseList = loadPoseList();

    // NSFW 포즈 목록 필터링 (sfw: false인 포즈들)
    const nsfwPoses = poseList.filter((pose) => pose.sfw === false).map((pose) => pose.name);

    // rpPack 구조 생성 (chat_template.md와 동일한 구조)
    const rpPack = {
      poseList: poseList,
    };

    // 템플릿 컨텍스트 구성
    const templateContext = {
      isNSFW,
      currentAppearance,
      affinity,
      coercionPoint: coercionPointService.getCoercionPoint(), // ✅ 협박도 추가
      cotEnabled: cotService.isCotEnabled(), // ✅ CoT 활성화 상태 추가
      user,
      character: this.character,
      appearanceDescription: currentAppearance
        ? this.generateAppearanceDescription(currentAppearance)
        : null,
      activeRpPack,
      rpPackDescription,
      rpPackGlobalNote,
      rpPackLocationGuide,
      rpPackMessagePrompt,
      location,
      userLastResponses: (userLastResponses || []).join('\n\n'),
      llmLastResponses: (llmLastResponses || []).join('\n\n'),
      rpPack, // ✅ rpPack.poseList 추가
      poseList, // ✅ 직접 접근용
      nsfwPoses, // ✅ NSFW 포즈 목록 (sfw: false)
    };

    // 캐릭터별 main_template.md 우선 사용, 없으면 공통 템플릿 사용
    const characterTemplatePath = path.join(this.characterPath, 'main_template.md');
    const sharedTemplatePath = path.join(this.sharedPath, 'main_template.md');

    let templatePath = null;
    let templateName = null;

    // 1. 캐릭터별 템플릿 확인
    if (fs.existsSync(characterTemplatePath)) {
      templatePath = characterTemplatePath;
      templateName = 'main_template.md';
      console.log(`[SECTION LOADER] Using character-specific template: ${characterTemplatePath}`);
    }
    // 2. 공통 템플릿 사용 (폴백)
    else if (fs.existsSync(sharedTemplatePath)) {
      templatePath = sharedTemplatePath;
      templateName = 'main_template.md';
      console.log(`[SECTION LOADER] Using shared template: ${sharedTemplatePath}`);
    } else {
      console.error(
        `[SECTION LOADER] No template found for character: ${this.character}. Checked:`,
      );
      console.error(`  - Character template: ${characterTemplatePath}`);
      console.error(`  - Shared template: ${sharedTemplatePath}`);
      throw new Error(
        `No main_template.md found for character '${this.character}' or in shared folder`,
      );
    }

    if (templatePath) {
      try {
        let renderedPrompt = this.env.render(templateName, templateContext);

        // nunjucks가 자동으로 profile.md의 동적 섹션을 처리하므로 별도 교체 로직 불필요

        // 줄바꿈 문자 정규화
        return this.normalizeLineEndings(renderedPrompt);
      } catch (error) {
        console.error('🔍 SectionLoader - Template rendering error:', error);
        throw new Error(`Template rendering failed: ${error.message}`);
      }
    } else {
      throw new Error(`Template file not found for character: ${this.character}`);
    }
  }

  // 복장 설명 생성 메서드
  generateAppearanceDescription(appearanceData) {
    // console.log('generateAppearanceDescription input:', JSON.stringify(appearanceData, null, 2));

    if (!appearanceData || !appearanceData.parts) {
      console.warn('Invalid outfit data structure:', appearanceData);
      return '**Current Appearance:** Default Style\n\n**Note:** Appearance information not available';
    }

    const { current_appearance, parts } = appearanceData;

    let description = `**Current Appearance:** ${current_appearance ? current_appearance.charAt(0).toUpperCase() + current_appearance.slice(1) : 'Default'} Style\n\n`;

    // 모든 의상 아이템들을 직접 처리
    const itemTypes = {
      hair: '헤어스타일',
      bra: '상의 속옷',
      top: '상의',
      outerwear: '겉옷',
      panty: '하의 속옷',
      bottom: '하의',
      shoes: '신발',
      hat: '모자',
      necklace: '목걸이',
      belt: '벨트',
    };

    description += '**Current Items:**\n';
    Object.entries(parts).forEach(([part, details]) => {
      if (details && details.enabled && details.name) {
        const typeText = itemTypes[part] || '액세서리';
        const partName = details.name.replace(/_/g, ' ');
        description += `- **${part.charAt(0).toUpperCase() + part.slice(1)}:** ${partName} (${typeText}, 착용 중)\n`;
      }
    });
    description += '\n';

    // Special Notes based on appearance type
    description += '**Special Notes:**\n';
    if (current_appearance === 'casual') {
      description += '- The outfit maintains a balance between casual comfort and stylish appeal\n';
      description += '- Items can be easily adjusted or removed based on the situation\n';
      description += '- The combination creates a playful yet sophisticated look\n';
    } else if (current_appearance === 'school_uniform') {
      description += '- The school uniform gives a more formal and innocent appearance\n';
      description += '- The outfit follows traditional school dress code standards\n';
      description += '- Creates a contrast between proper attire and playful personality\n';
    } else if (current_appearance === 'swimsuit') {
      description += '- The swimsuit showcases her confident and alluring side\n';
      description += '- Perfect for beach or pool-related conversations\n';
      description += '- Emphasizes her comfort with showing skin\n';
    } else {
      description += '- The appearance is customized for the current situation\n';
      description += '- Items can be adjusted based on user preferences\n';
      description += '- Maintains character personality through clothing choices\n';
    }

    // console.log('Generated outfit description:', description);
    return description;
  }
}

export default SectionLoader;
