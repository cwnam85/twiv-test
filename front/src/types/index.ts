export interface OutfitItem {
  name: string;
  enabled: boolean;
  removable_affinity: number | null;
}

export interface OutfitParts {
  [category: string]: {
    [itemName: string]: OutfitItem;
  };
}

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
