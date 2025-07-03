// front/src/instruction/input_instruction.ts

import { generateChatPrompt, generateThankYouPrompt } from './templateRenderer';

interface OutfitItem {
  name: string;
  enabled: boolean;
  type: string;
  layer_order: number;
  removable: {
    access: string;
    min_affinity: number | null;
  };
}

interface OutfitParts {
  [category: string]: {
    [itemName: string]: OutfitItem;
  };
}

interface OutfitData {
  outfitName: string;
  outfitData: {
    current_outfit: string;
    parts: OutfitParts;
  };
}

export const getChatPrompt = (
  currentCharacter: string,
  affinity: number,
  input: string,
  outfitData?: OutfitData,
): string => {
  return generateChatPrompt(currentCharacter, affinity, input, outfitData);
};

export const ThankYouPrompt = (
  currentCharacter: string,
  affinity: number,
  input: string,
  outfitData?: OutfitData,
): string => {
  return generateThankYouPrompt(currentCharacter, affinity, input, outfitData);
};
