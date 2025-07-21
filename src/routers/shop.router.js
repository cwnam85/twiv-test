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
      outfits: shopItems.outfits.map((item) => ({
        ...item,
        isOwned: item.id === 'default' ? true : ownedData.ownedOutfits.includes(item.id),
      })),
      boosters: shopItems.boosters.map((item) => ({
        ...item,
        isOwned: ownedData.ownedBoosters.includes(item.id),
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
router.post('/use-booster', (req, res) => {
  try {
    const { boosterId } = req.body;

    if (!boosterId) {
      return res.status(400).json({ error: '부스터 ID가 누락되었습니다.' });
    }

    // 부스터 사용 처리
    const useResult = shopService.useBooster(boosterId);

    // 호감도 서비스에서 부스터 활성화
    const affinityResult = affinityService.activateBooster();

    res.json({
      success: true,
      message: '부스터가 활성화되었습니다. 호감도가 100으로 설정되고 10분간 유지됩니다.',
      activeBooster: useResult.activeBooster,
      affinity: affinityResult.affinity,
      ownedBoosters: useResult.ownedBoosters,
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

    res.json({
      shopBoosterStatus: boosterStatus,
      affinityBoosterStatus: {
        boosterActive: affinityData.boosterActive,
        boosterRemainingTime: affinityData.boosterRemainingTime,
      },
    });
  } catch (error) {
    console.error('Error checking booster status:', error);
    res.status(500).json({ error: 'Failed to check booster status' });
  }
});

// 아이템 착용
router.post('/equip', (req, res) => {
  try {
    const { itemId, itemType } = req.body;

    if (!itemId || !itemType) {
      return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
    }

    // 착용 처리 (기본 의상은 구매 여부 체크 생략)
    const equipResult = shopService.equipItem(itemId, itemType);

    // 복장을 착용한 경우 서버의 복장 데이터도 업데이트
    if (itemType === 'outfit') {
      try {
        // 동적으로 의상 ID를 서버 의상 이름으로 매핑
        const outfitName = shopService.mapOutfitIdToServerName(itemId);

        // 서버 복장 전체 변경
        characterService.changeToOutfit(outfitName);

        // 시스템 프롬프트 업데이트
        characterService.updateSystemPrompt(characterService.getOutfitData().outfitData);

        console.log(`Server outfit changed to: ${outfitName}`);

        // 상점 데이터에도 서버 복장 정보 반영
        const shopData = shopService.getShopData();
        shopData.currentOutfit = outfitName;
        shopService.saveShopData(shopData);

        // 의상 착용 완료 후 챗 라우터를 통해 LLM에게 알림
        try {
          const shopItems = shopService.getShopItems();
          const outfitItem = shopItems.outfits.find((item) => item.id === itemId);
          const outfitDisplayName = outfitItem ? outfitItem.name : itemId;

          // 챗 라우터의 /chat 엔드포인트를 호출하여 의상 착용 반응 생성
          const outfitReactionMessage = `캐릭터가 유저의 요청에 의해 ${outfitDisplayName}을(를) 착용했습니다. 이에 대한 자연스러운 반응을 해주세요.`;

          // 비동기로 챗 라우터 함수 호출 (응답을 기다리지 않음)
          processChatMessage(outfitReactionMessage, outfitReactionMessage, true) // skipPointCheck = true
            .then((data) => {
              console.log('Outfit reaction generated via chat router function:', data.message);
              console.log('Audio data generated:', data.audioData ? 'success' : 'failed');

              // 클라이언트에 알림을 위한 상태 업데이트
              // (클라이언트에서 주기적으로 확인할 수 있도록)
              const notificationData = {
                type: 'outfit_reaction',
                message: data.message,
                audioData: data.audioData,
                timestamp: Date.now(),
              };

              // 전역 상태에 저장 (클라이언트가 확인할 수 있도록)
              global.outfitReactionNotification = notificationData;
            })
            .catch((error) => {
              console.error('Error calling chat router function for outfit reaction:', error);
            });
        } catch (chatError) {
          console.error('Error sending outfit change to chat router:', chatError);
        }
      } catch (outfitError) {
        console.error('Error updating server outfit:', outfitError);
      }
    }

    res.json({
      success: true,
      message: '착용이 완료되었습니다.',
      currentBackground: equipResult.currentBackground,
      currentOutfit: equipResult.currentOutfit,
    });
  } catch (error) {
    console.error('Error equipping item:', error);
    res.status(400).json({ error: error.message });
  }
});

// 의상 착용 반응 알림 확인 엔드포인트
router.get('/outfit-reaction-notification', (req, res) => {
  try {
    const notification = global.outfitReactionNotification;

    if (notification) {
      // 알림을 반환하고 즉시 삭제 (한 번만 전송)
      delete global.outfitReactionNotification;
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
