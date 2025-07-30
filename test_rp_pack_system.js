import fs from 'fs';
import path from 'path';

// RP 팩 JSON 시스템 테스트
async function testRpPackSystem() {
  console.log('=== RP 팩 JSON 시스템 테스트 ===\n');

  // 1. JSON 파일 존재 확인
  const rpPackPath = 'vtuber_prompts/characters/shaki/rppacks/onsen_rp_pack.json';
  console.log('1. JSON 파일 확인:', rpPackPath);

  if (fs.existsSync(rpPackPath)) {
    console.log('✅ JSON 파일 존재');

    const rpPackData = JSON.parse(fs.readFileSync(rpPackPath, 'utf8'));
    console.log('JSON 내용:', JSON.stringify(rpPackData, null, 2));
  } else {
    console.log('❌ JSON 파일 없음');
  }

  // 2. 마크다운 파일 존재 확인
  console.log('\n2. 마크다운 파일 확인:');
  const files = [
    'onsendate/description.md',
    'onsendate/globalnote.md',
    'onsendate/locationguide.md',
  ];

  files.forEach((file) => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} 존재`);
    } else {
      console.log(`❌ ${file} 없음`);
    }
  });

  // 3. shopService 모듈 테스트
  console.log('\n3. shopService 모듈 테스트:');
  try {
    const { default: shopService } = await import('./src/services/shopService.js');

    // RP 팩 로드 테스트
    const rpPack = shopService.loadRpPack('shaki', 'onsen_rp_pack');
    console.log('RP 팩 로드:', rpPack ? '성공' : '실패');

    // RP 팩 내용 로드 테스트
    const content = shopService.loadRpPackContent('onsen_rp_pack', 'shaki');
    console.log('RP 팩 내용 로드:', content ? '성공' : '실패');

    if (content) {
      console.log('설명 길이:', content.description?.length || 0);
      console.log('글로벌 노트 길이:', content.globalnote?.length || 0);
      console.log('위치 가이드 길이:', content.locationguide?.length || 0);
    }
  } catch (error) {
    console.log('❌ shopService 테스트 실패:', error.message);
  }

  console.log('\n=== 테스트 완료 ===');
}

testRpPackSystem().catch(console.error);
