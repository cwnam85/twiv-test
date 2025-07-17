import { getLLMResponse } from './llmService.js';
import { playTTSSupertone } from './ttsService.js';
import { sendMessageToWarudo } from './warudoService.js';
import characterService from './characterService.js';
import affinityService from './affinityService.js';
import { playMatureTTS, startInfiniteMatureTTS, stopInfiniteMatureTTS } from './audioService.js';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import Speaker from 'speaker';

// AudioProcessor 클래스 import
// import { AudioProcessor } from './audioService.js';

class ResponseService {
  constructor() {
    this.purchaseCost = 100;
  }

  async processLLMResponse(requestHistory, userMessage, currentModel, systemPrompt) {
    try {
      const responseLLM = await getLLMResponse(
        [...requestHistory, { role: 'user', content: [{ type: 'text', text: userMessage }] }],
        currentModel,
        systemPrompt,
      );

      console.log('LLM Output:\n', responseLLM);

      // 포인트 차감
      affinityService.deductPoint(1);

      return await this.parseResponse(responseLLM);
    } catch (error) {
      console.error(`Error calling ${currentModel} API:`, error);
      throw error;
    }
  }

  async parseResponse(responseLLM) {
    let dialogue = null;
    let emotion = null;
    let pose = null;
    let usage = null;
    let matureTags = [];
    let segments = [];

    try {
      // 새로운 응답 처리 함수 사용
      const { processAIResponse } = await import('../utils/responseProcessor.js');
      const processedResponse = processAIResponse(responseLLM);

      dialogue = processedResponse.dialogue;
      emotion = processedResponse.emotion;
      pose = processedResponse.pose;
      const affinity = processedResponse.affinity;
      const outfitOn = processedResponse.outfitOn || [];
      const outfitOff = processedResponse.outfitOff || [];
      matureTags = processedResponse.matureTags || [];
      segments = processedResponse.segments || [];

      // affinity 처리
      if (affinity) {
        this.processAffinityChange(affinity);
      }

      usage = responseLLM.usage;

      return {
        dialogue,
        emotion,
        pose,
        usage,
        affinity,
        outfitOn,
        outfitOff,
        matureTags,
        segments,
      };
    } catch (error) {
      console.error('Response parsing error:', error);
      // 폴백: 기존 정규식 방식 사용
      return this.parseWithRegex(responseLLM.dialogue);
    }
  }

  parseWithRegex(dialogueText) {
    const matchEmotion = dialogueText.match(/emotion:\s*["']?([^"',}]+)["']?/i);
    const matchDialogue = dialogueText.match(/dialogue:\s*["']([^"']+)["']/i);
    const matchPose = dialogueText.match(/pose:\s*["']?([^"',}]+)["']?/i);
    const matchAffinity = dialogueText.match(/affinity:\s*["']?([^"',}]+)["']?/i);
    const matchOutfitOn = dialogueText.match(/outfitOn:\s*(\[[\s\S]*?\])/i);
    const matchOutfitOff = dialogueText.match(/outfitOff:\s*(\[[\s\S]*?\])/i);

    let outfitOn = [];
    let outfitOff = [];

    if (matchOutfitOn) {
      try {
        const outfitOnText = matchOutfitOn[0].replace(/outfitOn:\s*/, '');
        outfitOn = JSON.parse(outfitOnText);
      } catch (e) {
        console.warn('Failed to parse outfitOn from regex:', e);
      }
    }

    if (matchOutfitOff) {
      try {
        const outfitOffText = matchOutfitOff[0].replace(/outfitOff:\s*/, '');
        outfitOff = JSON.parse(outfitOffText);
      } catch (e) {
        console.warn('Failed to parse outfitOff from regex:', e);
      }
    }

    return {
      dialogue: matchDialogue ? matchDialogue[1].trim() : null,
      emotion: matchEmotion ? matchEmotion[1].trim() : null,
      pose: matchPose ? matchPose[1].trim() : null,
      usage: null,
      affinity: matchAffinity ? matchAffinity[1].trim() : null,
      outfitOn,
      outfitOff,
      matureTags: [],
      segments: [],
    };
  }

  processAffinityChange(affinityChange) {
    const change = parseInt(affinityChange);
    if (!isNaN(change)) {
      const result = affinityService.updateAffinity(change);

      if (result.affinityChanged) {
        // affinity 변경 시 시스템 프롬프트 업데이트
        characterService.updateSystemPrompt();
        console.log(`Affinity changed to ${result.newAffinity}`);
      }
    }
  }

  async processPurchaseRequest(
    requestHistory,
    userMessage,
    requestedContent,
    currentModel,
    systemPrompt,
  ) {
    if (!affinityService.hasEnoughPoints(this.purchaseCost)) {
      throw new Error('포인트가 부족합니다.');
    }

    // 포인트 차감
    affinityService.deductPoint(this.purchaseCost);

    const purchaseMessage = `사용자가 "${userMessage}"라고 바로 전에 언급했으며, ${requestedContent}를 구매하려고 합니다. 맥락에 맞는 구매 확인 메시지를 생성해주세요.`;

    try {
      const purchaseResponse = await getLLMResponse(
        [...requestHistory, { role: 'user', content: [{ type: 'text', text: purchaseMessage }] }],
        currentModel,
        systemPrompt,
      );

      const parsed = this.parseResponse(purchaseResponse);

      // 구매 확인 메시지로 대체
      if (parsed.dialogue) {
        return parsed;
      }
    } catch (purchaseError) {
      console.error('구매 확인 메시지 생성 오류:', purchaseError);
      throw purchaseError;
    }
  }

  async processPurchaseCompletion(
    requestHistory,
    userMessage,
    requestedContent,
    currentModel,
    systemPrompt,
  ) {
    const purchaseCompleteMessage = `사용자가 ${requestedContent} 구매를 완료했습니다. 원래 요청 "${userMessage}"에 따라 해당 콘텐츠를 제공해주세요.`;

    try {
      const purchaseResponse = await getLLMResponse(
        [
          ...requestHistory,
          { role: 'user', content: [{ type: 'text', text: purchaseCompleteMessage }] },
        ],
        currentModel,
        systemPrompt,
      );

      return this.parseResponse(purchaseResponse);
    } catch (error) {
      console.error('구매 완료 처리 중 오류가 발생했습니다.', error);
      throw error;
    }
  }

  async playResponse(dialogue, emotion, matureTags = [], segments = []) {
    try {
      // 이전 무한재생 중지
      stopInfiniteMatureTTS();

      // mature 태그 사용 빈도 추적을 위한 맵
      const tagCountMap = new Map();

      if (segments && segments.length > 0) {
        console.log(`[AUDIO] Preparing client-side playback with ${segments.length} segments`);

        // mature 태그 세그먼트 카운트
        for (const segment of segments) {
          if (segment.type === 'tag') {
            const type = segment.content.replace(/_/g, ''); // _moan_ -> moan
            tagCountMap.set(type, (tagCountMap.get(type) || 0) + 1);
          }
        }

        // 1단계: TTS 파일들을 한꺼번에 미리 생성 (순서대로)
        const ttsFiles = [];
        let ttsIndex = 0;
        console.log(`[TTS] Pre-generating all TTS files for client...`);
        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          if (segment.type === 'text' && segment.content.trim()) {
            console.log(
              `[TTS] Generating TTS ${ttsIndex + 1}/${segments.filter((s) => s.type === 'text').length}: "${segment.content}"`,
            );
            try {
              const filePath = await playTTSSupertone(segment.content, emotion, true);
              if (filePath) {
                ttsFiles[ttsIndex] = filePath;
                console.log(`[TTS] ✓ Generated: ${filePath}`);
              } else {
                console.error(`[TTS] ✗ Failed to generate TTS for: "${segment.content}"`);
                ttsFiles[ttsIndex] = null;
              }
            } catch (ttsError) {
              console.error(`[TTS] ✗ Error generating TTS for: "${segment.content}"`, ttsError);
              ttsFiles[ttsIndex] = null;
            }
            ttsIndex++;
          }
        }
        console.log(
          `[TTS] ✓ All ${ttsFiles.filter((f) => f).length}/${ttsFiles.length} TTS files generated successfully`,
        );

        // 2단계: 클라이언트용 세그먼트 데이터 구성
        const clientSegments = [];
        ttsIndex = 0;
        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];

          if (segment.type === 'text' && segment.content.trim()) {
            // TTS 세그먼트: 파일 URL 추가
            const ttsFile = ttsFiles[ttsIndex];
            if (ttsFile && fs.existsSync(ttsFile)) {
              const fileName = path.basename(ttsFile);
              clientSegments.push({
                type: 'text',
                content: segment.content,
                audioUrl: `/api/audio/${fileName}`,
                index: i,
              });
              console.log(`[CLIENT] Added TTS segment: ${fileName}`);
            } else {
              console.warn(`[CLIENT] ⚠ TTS file not found for segment ${ttsIndex + 1}`);
            }
            ttsIndex++;
          } else if (segment.type === 'tag') {
            // 태그 세그먼트: 정규화된 태그 추가
            const type = segment.content.replace(/_/g, ''); // _moan_ -> moan
            const effectUrl = this.getRandomEffectUrl(type);
            clientSegments.push({
              type: 'tag',
              content: type,
              audioUrl: effectUrl,
              index: i,
            });
            console.log(`[CLIENT] Added effect segment: ${type} -> ${effectUrl}`);
          }
        }

        // 3단계: 무한재생 태그 결정
        let infiniteTag = null;
        if (tagCountMap.size > 0) {
          infiniteTag = this.getMostUsedTag(tagCountMap);
          console.log(`[INFINITE] Will start infinite playback of: ${infiniteTag}`);
        }

        // 4단계: 무한재생용 효과음 URL 생성
        let infiniteEffectUrl = null;
        if (infiniteTag) {
          infiniteEffectUrl = this.getRandomEffectUrl(infiniteTag);
        }

        // 5단계: 클라이언트로 전송할 데이터 반환
        const clientData = {
          dialogue,
          emotion,
          segments: clientSegments,
          infiniteTag,
          infiniteEffectUrl,
          matureTags: Array.from(tagCountMap.keys()),
        };

        console.log(`[CLIENT] Prepared ${clientSegments.length} segments for client playback`);
        return clientData;
      } else {
        // segments가 없으면 기존 방식 사용 (호환성)
        console.log(`[AUDIO] Using legacy playback mode (no segments)`);
        await playTTSSupertone(dialogue, emotion);

        // mature 태그들 순차적으로 재생 및 카운트
        for (const tag of matureTags) {
          const type = tag.replace(/_/g, ''); // _kiss_ -> kiss
          tagCountMap.set(type, (tagCountMap.get(type) || 0) + 1);
          console.log(`[PLAYBACK] Playing mature effect: ${type}`);
          await playMatureTTS(type);
        }

        // mature 태그가 있었다면 가장 많이 사용된 태그로 무한재생 시작
        if (tagCountMap.size > 0) {
          const mostUsedTag = this.getMostUsedTag(tagCountMap);
          console.log(
            `[INFINITE] Most used mature tag: ${mostUsedTag} (used ${tagCountMap.get(mostUsedTag)} times)`,
          );
          console.log(`[INFINITE] Starting infinite playback of ${mostUsedTag}`);
          startInfiniteMatureTTS(mostUsedTag);
        }

        return null; // 기존 방식에서는 클라이언트 데이터 없음
      }
    } catch (error) {
      console.error('[AUDIO] Error during playback:', error);
      return null;
    }
  }

  // TTS 파일 재생 메서드 (단순한 이벤트 기반)
  async playTTSFile(filePath, isFirst = false, isLast = false) {
    return new Promise((resolve, reject) => {
      const speaker = new Speaker({
        channels: 2,
        bitDepth: 16,
        sampleRate: 44100,
      });

      ffmpeg(filePath)
        .inputFormat('mp3')
        .audioChannels(2)
        .audioFrequency(44100)
        .toFormat('s16le')
        .on('error', (err) => {
          console.error('Error during playback:', err.message);
          reject(err);
        })
        .on('end', () => {
          speaker.end();
        })
        .pipe(speaker);

      speaker.on('close', () => {
        resolve();
      });
    });
  }

  sendPoseToWarudo(pose) {
    if (pose) {
      const messageWarudo = JSON.stringify({
        action: 'Pose',
        data: pose,
      });
      sendMessageToWarudo(messageWarudo);
    }
  }

  // 우선순위 기반 mature 태그 찾기
  getMostUsedTag(tagCountMap) {
    // 우선순위: suck > kiss > moan > breath
    const priorityOrder = ['suck', 'kiss', 'moan', 'breath'];

    // 우선순위가 높은 태그부터 확인
    for (const priorityTag of priorityOrder) {
      if (tagCountMap.has(priorityTag)) {
        console.log(
          `[PRIORITY] Found priority tag: ${priorityTag} (used ${tagCountMap.get(priorityTag)} times)`,
        );
        return priorityTag;
      }
    }

    // 우선순위 태그가 없으면 가장 많이 사용된 태그 반환 (fallback)
    let mostUsedTag = null;
    let maxCount = 0;

    for (const [tag, count] of tagCountMap.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostUsedTag = tag;
      }
    }

    return mostUsedTag;
  }

  // 랜덤 효과음 URL 생성
  getRandomEffectUrl(effectType) {
    try {
      // 활성 캐릭터 확인
      const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';

      // 캐릭터별 효과음 폴더 경로 결정
      let effectDir;
      if (activeCharacter === 'blacknila') {
        effectDir = path.join(process.cwd(), 'mature_tts', 'blacknila', effectType);
      } else {
        // 기본 효과음 폴더 (shaki 등)
        effectDir = path.join(process.cwd(), 'mature_tts', effectType);
      }

      if (!fs.existsSync(effectDir)) {
        console.warn(`[EFFECT] Effect directory not found: ${effectDir}`);
        return null;
      }

      const files = fs.readdirSync(effectDir).filter((file) => file.endsWith('.mp3'));
      if (files.length === 0) {
        console.warn(`[EFFECT] No MP3 files found in: ${effectDir}`);
        return null;
      }

      const randomFile = files[Math.floor(Math.random() * files.length)];
      const effectUrl =
        activeCharacter === 'blacknila'
          ? `/api/effects/blacknila/${effectType}/${randomFile}`
          : `/api/effects/${effectType}/${randomFile}`;

      console.log(
        `[EFFECT] Selected random effect for ${activeCharacter}: ${effectType}/${randomFile}`,
      );
      return effectUrl;
    } catch (error) {
      console.error(`[EFFECT] Error getting random effect URL for ${effectType}:`, error);
      return null;
    }
  }

  processOutfitChange(outfitOn, outfitOff) {
    // outfitOff 처리 (벗기기)
    if (Array.isArray(outfitOff) && outfitOff.length > 0) {
      for (const category of outfitOff) {
        if (category) {
          console.log(`Processing outfit removal: ${category}`);
          try {
            characterService.changeOutfit('remove', category);
          } catch (outfitError) {
            console.error(`Error removing outfit ${category}:`, outfitError);
          }
        }
      }
    }

    // outfitOn 처리 (입기)
    if (Array.isArray(outfitOn) && outfitOn.length > 0) {
      for (const category of outfitOn) {
        if (category) {
          console.log(`Processing outfit wearing: ${category}`);
          try {
            characterService.changeOutfit('wear', category);
          } catch (outfitError) {
            console.error(`Error wearing outfit ${category}:`, outfitError);
          }
        }
      }
    }

    // 모든 변경 완료 후 시스템 프롬프트 업데이트
    if ((outfitOn && outfitOn.length > 0) || (outfitOff && outfitOff.length > 0)) {
      try {
        characterService.updateSystemPrompt(characterService.getOutfitData().outfitData);
      } catch (error) {
        console.error('Error updating system prompt after outfit changes:', error);
      }
    }
  }
}

export default new ResponseService();
