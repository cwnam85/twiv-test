import fs from 'fs';
import path from 'path';
import nunjucks from 'nunjucks';

// 템플릿 파일 읽기
function readTemplate(templateName) {
  const templatePath = path.join(process.cwd(), 'src', 'templates', `${templateName}.md`);
  try {
    return fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    console.error(`Error reading template ${templateName}:`, error);
    return null;
  }
}

// nunjucks 환경 설정
const env = nunjucks.configure({
  autoescape: false,
  trimBlocks: true,
  lstripBlocks: true,
});

// 템플릿 렌더링 함수
function renderTemplate(template, context) {
  try {
    return env.renderString(template, context);
  } catch (error) {
    console.error('Error rendering template with nunjucks:', error);

    // 폴백: 단순 치환 방식
    let result = template;
    Object.entries(context).forEach(([key, value]) => {
      const placeholder = `{{ ${key} }}`;
      result = result.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        String(value),
      );
    });
    return result;
  }
}

// 배경 정보 생성
function generateBackgroundInfo(backgroundId) {
  if (!backgroundId) {
    return 'Default Background';
  }

  const backgroundNames = {
    default: 'Default Background',
    school: 'School',
    beach: 'Beach',
  };

  return backgroundNames[backgroundId] || backgroundId;
}

// 복장 정보 생성
function generateOutfitInfo(outfitData) {
  if (!outfitData || !outfitData.outfitName || !outfitData.outfitData) {
    return 'default';
  }

  const { outfitName, outfitData: data } = outfitData;
  const enabledItems = [];

  Object.entries(data.parts).forEach(([category, items]) => {
    Object.entries(items).forEach(([itemName, itemData]) => {
      if (itemData && itemData.enabled) {
        enabledItems.push(`${category}.${itemName}: ${itemData.name}`);
      }
    });
  });

  return `${outfitName} (${enabledItems.join(', ')})`;
}

// 복장 상세 정보 생성
function generateOutfitDetail(outfitData) {
  if (!outfitData || !outfitData.outfitData) {
    return '[]';
  }

  const { outfitData: data } = outfitData;
  const enabledItems = [];

  Object.entries(data.parts).forEach(([category, items]) => {
    Object.entries(items).forEach(([itemName, itemData]) => {
      if (itemData && itemData.enabled) {
        enabledItems.push(`${category}.${itemName}: ${itemData.name}`);
      }
    });
  });

  return `[${enabledItems.join(', ')}]`;
}

// 벗을 수 있는 아이템들 생성
function generateUndressableItems(outfitData, affinity = 0) {
  if (!outfitData || !outfitData.outfitData) {
    return '[]';
  }

  const { outfitData: data } = outfitData;
  const removableItems = [];

  const allowedCategories = ['upper_body', 'lower_body'];

  Object.entries(data.parts).forEach(([category, items]) => {
    if (allowedCategories.includes(category)) {
      Object.entries(items).forEach(([itemName, itemData]) => {
        if (itemData && itemData.enabled) {
          if (itemData.removable_affinity !== null && affinity >= itemData.removable_affinity) {
            removableItems.push(`${category}.${itemName}`);
          }
        }
      });
    }
  });

  return `[${removableItems.join(', ')}]`;
}

// 착용 가능한 아이템들 생성
function generateWearableItems(outfitData) {
  if (!outfitData || !outfitData.outfitData) {
    return '[]';
  }

  const { outfitData: data } = outfitData;
  const wearableItems = [];

  Object.entries(data.parts).forEach(([category, items]) => {
    Object.entries(items).forEach(([itemName, itemData]) => {
      if (itemData && !itemData.enabled) {
        wearableItems.push(`${category}.${itemName}`);
      }
    });
  });

  return `[${wearableItems.join(', ')}]`;
}

// 잠긴 아이템들 생성
function generateLockedItems(outfitData) {
  if (!outfitData || !outfitData.outfitData) {
    return '[]';
  }

  const { outfitData: data } = outfitData;
  const lockedItems = [];

  Object.entries(data.parts).forEach(([category, items]) => {
    Object.entries(items).forEach(([itemName, itemData]) => {
      if (itemData && itemData.enabled && itemData.removable_affinity === null) {
        lockedItems.push(`${category}.${itemName}: ${itemData.name}`);
      }
    });
  });

  return `[${lockedItems.join(', ')}]`;
}

// 채팅 프롬프트 생성
export function generateChatPrompt(context) {
  console.log('=== TEMPLATE RENDERER DEBUG ===');
  console.log('Context received:', JSON.stringify(context, null, 2));

  const template = readTemplate('chat_template');
  if (!template) {
    console.error('Chat template not found');
    return null;
  }

  const templateContext = {
    userInput: context.userInput || '',
    affinity: context.affinity || 0,
    currentBackground: generateBackgroundInfo(context.currentBackground),
    currentOutfit: generateOutfitInfo(context.outfitData),
    outfitDetail: generateOutfitDetail(context.outfitData),
    undressableItems: generateUndressableItems(context.outfitData, context.affinity),
    wearableItems: generateWearableItems(context.outfitData),
    lockedItems: generateLockedItems(context.outfitData),
    ownedBackgrounds: context.ownedBackgrounds || 'none',
    ownedOutfits: context.ownedOutfits || 'none',
    isAdultCharacter: context.isAdultCharacter || false,
    character: context.character || 'shaki',
  };

  console.log('Template context:', JSON.stringify(templateContext, null, 2));

  const result = renderTemplate(template, templateContext);
  console.log('Template rendering result length:', result ? result.length : 'null');
  console.log('=== END TEMPLATE DEBUG ===');

  return result;
}

// 감사 인사 프롬프트 생성
export function generateThankYouPrompt(context) {
  const template = readTemplate('thankyou_template');
  if (!template) {
    console.error('Thank you template not found');
    return null;
  }

  const templateContext = {
    userInput: context.userInput || '',
    affinity: context.affinity || 0,
    currentBackground: generateBackgroundInfo(context.currentBackground),
    currentOutfit: generateOutfitInfo(context.outfitData),
    outfitDetail: generateOutfitDetail(context.outfitData),
    undressableItems: generateUndressableItems(context.outfitData, context.affinity),
    wearableItems: generateWearableItems(context.outfitData),
    lockedItems: generateLockedItems(context.outfitData),
    ownedBackgrounds: context.ownedBackgrounds || 'none',
    ownedOutfits: context.ownedOutfits || 'none',
    isAdultCharacter: context.isAdultCharacter || false,
    character: context.character || 'shaki',
  };

  return renderTemplate(template, templateContext);
}
