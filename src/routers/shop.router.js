import express from 'express';
import shopService from '../services/shopService.js';
import affinityService from '../services/affinityService.js';
import characterService from '../services/characterService.js';

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
        isOwned: item.id === 'default' ? true : ownedData.ownedItems.includes(item.id),
      })),
      outfits: shopItems.outfits.map((item) => ({
        ...item,
        isOwned: item.id === 'default' ? true : ownedData.ownedItems.includes(item.id),
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
        // 상점 복장 ID에 따라 서버 복장 매핑
        let outfitName = 'casual'; // 기본값

        switch (itemId) {
          case 'default':
            outfitName = 'casual'; // 기본 의상은 casual
            break;
          case 'school_uniform':
            outfitName = 'school_uniform';
            break;
          case 'swimsuit':
            outfitName = 'swimsuit';
            break;
          default:
            outfitName = 'casual';
        }

        // 서버 복장 전체 변경
        characterService.changeToOutfit(outfitName);

        // 시스템 프롬프트 업데이트
        characterService.updateSystemPrompt(characterService.getOutfitData().outfitData);

        console.log(`Server outfit changed to: ${outfitName}`);

        // 상점 데이터에도 서버 복장 정보 반영
        const shopData = shopService.getShopData();
        shopData.currentOutfit = outfitName;
        shopService.saveShopData(shopData);
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

export default router;
