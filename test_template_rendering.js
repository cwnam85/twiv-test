import { generateChatPrompt } from './src/utils/templateRenderer.js';

// 테스트용 컨텍스트 데이터
const testContext = {
  userInput: '안녕하세요',
  affinity: 77,
  currentBackground: 'onsen',
  currentOutfit: 'kimono',
  outfitData: {
    outfitData: {
      parts: {
        upper_body: {
          bra: { enabled: true, name: 'rope_bra', removable_affinity: 80 },
          top: { enabled: true, name: 'kimono', removable_affinity: 50 },
        },
        lower_body: {
          panty: { enabled: true, name: 'rope_panty', removable_affinity: null },
          bottom: { enabled: true, name: 'kimono_obi', removable_affinity: 60 },
        },
        feet: {
          shoes: { enabled: true, name: 'geta_sandals', removable_affinity: 30 },
        },
        accessories: {
          necklace: { enabled: true, name: 'rope_choker', removable_affinity: 40 },
        },
      },
    },
  },
  ownedBackgrounds: 'school, beach, onsen',
  ownedOutfits: 'school_uniform, swimsuit, kimono, gown, casual',
  isAdultCharacter: true,
  character: 'shaki',
  activeRpPack: null,
};

// RP팩이 활성화된 경우 테스트
const testContextWithRpPack = {
  ...testContext,
  activeRpPack: { id: 'onsen_rp_pack' },
};

console.log('=== 템플릿 렌더링 테스트 ===');
console.log('\n1. 기본 템플릿 렌더링:');
try {
  const result1 = generateChatPrompt(testContext);
  console.log('성공:', result1 ? '렌더링 완료' : '렌더링 실패');
  if (result1) {
    console.log('렌더링된 템플릿 길이:', result1.length);
    console.log('조건문 처리 확인:');
    console.log(
      '- activeRpPack 조건:',
      result1.includes('active rp pack:') ? '실패 (있어서는 안됨)' : '성공 (없음)',
    );
    console.log(
      '- RP팩 컨텍스트:',
      result1.includes('Current RP Context') ? '실패 (있어서는 안됨)' : '성공 (없음)',
    );
    console.log(
      '- location 필드:',
      result1.includes('"location":') ? '실패 (있어서는 안됨)' : '성공 (없음)',
    );
    console.log(
      '- outfit 처리 섹션:',
      result1.includes('Outfit Change Command Processing') ? '성공' : '실패',
    );
  }
} catch (error) {
  console.error('오류:', error.message);
}

console.log('\n2. RP팩 활성화된 템플릿 렌더링:');
try {
  const result2 = generateChatPrompt(testContextWithRpPack);
  console.log('성공:', result2 ? '렌더링 완료' : '렌더링 실패');
  if (result2) {
    console.log('렌더링된 템플릿 길이:', result2.length);
    console.log('조건문 처리 확인:');
    console.log(
      '- activeRpPack 조건:',
      result2.includes('active rp pack: onsen_rp_pack') ? '성공' : '실패',
    );
    console.log('- RP팩 컨텍스트:', result2.includes('Current RP Context') ? '성공' : '실패');
    console.log('- location 필드:', result2.includes('"location":') ? '성공' : '실패');
    console.log(
      '- outfit 처리 섹션:',
      result2.includes('Outfit Change Command Processing') ? '실패 (있어서는 안됨)' : '성공 (없음)',
    );
  }
} catch (error) {
  console.error('오류:', error.message);
}

console.log('\n3. 변수 전달 확인:');
try {
  const result3 = generateChatPrompt(testContext);
  if (result3) {
    console.log('변수 치환 확인:');
    console.log('- userInput:', result3.includes("user's input: 안녕하세요") ? '성공' : '실패');
    console.log('- affinity:', result3.includes('current affinity: 77') ? '성공' : '실패');
    console.log('- character:', result3.includes("Give me shaki's response") ? '성공' : '실패');
    console.log(
      '- isAdultCharacter:',
      result3.includes('isAdultCharacter') ? '실패 (변수명이 그대로 남음)' : '성공',
    );
  }
} catch (error) {
  console.error('오류:', error.message);
}
