import { getLLMResponse } from './llmService.js';
import { playTTSSupertone } from './ttsService.js';
import { sendMessageToWarudo } from './warudoService.js';
import characterService from './characterService.js';
import affinityService from './affinityService.js';
import { playMatureTTS } from './audioService.js';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import Speaker from 'speaker';

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
      if (segments && segments.length > 0) {
        console.log(`[AUDIO] Starting playback with ${segments.length} segments`);

        // 1단계: TTS 파일들을 한꺼번에 미리 생성 (순서대로)
        const ttsFiles = [];
        let ttsIndex = 0;

        console.log(`[TTS] Pre-generating all TTS files in order...`);

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

        // 2단계: output에 명시된 순서대로 효과음과 TTS를 순차적으로 재생
        console.log(`[PLAYBACK] Starting sequential playback in output order...`);
        ttsIndex = 0;

        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          const isFirst = i === 0; // 첫 번째 세그먼트
          const isLast = i === segments.length - 1; // 마지막 세그먼트

          if (segment.type === 'text' && segment.content.trim()) {
            // TTS 세그먼트: 미리 생성된 파일 재생
            const ttsFile = ttsFiles[ttsIndex];
            if (ttsFile && fs.existsSync(ttsFile)) {
              console.log(
                `[PLAYBACK] Playing TTS ${ttsIndex + 1}: "${segment.content}" (${isFirst ? 'first' : ''}${isLast ? 'last' : ''})`,
              );
              try {
                await this.playTTSFile(ttsFile, isFirst, isLast);
                console.log(`[PLAYBACK] ✓ TTS ${ttsIndex + 1} completed`);
              } catch (playError) {
                console.error(`[PLAYBACK] ✗ Error playing TTS ${ttsIndex + 1}:`, playError);
              }
            } else {
              console.warn(`[PLAYBACK] ⚠ TTS file not found for segment ${ttsIndex + 1}`);
            }
            ttsIndex++;
          } else if (segment.type === 'tag') {
            // 태그 세그먼트: mature 효과음 재생
            const type = segment.content.replace(/_/g, ''); // _moan_ -> moan
            console.log(
              `[PLAYBACK] Playing mature effect: ${type} (${isFirst ? 'first' : ''}${isLast ? 'last' : ''})`,
            );
            try {
              await playMatureTTS(type, isFirst, isLast);
              console.log(`[PLAYBACK] ✓ Mature effect ${type} completed`);
            } catch (effectError) {
              console.error(`[PLAYBACK] ✗ Error playing mature effect ${type}:`, effectError);
            }
          }
        }

        console.log(`[PLAYBACK] ✓ All segments completed`);

        // 3단계: 모든 재생 완료 후 TTS 파일들 정리
        console.log(`[CLEANUP] Cleaning up ${ttsFiles.length} TTS files...`);
        for (let i = 0; i < ttsFiles.length; i++) {
          const filePath = ttsFiles[i];
          if (filePath && fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
              console.log(`[CLEANUP] ✓ Deleted: ${filePath}`);
            } catch (cleanupError) {
              console.warn(`[CLEANUP] ⚠ Failed to delete ${filePath}:`, cleanupError);
            }
          }
        }
        console.log(`[CLEANUP] ✓ Cleanup completed`);
      } else {
        // segments가 없으면 기존 방식 사용 (호환성)
        console.log(`[AUDIO] Using legacy playback mode (no segments)`);
        await playTTSSupertone(dialogue, emotion);

        // mature 태그들 순차적으로 재생
        for (const tag of matureTags) {
          const type = tag.replace(/_/g, ''); // _kiss_ -> kiss
          console.log(`[PLAYBACK] Playing mature effect: ${type}`);
          await playMatureTTS(type);
        }
      }
    } catch (error) {
      console.error('[AUDIO] Error during playback:', error);
    }
  }

  // TTS 파일 재생 메서드 (JavaScript 레벨 페이드 효과)
  async playTTSFile(filePath, isFirst = false, isLast = false) {
    return new Promise(async (resolve, reject) => {
      const speaker = new Speaker({
        channels: 2,
        bitDepth: 16,
        sampleRate: 44100,
      });

      const audioChunks = [];
      const { PassThrough } = await import('stream');
      const passThrough = new PassThrough();

      // PassThrough 스트림에서 데이터 수집
      passThrough.on('data', (chunk) => {
        audioChunks.push(chunk);
      });

      passThrough.on('end', () => {
        try {
          // 모든 데이터를 하나로 합치기
          const fullAudio = Buffer.concat(audioChunks);
          console.log(`[TTS] Audio data size: ${fullAudio.length} bytes`);

          // JavaScript로 페이드 효과 적용
          let processedAudio = fullAudio;

          if (!isFirst) {
            console.log(`[TTS] Applying fade-in effect`);
            processedAudio = this.applyFadeIn(processedAudio, 0.5); // 0.5초 페이드 인
          }

          if (!isLast) {
            console.log(`[TTS] Applying fade-out effect`);
            processedAudio = this.applyFadeOut(processedAudio, 0.5); // 0.5초 페이드 아웃
          }

          // 처리된 오디오를 Speaker로 재생
          console.log(`[TTS] Writing ${processedAudio.length} bytes to speaker`);
          speaker.write(processedAudio);
          speaker.end();

          speaker.on('close', () => {
            const fadeInfo = [];
            if (!isFirst) fadeInfo.push('fade-in');
            if (!isLast) fadeInfo.push('fade-out');
            console.log(
              `[TTS] ✓ Playback completed ${fadeInfo.length > 0 ? `(${fadeInfo.join(', ')})` : '(no fade)'}.`,
            );
            resolve();
          });
        } catch (error) {
          console.error('[TTS] Error during audio processing:', error);
          reject(error);
        }
      });

      // ffmpeg로 raw PCM 데이터 추출 (필터 없이)
      ffmpeg(filePath)
        .inputFormat('mp3')
        .audioChannels(2)
        .audioFrequency(44100)
        .toFormat('s16le')
        .on('error', (err) => {
          console.error(`[TTS] Error during PCM extraction:`, err);
          reject(err);
        })
        .pipe(passThrough);
    });
  }

  // 페이드인 효과 적용
  applyFadeIn(pcmData, durationSeconds, sampleRate = 44100) {
    const fadeSamples = Math.floor(durationSeconds * sampleRate);
    const result = Buffer.from(pcmData);

    for (let i = 0; i < fadeSamples; i++) {
      const fadeMultiplier = i / fadeSamples; // 0 ~ 1.0

      // 스테레오이므로 4바이트씩 처리
      const sampleIndex = i * 4;

      // 왼쪽 채널
      const leftSample = result.readInt16LE(sampleIndex);
      const fadedLeft = Math.round(leftSample * fadeMultiplier);
      result.writeInt16LE(fadedLeft, sampleIndex);

      // 오른쪽 채널
      const rightSample = result.readInt16LE(sampleIndex + 2);
      const fadedRight = Math.round(rightSample * fadeMultiplier);
      result.writeInt16LE(fadedRight, sampleIndex + 2);
    }

    return result;
  }

  // 페이드아웃 효과 적용
  applyFadeOut(pcmData, durationSeconds, sampleRate = 44100) {
    const fadeSamples = Math.floor(durationSeconds * sampleRate);
    const totalSamples = Math.floor(pcmData.length / 4);
    const result = Buffer.from(pcmData);

    for (let i = 0; i < fadeSamples; i++) {
      // 지수 감소 방식으로 더 자연스러운 페이드아웃
      const fadeMultiplier = Math.pow(1.0 - i / fadeSamples, 2);
      const sampleIndex = (totalSamples - fadeSamples + i) * 4;

      // 왼쪽 채널
      const leftSample = result.readInt16LE(sampleIndex);
      const fadedLeft = Math.round(leftSample * fadeMultiplier);
      result.writeInt16LE(fadedLeft, sampleIndex);

      // 오른쪽 채널
      const rightSample = result.readInt16LE(sampleIndex + 2);
      const fadedRight = Math.round(rightSample * fadeMultiplier);
      result.writeInt16LE(fadedRight, sampleIndex + 2);
    }

    return result;
  }

  // 페이드 없이 재생하는 백업 메서드 (기존 방식 유지)
  async playTTSFileWithoutFade(filePath) {
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
          console.error(`[TTS] Error during playback without fade:`, err);
          reject(err);
        })
        .on('end', () => {
          console.log(`[TTS] ✓ Playback completed (no fade - fallback)`);
          resolve();
        })
        .pipe(speaker);
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
