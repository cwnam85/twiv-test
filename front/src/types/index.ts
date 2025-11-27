export interface AppearanceItem {
  name: string;
  enabled: boolean;
  removable_affinity: number | null;
}

export interface AppearanceParts {
  [itemName: string]: AppearanceItem | null;
}

// 새로운 백엔드 구조에 맞는 타입 정의
export interface CharacterAppearanceState {
  current_appearance: string;
  current_background: string;
  // 새로운 구조: 직접 아이템으로 접근
  hair: boolean;
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

export interface AppearanceStateData {
  [character: string]: CharacterAppearanceState;
}

// 기존 호환성을 위한 AppearanceData 타입 (백엔드에서 병합된 데이터 반환)
export interface AppearanceData {
  appearanceName: string;
  appearanceData: {
    current_appearance: string;
    parts: AppearanceParts;
  };
}

export interface Message {
  text: string;
  narration?: string;
  inner_thoughts?: string;
  isUser: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  type: 'background' | 'appearance' | 'booster' | 'rp_pack';
  price: number;
  description: string;
  image?: string;
  isOwned: boolean;
}

export interface RpPackItem extends ShopItem {
  type: 'rp_pack';
  globalnoteFile?: string;
  autoPurchaseAppearances?: string[];
}

export interface ShopData {
  backgrounds: ShopItem[];
  appearances: ShopItem[];
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
