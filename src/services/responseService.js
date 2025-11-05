import { getLLMResponse } from './llmService.js';
import { playTTSSupertone } from './ttsService.js';
import { sendMessageToWarudo } from './warudoService.js';
import characterService from './characterService.js';
import affinityService from './affinityService.js';
import fs from 'fs';
import path from 'path';

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
      const action = processedResponse.action; // action 필드 추가
      const affinity = processedResponse.affinity;
      const outfitToWear = processedResponse.outfitToWear || [];
      const outfitToRemove = processedResponse.outfitToRemove || [];
      const spot = processedResponse.spot || null; // 위치 정보 추가
      // currentActivity는 이제 action으로 통합됨
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
        action, // action 필드 추가
        usage,
        affinity,
        outfitToWear,
        outfitToRemove,
        spot, // 위치 정보 추가
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
    const matchOutfitOn = dialogueText.match(/outfitToWear:\s*(\[[\s\S]*?\])/i);
    const matchOutfitOff = dialogueText.match(/outfitToRemove:\s*(\[[\s\S]*?\])/i);

    let outfitToWear = [];
    let outfitToRemove = [];

    if (matchOutfitOn) {
      try {
        const outfitToWearText = matchOutfitOn[0].replace(/outfitToWear:\s*/, '');
        outfitToWear = JSON.parse(outfitToWearText);
      } catch (e) {
        console.warn('Failed to parse outfitToWear from regex:', e);
      }
    }

    if (matchOutfitOff) {
      try {
        const outfitToRemoveText = matchOutfitOff[0].replace(/outfitToRemove:\s*/, '');
        outfitToRemove = JSON.parse(outfitToRemoveText);
      } catch (e) {
        console.warn('Failed to parse outfitToRemove from regex:', e);
      }
    }

    return {
      dialogue: matchDialogue ? matchDialogue[1].trim() : null,
      emotion: matchEmotion ? matchEmotion[1].trim() : null,
      pose: matchPose ? matchPose[1].trim() : null,
      action: 'SpeakNatural', // 정규식 방식에서는 기본값 사용
      usage: null,
      affinity: matchAffinity ? matchAffinity[1].trim() : null,
      outfitToWear,
      outfitToRemove,
      matureTags: [],
      segments: [],
    };
  }

  async processAffinityChange(affinityChange) {
    const change = parseInt(affinityChange);
    if (!isNaN(change)) {
      const result = affinityService.updateAffinity(change);

      if (result.affinityChanged) {
        // affinity 변경 시 시스템 프롬프트 업데이트
        await characterService.updateSystemPrompt();
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

  async playResponse(
    dialogue,
    emotion,
    matureTags = [],
    segments = [],
    action = null,
    nsfwBackgroundAudio = null,
  ) {
    try {
      console.log(`[DEBUG] playResponse called with nsfwBackgroundAudio: ${nsfwBackgroundAudio}`);
      // mature 태그 사용 빈도 추적을 위한 맵
      const tagCountMap = new Map();

      if (segments && segments.length > 0) {
        console.log(`[AUDIO] Preparing client-side playback with ${segments.length} segments`);

        // mature 태그 세그먼트 카운트
        for (const segment of segments) {
          if (segment.type === 'tag') {
            const type = segment.content.replace(/[\[\]]/g, ''); // [moan] -> moan
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
            const type = segment.content.replace(/[\[\]]/g, ''); // [moan] -> moan
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

        // 4단계: NSFW 포즈 기반 배경음 처리
        let backgroundAudio = null;
        let singleBackgroundAudio = null;
        console.log(`[DEBUG] nsfwBackgroundAudio: ${nsfwBackgroundAudio}, action: ${action}`);

        if (nsfwBackgroundAudio) {
          // none 액션은 배경음 재생하지 않음
          if (action === 'none') {
            console.log(`[NO BACKGROUND] none activity - no background audio will be played`);
          }
          // insertion 액션은 TTS 완료 후 한 번만 재생
          else if (action === 'insertion') {
            singleBackgroundAudio = nsfwBackgroundAudio;
            console.log(
              `[SINGLE BACKGROUND] Adding insertion audio for single playback: ${nsfwBackgroundAudio}`,
            );
            console.log(
              `[DEBUG INSERTION] action: ${action}, singleBackgroundAudio: ${singleBackgroundAudio}`,
            );
          } else {
            backgroundAudio = nsfwBackgroundAudio;
            console.log(`[BACKGROUND] Adding NSFW background audio: ${nsfwBackgroundAudio}`);
            console.log(`[DEBUG OTHER] action: ${action}, backgroundAudio: ${backgroundAudio}`);
          }
        }

        // 5단계: 클라이언트로 전송할 데이터 반환
        const clientData = {
          dialogue,
          emotion,
          segments: clientSegments,
          infiniteTag,
          backgroundAudio,
          singleBackgroundAudio,
          matureTags: Array.from(tagCountMap.keys()),
        };

        console.log(`[CLIENT] Prepared ${clientSegments.length} segments for client playback`);
        console.log(`[DEBUG] Sending backgroundAudio: ${backgroundAudio}`);
        return clientData;
      } else {
        // segments가 없으면 TTS만 생성하고 클라이언트 데이터 반환
        console.log(`[AUDIO] No segments provided, generating TTS only`);
        await playTTSSupertone(dialogue, emotion, true);

        // mature 태그 카운트
        for (const tag of matureTags) {
          const type = tag.replace(/[\[\]]/g, ''); // [kiss] -> kiss
          tagCountMap.set(type, (tagCountMap.get(type) || 0) + 1);
        }

        // 무한재생 태그 결정
        let infiniteTag = null;
        if (tagCountMap.size > 0) {
          infiniteTag = this.getMostUsedTag(tagCountMap);
          console.log(`[INFINITE] Will start infinite playback of: ${infiniteTag}`);
        }

        // NSFW 포즈 기반 배경음 처리
        let backgroundAudio = null;
        let singleBackgroundAudio = null;
        console.log(`[DEBUG] nsfwBackgroundAudio: ${nsfwBackgroundAudio}, action: ${action}`);

        if (nsfwBackgroundAudio) {
          // none 액션은 배경음 재생하지 않음
          if (action === 'none') {
            console.log(`[NO BACKGROUND] none activity - no background audio will be played`);
          }
          // insertion 액션은 TTS 완료 후 한 번만 재생
          else if (action === 'insertion') {
            singleBackgroundAudio = nsfwBackgroundAudio;
            console.log(
              `[SINGLE BACKGROUND] Adding insertion audio for single playback: ${nsfwBackgroundAudio}`,
            );
            console.log(
              `[DEBUG INSERTION] action: ${action}, singleBackgroundAudio: ${singleBackgroundAudio}`,
            );
          } else {
            backgroundAudio = nsfwBackgroundAudio;
            console.log(`[BACKGROUND] Adding NSFW background audio: ${nsfwBackgroundAudio}`);
            console.log(`[DEBUG OTHER] action: ${action}, backgroundAudio: ${backgroundAudio}`);
          }
        }

        return {
          dialogue,
          emotion,
          segments: [],
          infiniteTag,
          backgroundAudio,
          singleBackgroundAudio,
          matureTags: Array.from(tagCountMap.keys()),
        };
      }
    } catch (error) {
      console.error('[AUDIO] Error during playback:', error);
      return null;
    }
  }

  // playTTSFile 함수 제거 - 클라이언트에서 오디오 재생 처리

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
    // insertion은 singleBackgroundAudio로 처리되므로 infiniteTag에서 제외
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
    // insertion은 singleBackgroundAudio로 처리되므로 제외
    let mostUsedTag = null;
    let maxCount = 0;

    for (const [tag, count] of tagCountMap.entries()) {
      console.log(
        `[DEBUG TAG] Checking tag: ${tag}, count: ${count}, isInsertion: ${tag === 'insertion'}`,
      );
      if (tag !== 'insertion' && count > maxCount) {
        maxCount = count;
        mostUsedTag = tag;
        console.log(`[DEBUG TAG] New mostUsedTag: ${mostUsedTag} with count: ${maxCount}`);
      }
    }

    console.log(`[DEBUG TAG] Final mostUsedTag: ${mostUsedTag}`);
    return mostUsedTag;
  }

  // 랜덤 효과음 URL 생성
  getRandomEffectUrl(effectType) {
    try {
      // 활성 캐릭터 확인
      const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';
      console.log(
        `[EFFECT DEBUG] Active character: ${activeCharacter}, Effect type: ${effectType}`,
      );

      // NSFW 효과음은 항상 기본 폴더 사용
      const nsfwEffectTypes = ['touching', 'insertion', 'intercourse', 'boobjob'];
      let effectDir;
      let characterSpecificDir;

      if (nsfwEffectTypes.includes(effectType)) {
        // NSFW 효과음은 기본 폴더 사용
        effectDir = path.join(process.cwd(), 'mature_tts', effectType);
        characterSpecificDir = null; // NSFW는 캐릭터별 폴더 사용 안함
        console.log(`[EFFECT] Using default NSFW folder: ${effectDir}`);
      } else {
        // 일반 효과음은 캐릭터별 폴더 우선
        characterSpecificDir = path.join(process.cwd(), 'mature_tts', activeCharacter, effectType);
        console.log(
          `[EFFECT DEBUG] Checking character-specific directory: ${characterSpecificDir}`,
        );

        if (fs.existsSync(characterSpecificDir)) {
          effectDir = characterSpecificDir;
          console.log(
            `[EFFECT] Using character-specific folder for ${activeCharacter}: ${effectDir}`,
          );
        } else {
          // 기본 효과음 폴더 (fallback)
          effectDir = path.join(process.cwd(), 'mature_tts', effectType);
          characterSpecificDir = null; // 기본 폴더 사용
          console.log(`[EFFECT] Using default folder for ${activeCharacter}: ${effectDir}`);
        }
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

      // 캐릭터 전용 폴더를 사용 중인지 확인
      const isUsingCharacterFolder =
        characterSpecificDir !== null && fs.existsSync(characterSpecificDir);
      const effectUrl = isUsingCharacterFolder
        ? `/api/effects/${activeCharacter}/${effectType}/${randomFile}`
        : `/api/effects/${effectType}/${randomFile}`;

      console.log(`[EFFECT] Selected random effect for ${activeCharacter}: ${effectUrl}`);
      return effectUrl;
    } catch (error) {
      console.error(`[EFFECT] Error getting random effect URL for ${effectType}:`, error);
      return null;
    }
  }

  // NSFW 포즈 필드를 파싱해서 효과음으로 변환
  parseNSFWPose(poseString) {
    try {
      // "포즈명 - 행위명" 형식 파싱
      if (!poseString || typeof poseString !== 'string') {
        return null;
      }

      const parts = poseString.split(' - ');
      if (parts.length !== 2) {
        return null;
      }

      const [pose, action] = parts.map((part) => part.trim());

      // poseList.json에서 NSFW 포즈 목록 동적 추출
      const poseListPath = path.join(process.cwd(), 'src', 'data', 'poseList.json');
      const poseListData = JSON.parse(fs.readFileSync(poseListPath, 'utf8'));
      const nsfwPoses = poseListData.poseList
        .filter((poseItem) => poseItem.nsfw === true)
        .map((poseItem) => poseItem.name);

      if (!nsfwPoses.includes(pose)) {
        return null;
      }

      // 행위에 따른 효과음 매핑
      const soundMapping = {
        touching: 'touching',
        insertion: 'insertion',
        intercourse: 'intercourse',
        boobjob: 'boobjob',
      };

      const effectType = soundMapping[action];
      if (!effectType) {
        console.warn(`[NSFW SOUND] Unknown action: ${action}`);
        return null;
      }

      // 효과음 타입 반환 (URL이 아닌 타입 이름)
      console.log(`[NSFW SOUND] Playing ${effectType} sound for pose: ${pose}, action: ${action}`);
      return effectType;
    } catch (error) {
      console.error(`[NSFW SOUND] Error parsing NSFW pose:`, error);
      return null;
    }
  }

  processAppearanceChange(outfitToWear, outfitToRemove) {
    // outfitToRemove 처리 (벗기기)
    if (Array.isArray(outfitToRemove) && outfitToRemove.length > 0) {
      for (const category of outfitToRemove) {
        if (category) {
          console.log(`Processing appearance removal: ${category}`);
          try {
            characterService.changeAppearance('remove', category);
          } catch (appearanceError) {
            console.error(`Error removing appearance ${category}:`, appearanceError);
          }
        }
      }
    }

    // outfitToWear 처리 (입기)
    if (Array.isArray(outfitToWear) && outfitToWear.length > 0) {
      for (const category of outfitToWear) {
        if (category) {
          console.log(`Processing outfit wearing: ${category}`);
          try {
            characterService.changeAppearance('wear', category);
          } catch (appearanceError) {
            console.error(`Error wearing outfit ${category}:`, appearanceError);
          }
        }
      }
    }

    // 모든 변경 완료 후 시스템 프롬프트 업데이트
    if (
      (outfitToWear && outfitToWear.length > 0) ||
      (outfitToRemove && outfitToRemove.length > 0)
    ) {
      try {
        characterService.updateSystemPrompt(characterService.getAppearanceData().appearanceData);
      } catch (error) {
        console.error('Error updating system prompt after appearance changes:', error);
      }
    }
  }
}

export default new ResponseService();
