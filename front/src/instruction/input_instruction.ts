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

export const getChatPrompt = async (
  currentCharacter: string,
  affinity: number,
  input: string,
  outfitData?: OutfitData,
  backgroundId?: string,
): Promise<string> => {
  return await generateChatPrompt(currentCharacter, affinity, input, outfitData, backgroundId);
};

export const ThankYouPrompt = async (
  currentCharacter: string,
  affinity: number,
  input: string,
  outfitData?: OutfitData,
  backgroundId?: string,
): Promise<string> => {
  return await generateThankYouPrompt(currentCharacter, affinity, input, outfitData, backgroundId);
};
