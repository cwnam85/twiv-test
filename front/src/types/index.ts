export interface OutfitItem {
  name: string;
  enabled: boolean;
  removable_affinity: number | null;
}

export interface OutfitParts {
  [itemName: string]: OutfitItem | null;
}

// 새로운 백엔드 구조에 맞는 타입 정의
export interface CharacterOutfitState {
  current_outfit: string;
  current_background: string;
  // 새로운 구조: 직접 아이템으로 접근
  bra: boolean;
  top: boolean;
  outerwear: boolean;
  panty: boolean;
  bottom: boolean;
  shoes: boolean;
  hat: boolean;
  necklace: boolean;
  belt: boolean;
  [key: string]: string | boolean; // 인덱스 시그니처 추가
}

export interface OutfitStateData {
  [character: string]: CharacterOutfitState;
}

// 기존 호환성을 위한 OutfitData 타입 (백엔드에서 병합된 데이터 반환)
export interface OutfitData {
  outfitName: string;
  outfitData: {
    current_outfit: string;
    parts: OutfitParts;
  };
}

export interface Message {
  text: string;
  isUser: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  type: 'background' | 'outfit' | 'booster' | 'rp_pack';
  price: number;
  description: string;
  image?: string;
  isOwned: boolean;
}

export interface RpPackItem extends ShopItem {
  type: 'rp_pack';
  globalnoteFile?: string;
  autoPurchaseOutfits?: string[];
}

export interface ShopData {
  backgrounds: ShopItem[];
  outfits: ShopItem[];
  boosters: ShopItem[];
  rpPacks: RpPackItem[];
}

export interface BoosterStatus {
  shopBoosterStatus: {
    active?: boolean;
    expired?: boolean;
    remainingTime?: number;
  } | null;
  affinityBoosterStatus: {
    boosterActive: boolean;
    boosterRemainingTime: number | null;
  };
}
