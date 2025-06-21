import SectionLoader from './vtuber_prompts/section-loader.js';

// 샤키의 SFW 프롬프트 테스트
console.log('=== SFW PROMPT ===');
const sfwLoader = new SectionLoader('');
const sfwPrompt = sfwLoader.buildPrompt(false);
console.log(sfwPrompt);

console.log('\n\n=== NSFW PROMPT ===');
// 샤키의 NSFW 프롬프트 테스트
const nsfwPrompt = sfwLoader.buildPrompt(true);
console.log(nsfwPrompt);

// 파일로 저장 (선택사항)
import fs from 'fs';
fs.writeFileSync('shaki-sfw-prompt.md', sfwPrompt);
fs.writeFileSync('shaki-nsfw-prompt.md', nsfwPrompt);
console.log('\n프롬프트가 파일로 저장되었습니다: shaki-sfw-prompt.md, shaki-nsfw-prompt.md');
