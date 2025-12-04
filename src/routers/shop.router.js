import express from 'express';
import shopService from '../services/shopService.js';
import affinityService from '../services/affinityService.js';
import characterService from '../services/characterService.js';
import { processChatMessage } from './chat.router.js';

const router = express.Router();

// 구매한 아이템 목록 가져오기
router.get('/owned', (req, res) => {
  try {
    const ownedData = shopService.getOwnedItems();
    res.json(ownedData);
  } catch (error) {
    console.error('Error getting owned items:', error);
    res.status(500).json({ error: 'Failed to get owned items' });
  }
});

// 상점 아이템 목록 가져오기
router.get('/items', (req, res) => {
  try {
    const shopItems = shopService.getShopItems();
    const ownedData = shopService.getOwnedItems();

    // 구매 여부 정보 추가 (기본 의상과 기본 배경은 항상 소유)
    const itemsWithOwnedStatus = {
      backgrounds: shopItems.backgrounds.map((item) => ({
        ...item,
        isOwned: item.id === 'default' ? true : ownedData.ownedBackgrounds.includes(item.id),
      })),
      appearances: shopItems.appearances.map((item) => ({
        ...item,
        isOwned: item.id === 'default' ? true : ownedData.ownedAppearances.includes(item.id),
      })),
      boosters: shopItems.boosters.map((item) => ({
        ...item,
        isOwned: ownedData.ownedBoosters.includes(item.id),
      })),
      rpPacks: shopItems.rpPacks.map((item) => ({
        ...item,
        isOwned: ownedData.ownedRpPacks.includes(item.id),
      })),
    };

    res.json(itemsWithOwnedStatus);
  } catch (error) {
    console.error('Error getting shop items:', error);
    res.status(500).json({ error: 'Failed to get shop items' });
  }
});

// 아이템 구매
router.post('/purchase', (req, res) => {
  try {
    const { itemId, itemType, price } = req.body;
    const currentPoints = affinityService.getData().point;

    if (!itemId || !itemType || price === undefined || price === null) {
      return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
    }

    // 구매 처리
    const purchaseResult = shopService.purchaseItem(itemId, itemType, price, currentPoints);

    // 기본 의상이 아닌 경우에만 포인트 차감
    if (price > 0) {
      affinityService.updatePoint(-price);
    }

    res.json({
      success: true,
      message: '구매가 완료되었습니다.',
      newPoint: purchaseResult.newPoint,
      ownedItems: purchaseResult.ownedItems,
    });
  } catch (error) {
    console.error('Error purchasing item:', error);
    res.status(400).json({ error: error.message });
  }
});

// 부스터 사용
router.post('/use-booster', async (req, res) => {
  try {
    const { boosterId } = req.body;

    if (!boosterId) {
      return res.status(400).json({ error: '부스터 ID가 누락되었습니다.' });
    }

    // 부스터 사용 처리
    const useResult = shopService.useBooster(boosterId);

    // 호감도 서비스에서 부스터 활성화
    const affinityResult = affinityService.activateBooster();

    // 부스터 활성화에 대한 LLM 반응 생성
    let boosterReaction = null;
    try {
      const shopItems = shopService.getShopItems();
      const boosterItem = shopItems.boosters.find((item) => item.id === boosterId);
      const boosterName = boosterItem ? boosterItem.name : '부스터';

      const reactionMessage = `shaki has consumed an Affinity Booster that enhances emotional connection. Please express how shaki feels more receptive and emotionally responsive to the user's interactions. Show that shaki is experiencing heightened sensitivity to the user's presence and actions.`;

      console.log('Starting booster activation reaction generation...');
      const reactionData = await processChatMessage(reactionMessage, reactionMessage, true); // skipPointCheck = true

      boosterReaction = {
        message: reactionData.message,
        audioData: reactionData.audioData,
      };

      console.log('Booster activation reaction generated:', reactionData.message);
      console.log('Audio data generated:', reactionData.audioData ? 'success' : 'failed');
    } catch (chatError) {
      console.error('Error generating booster activation reaction:', chatError);
    }

    res.json({
      success: true,
      message: '부스터가 활성화되었습니다. 호감도가 100으로 설정되고 10분간 유지됩니다.',
      activeBooster: useResult.activeBooster,
      affinity: affinityResult.affinity,
      ownedBoosters: useResult.ownedBoosters,
      boosterReaction: boosterReaction,
    });
  } catch (error) {
    console.error('Error using booster:', error);
    res.status(400).json({ error: error.message });
  }
});

// 부스터 상태 확인
router.get('/booster-status', (req, res) => {
  try {
    const boosterStatus = shopService.checkBoosterExpiration();
    const affinityData = affinityService.getData();
    const activeRpPack = shopService.getActiveRpPack();
    const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';

    // 활성 RP팩이 있으면 additionalInfo 로드
    let characterWeakness = null;
    if (activeRpPack) {
      const rpPackContent = shopService.loadRpPackContent(activeRpPack.id, activeCharacter);
      if (rpPackContent?.additionalInfo?.weakness_ko) {
        characterWeakness = rpPackContent.additionalInfo.weakness_ko;
      }
    }

    res.json({
      shopBoosterStatus: boosterStatus,
      affinityBoosterStatus: {
        boosterActive: affinityData.boosterActive,
        boosterRemainingTime: affinityData.boosterRemainingTime,
      },
      activeRpPack: activeRpPack,
      characterWeakness: characterWeakness,
    });
  } catch (error) {
    console.error('Error checking booster status:', error);
    res.status(500).json({ error: 'Failed to check booster status' });
  }
});

// 아이템 착용
router.post('/equip', async (req, res) => {
  try {
    const { items } = req.body;
    console.log('Equip request received:', { items });

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: '아이템 정보가 누락되었습니다.' });
    }

    // 각 아이템 착용 처리
    const equipResults = [];
    const changedItems = [];

    for (const item of items) {
      const { itemId, itemType } = item;
      if (!itemId || !itemType) {
        return res.status(400).json({ error: '아이템 정보가 올바르지 않습니다.' });
      }

      const equipResult = shopService.equipItem(itemId, itemType);
      equipResults.push(equipResult);

      // 변경된 아이템 정보 수집
      changedItems.push({ itemId, itemType });
    }

    console.log('Equip results:', equipResults);

    // 변경된 아이템들에 대한 서버 처리
    let appearanceChanged = false;
    let backgroundChanged = false;
    let changedAppearanceName = null;
    let changedBackgroundName = null;
    const shopItems = shopService.getShopItems();

    for (const item of changedItems) {
      const { itemId, itemType } = item;

      if (itemType === 'appearance') {
        try {
          // 동적으로 외모 ID를 서버 외모 이름으로 매핑
          const appearanceName = shopService.mapAppearanceIdToServerName(itemId);

          // 서버 외모 전체 변경
          characterService.changeToAppearance(appearanceName);

          // 시스템 프롬프트 업데이트
          characterService.updateSystemPrompt(characterService.getAppearanceData().appearanceData);

          console.log(`Server appearance changed to: ${appearanceName}`);

          // character_state.json에서 복장 정보 관리 (이미 characterService에서 처리됨)
          console.log(`Character state updated for appearance: ${appearanceName}`);

          appearanceChanged = true;
          changedAppearanceName = appearanceName;
        } catch (appearanceError) {
          console.error('Error updating server appearance:', appearanceError);
        }
      } else if (itemType === 'background') {
        backgroundChanged = true;
        const backgroundItem = shopItems.backgrounds.find((item) => item.id === itemId);
        changedBackgroundName = backgroundItem ? backgroundItem.name : itemId;
      }
    }

    // 변경사항이 있으면 LLM에게 알림
    if (appearanceChanged || backgroundChanged) {
      try {
        let reactionMessage = '캐릭터가 유저의 요청에 의해 ';
        const changes = [];

        if (appearanceChanged) {
          const appearanceItem = shopItems.appearances.find(
            (item) => item.id === changedItems.find((i) => i.itemType === 'appearance')?.itemId,
          );
          const appearanceDisplayName = appearanceItem
            ? appearanceItem.name
            : changedAppearanceName;
          changes.push(`${appearanceDisplayName}을(를) 착용`);
        }

        if (backgroundChanged) {
          const backgroundItem = shopItems.backgrounds.find(
            (item) => item.id === changedItems.find((i) => i.itemType === 'background')?.itemId,
          );
          const backgroundDisplayName = backgroundItem
            ? backgroundItem.name
            : changedBackgroundName;
          changes.push(`${backgroundDisplayName}으로 이동`);
        }

        reactionMessage +=
          changes.join('하고 ') + '했습니다. 이에 대한 자연스러운 반응을 해주세요.';

        // 동기적으로 챗 라우터 함수 호출 (응답을 기다림)
        console.log('Starting appearance/background reaction generation...');
        const reactionData = await processChatMessage(reactionMessage, reactionMessage, true); // skipPointCheck = true

        console.log('Reaction generated via chat router function:', reactionData.message);
        console.log('Audio data generated:', reactionData.audioData ? 'success' : 'failed');

        // 응답에 반응 포함
        const responseData = {
          success: true,
          message: '착용이 완료되었습니다.',
          currentBackground: equipResults[equipResults.length - 1].currentBackground,
          currentAppearance: equipResults[equipResults.length - 1].currentAppearance,
          appearanceReaction: {
            message: reactionData.message,
            audioData: reactionData.audioData,
          },
        };

        return res.json(responseData);
      } catch (chatError) {
        console.error('Error sending appearance/background change to chat router:', chatError);
      }
    }

    // 변경사항이 없으면 기본 응답
    res.json({
      success: true,
      message: '착용이 완료되었습니다.',
      currentBackground: equipResults[equipResults.length - 1].currentBackground,
      currentOutfit: equipResults[equipResults.length - 1].currentOutfit,
    });
  } catch (error) {
    console.error('Error equipping item:', error);
    res.status(400).json({ error: error.message });
  }
});

// RP팩 활성화
router.post('/activate-rp-pack', async (req, res) => {
  try {
    const { rpPackId } = req.body;

    if (!rpPackId) {
      return res.status(400).json({ error: 'RP팩 ID가 누락되었습니다.' });
    }

    // RP팩 활성화 처리
    const activateResult = shopService.activateRpPack(rpPackId);

    // 캐릭터 서비스에서 프롬프트 새로고침
    characterService.refreshPromptForRpPack();

    // RP팩 활성화에 대한 LLM 반응 생성
    let rpPackReaction = null;
    try {
      const shopItems = shopService.getShopItems();
      let reactionMessage = 'The character arrives with the user at ';

      const changes = [];
      if (activateResult.backgroundChanged) {
        const backgroundItem = shopItems.backgrounds.find(
          (item) => item.id === activateResult.newBackground,
        );
        const backgroundName = backgroundItem ? backgroundItem.name : activateResult.newBackground;
        changes.push(`${backgroundName}`);
      }
      if (activateResult.appearanceChanged) {
        const appearanceItem = shopItems.appearances.find(
          (item) => item.id === activateResult.newOutfit,
        );
        const appearanceName = appearanceItem ? appearanceItem.name : activateResult.newOutfit;
        changes.push(`wearing ${appearanceName}`);
      }

      if (changes.length > 0) {
        reactionMessage +=
          changes.join(' and ') +
          '. Please provide a natural reaction to this special situation. In your response, do not include outfitToWear or outfitToRemove fields in the output.';

        console.log('Starting RP pack activation reaction generation...');
        const reactionData = await processChatMessage(reactionMessage, reactionMessage, true);

        rpPackReaction = {
          message: reactionData.message,
          audioData: reactionData.audioData,
          spot: reactionData.spot, // 위치 정보 추가
        };

        console.log('RP pack activation reaction generated:', reactionData.message);
      }
    } catch (chatError) {
      console.error('Error generating RP pack activation reaction:', chatError);
    }

    res.json({
      success: true,
      message: 'RP팩이 활성화되었습니다.',
      activeRpPack: activateResult.activeRpPack,
      backgroundChanged: activateResult.backgroundChanged,
      newBackground: activateResult.newBackground,
      appearanceChanged: activateResult.appearanceChanged,
      newOutfit: activateResult.newOutfit,
      rpPackReaction: rpPackReaction,
      spot: rpPackReaction?.spot || null, // 위치 정보 추가
    });
  } catch (error) {
    console.error('Error activating RP pack:', error);
    res.status(400).json({ error: error.message });
  }
});

// RP팩 비활성화
router.post('/deactivate-rp-pack', async (req, res) => {
  try {
    // RP팩 비활성화 처리
    const deactivateResult = shopService.deactivateRpPack();

    // 캐릭터 서비스에서 프롬프트 새로고침
    characterService.refreshPromptForRpPack();

    // RP팩 비활성화에 대한 LLM 반응 생성
    let rpPackReaction = null;
    try {
      const shopItems = shopService.getShopItems();
      let reactionMessage = '캐릭터가 ';

      const changes = [];
      if (deactivateResult.backgroundChanged) {
        const backgroundItem = shopItems.backgrounds.find(
          (item) => item.id === deactivateResult.previousBackground,
        );
        const backgroundName = backgroundItem
          ? backgroundItem.name
          : deactivateResult.previousBackground;
        changes.push(`${backgroundName}에서 돌아옴`);
      }
      if (deactivateResult.appearanceChanged) {
        changes.push('일상복으로 갈아입음');
      }

      if (changes.length > 0) {
        reactionMessage +=
          changes.join(' and ') +
          '. Please provide a natural reaction to this situation. In your response, do not include outfitToWear or outfitToRemove fields in the output.';

        console.log('Starting RP pack deactivation reaction generation...');
        const reactionData = await processChatMessage(reactionMessage, reactionMessage, true);

        rpPackReaction = {
          message: reactionData.message,
          audioData: reactionData.audioData,
          spot: reactionData.spot, // 위치 정보 추가
        };

        console.log('RP pack deactivation reaction generated:', reactionData.message);
      }
    } catch (chatError) {
      console.error('Error generating RP pack deactivation reaction:', chatError);
    }

    res.json({
      success: true,
      message: 'RP팩이 비활성화되었습니다.',
      activeRpPack: deactivateResult.activeRpPack,
      backgroundChanged: deactivateResult.backgroundChanged,
      previousBackground: deactivateResult.previousBackground,
      appearanceChanged: deactivateResult.appearanceChanged,
      previousOutfit: deactivateResult.previousOutfit,
      rpPackReaction: rpPackReaction,
      spot: rpPackReaction?.spot || null, // 위치 정보 추가
    });
  } catch (error) {
    console.error('Error deactivating RP pack:', error);
    res.status(400).json({ error: error.message });
  }
});

// 의상 착용 반응 알림 확인 엔드포인트
router.get('/outfit-reaction-notification', (req, res) => {
  try {
    const notification = global.outfitReactionNotification;
    console.log('Checking for outfit reaction notification:', notification ? 'found' : 'not found');

    if (notification) {
      // 알림을 반환하고 즉시 삭제 (한 번만 전송)
      delete global.outfitReactionNotification;
      console.log('Returning notification and deleting from global');
      res.json(notification);
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Error getting outfit reaction notification:', error);
    res.status(500).json({ error: 'Failed to get notification' });
  }
});

export default router;
