import SectionLoader from './section-loader.js';
import fs from 'fs';
import path from 'path';

// 테스트 실행
async function testNunjucksTemplate() {
  console.log('=== Nunjucks 템플릿 테스트 ===\n');

  const loader = new SectionLoader('shaki');

  // 테스트 케이스 1: 기본 설정
  console.log('1. 기본 설정 (Level 1, SFW)');
  const basicPrompt = loader.buildPrompt({
    affinityLevel: 1,
    isNSFW: false,
    user: '테스트유저',
  });

  // 파일로 저장
  fs.writeFileSync('test_output_basic.md', basicPrompt);
  console.log('✅ 저장됨: test_output_basic.md');
  console.log(basicPrompt.substring(0, 500) + '...\n');

  // 테스트 케이스 2: 높은 친밀도
  console.log('2. 높은 친밀도 (Level 4, NSFW)');
  const highAffinityPrompt = loader.buildPrompt({
    affinityLevel: 4,
    isNSFW: true,
    user: '테스트유저',
    currentOutfit: {
      current_outfit: 'casual',
      parts: {
        upper_body: {
          top: { enabled: true, name: 'white_blouse', type: 'outer' },
        },
      },
    },
  });

  // 파일로 저장
  fs.writeFileSync('test_output_high_affinity.md', highAffinityPrompt);
  console.log('✅ 저장됨: test_output_high_affinity.md');
  console.log(highAffinityPrompt.substring(0, 500) + '...\n');

  // 테스트 케이스 3: 복장 정보 포함
  console.log('3. 복장 정보 포함');
  const outfitPrompt = loader.buildPrompt({
    affinityLevel: 2,
    isNSFW: false,
    user: '테스트유저',
    currentOutfit: {
      current_outfit: 'school_uniform',
      parts: {
        upper_body: {
          top: { enabled: true, name: 'school_blazer', type: 'outer' },
          bra: { enabled: true, name: 'white_bra', type: 'underwear' },
        },
        lower_body: {
          bottom: { enabled: true, name: 'school_skirt', type: 'outer' },
          panty: { enabled: true, name: 'white_panties', type: 'underwear' },
        },
      },
    },
  });

  // 파일로 저장
  fs.writeFileSync('test_output_outfit.md', outfitPrompt);
  console.log('✅ 저장됨: test_output_outfit.md');
  console.log(outfitPrompt.substring(0, 500) + '...\n');

  console.log('🎉 모든 테스트 완료! 생성된 파일들을 확인해보세요:');
  console.log('- test_output_basic.md (기본 설정)');
  console.log('- test_output_high_affinity.md (높은 친밀도)');
  console.log('- test_output_outfit.md (복장 정보 포함)');
}

// 테스트 실행
testNunjucksTemplate().catch(console.error);
