import fs from 'fs';
import path from 'path';

class ShopService {
  constructor() {
    this.shopDataPath = path.join(process.cwd(), 'src', 'data', 'shop_data.json');
    this.ensureShopDataFile();
    this.cleanupExpiredBoosters(); // 서버 시작 시 만료된 부스터 정리
  }

  // 상점 데이터 파일이 없으면 생성
  ensureShopDataFile() {
    try {
      if (!fs.existsSync(this.shopDataPath)) {
        const defaultShopData = {
          ownedBackgrounds: [],
          ownedOutfits: [],
          ownedBoosters: [],
          currentBackground: 'default',
          currentOutfit: 'default',
          activeBooster: null,
          purchaseHistory: [],
        };

        // data 디렉토리가 없으면 생성
        const dataDir = path.dirname(this.shopDataPath);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        fs.writeFileSync(this.shopDataPath, JSON.stringify(defaultShopData, null, 2));
        console.log('Shop data file created:', this.shopDataPath);
      }
    } catch (error) {
      console.error('Error creating shop data file:', error);
    }
  }

  // 만료된 부스터 정리
  cleanupExpiredBoosters() {
    try {
      const shopData = this.getShopData();

      if (shopData.activeBooster) {
        const now = new Date();
        const expiresAt = new Date(shopData.activeBooster.expiresAt);

        if (now >= expiresAt) {
          console.log('Cleaning up expired booster on server start');
          shopData.activeBooster = null;
          this.saveShopData(shopData);
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired boosters:', error);
    }
  }

  // 상점 데이터 읽기
  getShopData() {
    try {
      const data = fs.readFileSync(this.shopDataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading shop data:', error);
      return {
        ownedBackgrounds: [],
        ownedOutfits: [],
        ownedBoosters: [],
        currentBackground: 'default',
        currentOutfit: 'default',
        activeBooster: null,
        purchaseHistory: [],
      };
    }
  }

  // 상점 데이터 저장
  saveShopData(data) {
    try {
      fs.writeFileSync(this.shopDataPath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving shop data:', error);
      return false;
    }
  }

  // 구매한 아이템 목록 가져오기
  getOwnedItems() {
    const shopData = this.getShopData();
    return {
      ownedBackgrounds: shopData.ownedBackgrounds || [],
      ownedOutfits: shopData.ownedOutfits || [],
      ownedBoosters: shopData.ownedBoosters || [],
      currentBackground: shopData.currentBackground || 'default',
      currentOutfit: shopData.currentOutfit || 'default',
      activeBooster: shopData.activeBooster || null,
    };
  }

  // 아이템 구매
  purchaseItem(itemId, itemType, price, currentPoints) {
    const shopData = this.getShopData();

    // 이미 구매한 아이템인지 확인
    let isAlreadyOwned = false;
    if (itemType === 'background') {
      isAlreadyOwned = (shopData.ownedBackgrounds || []).includes(itemId);
    } else if (itemType === 'outfit') {
      isAlreadyOwned = (shopData.ownedOutfits || []).includes(itemId);
    } else if (itemType === 'booster') {
      isAlreadyOwned = (shopData.ownedBoosters || []).includes(itemId);
    }

    if (isAlreadyOwned) {
      throw new Error('이미 구매한 상품입니다.');
    }

    // 포인트가 충분한지 확인
    if (currentPoints < price) {
      throw new Error('포인트가 부족합니다.');
    }

    // 구매 처리 - 아이템 타입에 따라 적절한 배열에 추가
    if (itemType === 'background') {
      if (!shopData.ownedBackgrounds) shopData.ownedBackgrounds = [];
      shopData.ownedBackgrounds.push(itemId);
    } else if (itemType === 'outfit') {
      if (!shopData.ownedOutfits) shopData.ownedOutfits = [];
      shopData.ownedOutfits.push(itemId);
    } else if (itemType === 'booster') {
      if (!shopData.ownedBoosters) shopData.ownedBoosters = [];
      shopData.ownedBoosters.push(itemId);
    }

    if (!shopData.purchaseHistory) shopData.purchaseHistory = [];
    shopData.purchaseHistory.push({
      itemId,
      itemType,
      price,
      purchasedAt: new Date().toISOString(),
    });

    // 데이터 저장
    if (!this.saveShopData(shopData)) {
      throw new Error('구매 처리 중 오류가 발생했습니다.');
    }

    return {
      success: true,
      newPoint: currentPoints - price,
      ownedBackgrounds: shopData.ownedBackgrounds || [],
      ownedOutfits: shopData.ownedOutfits || [],
      ownedBoosters: shopData.ownedBoosters || [],
    };
  }

  // 부스터 사용
  useBooster(boosterId) {
    const shopData = this.getShopData();

    // 부스터를 소유하고 있는지 확인
    if (!(shopData.ownedBoosters || []).includes(boosterId)) {
      throw new Error('구매하지 않은 부스터입니다.');
    }

    // 이미 활성화된 부스터가 있는지 확인
    if (shopData.activeBooster) {
      throw new Error('이미 활성화된 부스터가 있습니다.');
    }

    // 부스터 활성화
    shopData.activeBooster = {
      id: boosterId,
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10분 후 만료
    };

    // 사용된 부스터를 소유 목록에서 제거
    if (!shopData.ownedBoosters) shopData.ownedBoosters = [];
    const boosterIndex = shopData.ownedBoosters.indexOf(boosterId);
    if (boosterIndex > -1) {
      shopData.ownedBoosters.splice(boosterIndex, 1);
    }

    // 데이터 저장
    if (!this.saveShopData(shopData)) {
      throw new Error('부스터 사용 중 오류가 발생했습니다.');
    }

    return {
      success: true,
      activeBooster: shopData.activeBooster,
      ownedBoosters: shopData.ownedBoosters || [],
    };
  }

  // 부스터 만료 확인
  checkBoosterExpiration() {
    const shopData = this.getShopData();

    if (!shopData.activeBooster) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(shopData.activeBooster.expiresAt);

    if (now >= expiresAt) {
      // 부스터 만료
      shopData.activeBooster = null;
      this.saveShopData(shopData);
      return { expired: true };
    }

    return {
      active: true,
      remainingTime: expiresAt.getTime() - now.getTime(),
    };
  }

  // 아이템 착용
  equipItem(itemId, itemType) {
    const shopData = this.getShopData();

    // 기본 의상이나 기본 배경이 아닌 경우에만 구매 여부 확인
    const isOwned =
      itemId === 'default' ||
      (itemType === 'background'
        ? shopData.ownedBackgrounds.includes(itemId)
        : shopData.ownedOutfits.includes(itemId));

    if (!isOwned) {
      throw new Error('구매하지 않은 상품입니다.');
    }

    // 착용 처리
    if (itemType === 'background') {
      shopData.currentBackground = itemId;
    } else if (itemType === 'outfit') {
      shopData.currentOutfit = itemId;
    }

    // 데이터 저장
    if (!this.saveShopData(shopData)) {
      throw new Error('착용 처리 중 오류가 발생했습니다.');
    }

    return {
      success: true,
      currentBackground: shopData.currentBackground,
      currentOutfit: shopData.currentOutfit,
    };
  }

  // 상점 아이템 목록 가져오기
  getShopItems() {
    return {
      backgrounds: [
        {
          id: 'default',
          name: '기본 배경',
          type: 'background',
          price: 0,
          description: '기본 배경으로 돌아갑니다.',
        },
        {
          id: 'school',
          name: '학교',
          type: 'background',
          price: 50,
          description: '학교 배경으로 교실에서 대화를 나눠보세요.',
        },
        {
          id: 'beach',
          name: '해변',
          type: 'background',
          price: 80,
          description: '아름다운 해변에서 휴식을 취해보세요.',
        },
      ],
      outfits: [
        {
          id: 'default',
          name: '기본 의상',
          type: 'outfit',
          price: 0,
          description: '기본 의상으로 돌아갑니다.',
        },
        {
          id: 'school_uniform',
          name: '교복',
          type: 'outfit',
          price: 100,
          description: '깔끔한 학교 교복을 입어보세요.',
        },
        {
          id: 'swimsuit',
          name: '수영복',
          type: 'outfit',
          price: 150,
          description: '활기찬 수영복으로 즐거운 시간을 보내세요.',
        },
      ],
      boosters: [
        {
          id: 'affinity_booster',
          name: '호감도 부스터',
          type: 'booster',
          price: 200,
          description: '호감도를 100으로 설정하고 10분간 유지합니다.',
        },
      ],
    };
  }
}

export default new ShopService();
