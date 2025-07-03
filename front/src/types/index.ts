export interface OutfitItem {
  name: string;
  enabled: boolean;
  type: string;
  layer_order: number;
  removable: {
    access: string;
    min_affinity: number | null;
  };
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
  type: 'background' | 'outfit';
  price: number;
  description: string;
  image?: string;
  isOwned: boolean;
}

export interface ShopData {
  backgrounds: ShopItem[];
  outfits: ShopItem[];
}
