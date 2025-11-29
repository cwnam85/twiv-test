import fs from 'fs';
import path from 'path';
import characterStateService from './characterStateService.js';
import backgroundService from './backgroundService.js';
import characterService from './characterService.js';

// RP 팩 JSON 파일 경로
const RP_PACKS_BASE_PATH = path.join(process.cwd(), 'vtuber_prompts', 'characters');

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
          ownedAppearances: [],
          ownedBoosters: [],
          currentBackground: 'default',
          currentAppearance: 'default',
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
        ownedAppearances: [],
        ownedBoosters: [],
        currentBackground: 'default',
        currentAppearance: 'default',
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
    const defaultState = characterStateService.getDefaultCurrentState();

    return {
      ownedBackgrounds: shopData.ownedBackgrounds || [],
      ownedAppearances: shopData.ownedAppearances || [],
      ownedBoosters: shopData.ownedBoosters || [],
      ownedRpPacks: shopData.ownedRpPacks || [],
      currentBackground: defaultState.currentBackground,
      currentAppearance: defaultState.currentAppearance,
      activeBooster: shopData.activeBooster || null,
      activeRpPack: shopData.activeRpPack || null,
    };
  }

  // 아이템 구매
  purchaseItem(itemId, itemType, price, currentPoints) {
    const shopData = this.getShopData();

    // 이미 구매한 아이템인지 확인
    let isAlreadyOwned = false;
    if (itemType === 'background') {
      isAlreadyOwned = (shopData.ownedBackgrounds || []).includes(itemId);
    } else if (itemType === 'appearance') {
      isAlreadyOwned = (shopData.ownedAppearances || []).includes(itemId);
    } else if (itemType === 'booster') {
      isAlreadyOwned = (shopData.ownedBoosters || []).includes(itemId);
    } else if (itemType === 'rp_pack') {
      isAlreadyOwned = (shopData.ownedRpPacks || []).includes(itemId);
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
    } else if (itemType === 'appearance') {
      if (!shopData.ownedAppearances) shopData.ownedAppearances = [];
      shopData.ownedAppearances.push(itemId);
    } else if (itemType === 'booster') {
      if (!shopData.ownedBoosters) shopData.ownedBoosters = [];
      shopData.ownedBoosters.push(itemId);
    } else if (itemType === 'rp_pack') {
      if (!shopData.ownedRpPacks) shopData.ownedRpPacks = [];
      shopData.ownedRpPacks.push(itemId);

      // RP팩 구매 시 자동으로 의상들도 구매
      const shopItems = this.getShopItems();
      const rpPack = shopItems.rpPacks.find((pack) => pack.id === itemId);
      if (rpPack && rpPack.autoPurchaseOutfits) {
        for (const outfitId of rpPack.autoPurchaseOutfits) {
          if (!shopData.ownedAppearances.includes(outfitId)) {
            shopData.ownedAppearances.push(outfitId);
          }
        }
      }
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
      ownedAppearances: shopData.ownedAppearances || [],
      ownedBoosters: shopData.ownedBoosters || [],
      ownedRpPacks: shopData.ownedRpPacks || [],
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
        : shopData.ownedAppearances.includes(itemId));

    if (!isOwned) {
      throw new Error('구매하지 않은 상품입니다.');
    }

    // 착용 처리 - character_state.json에서 관리
    const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';

    if (itemType === 'background') {
      characterStateService.setCurrentBackground(activeCharacter, itemId);
    } else if (itemType === 'appearance') {
      characterStateService.setCurrentAppearance(activeCharacter, itemId);
    }

    // 데이터 저장
    if (!this.saveShopData(shopData)) {
      throw new Error('착용 처리 중 오류가 발생했습니다.');
    }

    const currentState = characterStateService.getCharacterState(activeCharacter);
    return {
      success: true,
      currentBackground: currentState?.current_background || 'default',
      currentAppearance: currentState?.current_appearance || 'default',
    };
  }

  // 상점 아이템 목록 가져오기
  getShopItems() {
    return {
      backgrounds: this.getBackgroundsFromJson(),
      appearances: this.getAppearancesFromJson(),
      boosters: [
        {
          id: 'affinity_booster',
          name: '호감도 부스터',
          type: 'booster',
          price: 200,
          description: '호감도를 100으로 설정하고 10분간 유지합니다.',
        },
      ],
      rpPacks: [
        {
          id: 'default_rp_pack',
          name: '기본 RP팩',
          type: 'rp_pack',
          price: 0,
          description: '캐릭터의 일상적인 방송 공간에서의 자연스러운 대화',
          globalnoteFile: 'defaultRP/globalnote.md',
          autoPurchaseOutfits: [],
        },
        {
          id: 'onsen_rp_pack',
          name: '온천 RP팩',
          type: 'rp_pack',
          price: 500,
          description: '온천에서의 특별한 롤플레잉을 경험해보세요.',
          globalnoteFile: 'onsendate/globalnote.md',
          autoPurchaseOutfits: ['kimono', 'gown'],
        },
      ],
    };
  }

  // backgrounds 폴더에서 배경 정보를 읽어와서 상점 아이템 형태로 변환
  getBackgroundsFromJson() {
    try {
      // 현재 활성 캐릭터 확인
      const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';

      // backgroundService를 사용하여 사용 가능한 배경 목록 가져오기
      const availableBackgrounds = backgroundService.getAvailableBackgrounds(activeCharacter);

      // 배경 목록을 상점 아이템 형태로 변환
      const backgrounds = availableBackgrounds.map((bg) => ({
        id: bg.id,
        name: bg.name,
        type: 'background',
        price: bg.price || 100, // 기본 가격 100
        description: bg.description,
        hasSpots: bg.hasSpots,
        spotsCount: bg.spotsCount,
      }));

      return backgrounds;
    } catch (error) {
      console.error('Error reading backgrounds from directory:', error);
      return [
        {
          id: 'default',
          name: '기본 배경',
          type: 'background',
          price: 0,
          description: '기본 배경으로 돌아갑니다.',
        },
      ];
    }
  }

  // appearance 폴더에서 의상 정보를 읽어와서 상점 아이템 형태로 변환
  getAppearancesFromJson() {
    try {
      // 현재 활성 캐릭터 확인
      const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';

      // 캐릭터의 appearance 폴더 경로
      const appearancesDir = path.join(
        process.cwd(),
        'vtuber_prompts',
        'characters',
        activeCharacter,
        'appearance',
      );

      if (!fs.existsSync(appearancesDir)) {
        console.warn(`Appearance directory not found for character: ${activeCharacter}`);
        return [
          {
            id: 'default',
            name: '기본 의상',
            type: 'appearance',
            price: 0,
            description: '기본 의상으로 돌아갑니다.',
          },
        ];
      }

      // appearance 폴더의 모든 JSON 파일 읽기
      const outfitFiles = fs.readdirSync(appearancesDir).filter((file) => file.endsWith('.json'));

      if (outfitFiles.length === 0) {
        console.warn(`No outfit files found in directory: ${appearancesDir}`);
        return [
          {
            id: 'default',
            name: '기본 의상',
            type: 'appearance',
            price: 0,
            description: '기본 의상으로 돌아갑니다.',
          },
        ];
      }

      // 각 의상 파일을 읽어서 상점 아이템 형태로 변환
      const appearances = outfitFiles.map((filename) => {
        const outfitId = filename.replace('.json', '');
        const outfitPath = path.join(appearancesDir, filename);

        try {
          const outfitData = JSON.parse(fs.readFileSync(outfitPath, 'utf8'));
          return {
            id: outfitId,
            name: outfitData.name || outfitId,
            type: 'appearance',
            price: outfitData.price || 0,
            description:
              outfitData.description || `${outfitData.name || outfitId}을(를) 입어보세요.`,
          };
        } catch (error) {
          console.error(`Error reading outfit file ${filename}:`, error);
          return {
            id: outfitId,
            name: outfitId,
            type: 'appearance',
            price: 0,
            description: `${outfitId}을(를) 입어보세요.`,
          };
        }
      });

      return appearances;
    } catch (error) {
      console.error('Error reading appearances from directory:', error);
      return [
        {
          id: 'default',
          name: '기본 의상',
          type: 'appearance',
          price: 0,
          description: '기본 의상으로 돌아갑니다.',
        },
      ];
    }
  }

  // 의상 ID를 서버 의상 이름으로 매핑
  mapAppearanceIdToServerName(itemId) {
    try {
      // 현재 활성 캐릭터 확인
      const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';

      // 캐릭터의 appearance 폴더 경로
      const appearancesDir = path.join(
        process.cwd(),
        'vtuber_prompts',
        'characters',
        activeCharacter,
        'appearance',
      );

      // 기본 의상인 경우
      if (itemId === 'default') {
        return 'casual';
      }

      // 해당 의상 파일이 존재하는지 확인
      const outfitPath = path.join(appearancesDir, `${itemId}.json`);
      if (fs.existsSync(outfitPath)) {
        return itemId; // 의상 ID가 그대로 서버 의상 이름이 됨
      }

      console.warn(`Outfit file not found: ${outfitPath}`);
      return 'casual'; // 기본값
    } catch (error) {
      console.error('Error mapping outfit ID to server name:', error);
      return 'casual'; // 에러 시 기본값
    }
  }

  // RP팩 활성화
  activateRpPack(rpPackId) {
    const shopData = this.getShopData();

    // RP팩을 소유하고 있는지 확인
    if (!(shopData.ownedRpPacks || []).includes(rpPackId)) {
      throw new Error('구매하지 않은 RP팩입니다.');
    }

    // 이미 활성화된 RP팩이 있으면 자동으로 비활성화
    if (shopData.activeRpPack) {
      console.log(`Deactivating current RP pack: ${shopData.activeRpPack.id}`);
      this.deactivateRpPack();
    }

    // RP팩별 배경 및 의상 매핑
    const rpPackBackgrounds = {
      default_rp_pack: 'default',
      onsen_rp_pack: 'onsen',
    };

    const rpPackOutfits = {
      default_rp_pack: 'casual',
      onsen_rp_pack: 'kimono',
    };

    // RP팩 활성화
    shopData.activeRpPack = {
      id: rpPackId,
      activatedAt: new Date().toISOString(),
    };

    // RP팩에 해당하는 배경과 의상이 있으면 변경
    const newBackground = rpPackBackgrounds[rpPackId];
    const newAppearance = rpPackOutfits[rpPackId];

    const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';

    if (newBackground) {
      // 온천 배경을 소유하고 있지 않으면 추가
      if (!shopData.ownedBackgrounds.includes(newBackground)) {
        shopData.ownedBackgrounds.push(newBackground);
      }
      characterStateService.setCurrentBackground(activeCharacter, newBackground);
      console.log(`Background changed to ${newBackground} for RP pack ${rpPackId}`);
    }

    if (newAppearance) {
      // 기모노를 소유하고 있지 않으면 추가
      if (!shopData.ownedAppearances.includes(newAppearance)) {
        shopData.ownedAppearances.push(newAppearance);
      }
      characterStateService.setCurrentAppearance(activeCharacter, newAppearance);

      // RP 팩 의상 변경 완료
      console.log(`Outfit changed to ${newAppearance} for RP pack ${rpPackId}`);
    }

    // 데이터 저장
    if (!this.saveShopData(shopData)) {
      throw new Error('RP팩 활성화 중 오류가 발생했습니다.');
    }

    return {
      success: true,
      activeRpPack: shopData.activeRpPack,
      backgroundChanged: !!newBackground,
      newBackground: newBackground,
      appearanceChanged: !!newAppearance,
      newAppearance: newAppearance,
    };
  }

  // RP팩 비활성화
  deactivateRpPack() {
    const shopData = this.getShopData();

    if (!shopData.activeRpPack) {
      throw new Error('활성화된 RP팩이 없습니다.');
    }

    const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';

    // RP팩 비활성화 시 무조건 기본 배경과 기본 의상으로 되돌리기
    shopData.activeRpPack = null;
    characterStateService.setCurrentBackground(activeCharacter, 'default');

    // RP 팩 비활성화 시 의상 변경
    characterStateService.setCurrentAppearance(activeCharacter, 'casual');
    console.log('Background and outfit changed back to default after RP pack deactivation');

    // 데이터 저장
    if (!this.saveShopData(shopData)) {
      throw new Error('RP팩 비활성화 중 오류가 발생했습니다.');
    }

    return {
      success: true,
      activeRpPack: null,
      backgroundChanged: true,
      newBackground: 'default',
      appearanceChanged: true,
      newAppearance: 'casual',
    };
  }

  // 활성화된 RP팩 정보 가져오기
  getActiveRpPack() {
    const shopData = this.getShopData();
    return shopData.activeRpPack || null;
  }

  // 기본 RP 팩 데이터 생성
  getDefaultRpPackData(rpPackId) {
    return {
      id: rpPackId || 'default_rp_pack',
      name: 'Default RP Pack',
      price: 0,
      description: null,
      globalnote: null,
      locationguide: null,
      messagePrompt: null,
    };
  }

  // RP 팩 JSON 파일 로드
  loadRpPack(character, rpPackId) {
    try {
      const rpPackPath = path.join(RP_PACKS_BASE_PATH, character, 'rppacks', `${rpPackId}.json`);

      if (!fs.existsSync(rpPackPath)) {
        console.warn(
          `[SHOP SERVICE] RP pack file not found: ${rpPackPath}, using default structure`,
        );
        return this.getDefaultRpPackData(rpPackId);
      }

      const rpPackData = fs.readFileSync(rpPackPath, 'utf8');
      return JSON.parse(rpPackData);
    } catch (error) {
      console.error(`Error loading RP pack ${rpPackId} for character ${character}:`, error);
      return this.getDefaultRpPackData(rpPackId);
    }
  }

  // 캐릭터별 RP 팩 목록 가져오기
  getCharacterRpPacks(character) {
    try {
      const rppacksDir = path.join(RP_PACKS_BASE_PATH, character, 'rppacks');

      if (!fs.existsSync(rppacksDir)) {
        return [];
      }

      const files = fs.readdirSync(rppacksDir);
      return files
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.replace('.json', ''));
    } catch (error) {
      console.error(`Error getting RP packs for character ${character}:`, error);
      return [];
    }
  }

  // RP 팩 내용 로드 (마크다운 파일 읽기)
  loadRpPackContent(rpPackId, character = 'shaki') {
    try {
      const rpPack = this.loadRpPack(character, rpPackId);
      if (!rpPack) return null;

      const content = {};

      // description 파일 읽기
      if (rpPack.description) {
        const descriptionPath = path.join(process.cwd(), rpPack.description);
        if (fs.existsSync(descriptionPath)) {
          content.description = fs.readFileSync(descriptionPath, 'utf8');
        }
      }

      // globalnote 파일 읽기
      if (rpPack.globalnote) {
        const globalnotePath = path.join(process.cwd(), rpPack.globalnote);
        if (fs.existsSync(globalnotePath)) {
          content.globalnote = fs.readFileSync(globalnotePath, 'utf8');
        }
      }

      // locationguide 파일 읽기
      if (rpPack.locationguide) {
        const locationguidePath = path.join(process.cwd(), rpPack.locationguide);
        if (fs.existsSync(locationguidePath)) {
          content.locationguide = fs.readFileSync(locationguidePath, 'utf8');
        }
      }

      // messagePrompt 파일 읽기
      if (rpPack.messagePrompt) {
        const messagePromptPath = path.join(process.cwd(), rpPack.messagePrompt);
        console.log(`Loading messagePrompt from: ${messagePromptPath}`);
        if (fs.existsSync(messagePromptPath)) {
          content.messagePrompt = fs.readFileSync(messagePromptPath, 'utf8');
          console.log(
            `messagePrompt loaded successfully: ${content.messagePrompt.substring(0, 100)}...`,
          );
        } else {
          console.warn(`messagePrompt file not found: ${messagePromptPath}`);
        }
      }

      return content;
    } catch (error) {
      console.error(`Error loading RP pack content for ${rpPackId}:`, error);
      return null;
    }
  }
}

export default new ShopService();
