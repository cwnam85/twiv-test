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
  level: number,
  input: string,
  outfitData?: OutfitData,
): string => {
  return generateChatPrompt(currentCharacter, level, input, outfitData);
};

export const ThankYouPrompt = (
  currentCharacter: string,
  level: number,
  input: string,
  outfitData?: OutfitData,
): string => {
  return generateThankYouPrompt(currentCharacter, level, input, outfitData);
};
