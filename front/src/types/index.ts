export interface OutfitItem {
  name: string;
  enabled: boolean;
  removable_affinity: number | null;
}

export interface OutfitParts {
  [category: string]: {
    [itemName: string]: OutfitItem | null;
  };
}

// 새로운 백엔드 구조에 맞는 타입 정의
export interface CharacterOutfitState {
  current_outfit: string;
  upper_body: { [category: string]: boolean };
  lower_body: { [category: string]: boolean };
  feet: { [category: string]: boolean };
  accessories: { [category: string]: boolean };
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
  type: 'background' | 'outfit' | 'booster';
  price: number;
  description: string;
  image?: string;
  isOwned: boolean;
}

export interface ShopData {
  backgrounds: ShopItem[];
  outfits: ShopItem[];
  boosters: ShopItem[];
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
