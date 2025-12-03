import fs from 'fs';
import path from 'path';
import nunjucks from 'nunjucks';
import characterStateService from '../services/characterStateService.js';
import backgroundService from '../services/backgroundService.js';
import shopService from '../services/shopService.js';
import coercionPointService from '../services/coercionPointService.js';

// poseList.json 로드
function loadPoseList() {
  const poseListPath = path.join(process.cwd(), 'src', 'data', 'poseList.json');
  try {
    const data = fs.readFileSync(poseListPath, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.poseList || [];
  } catch (error) {
    console.error('Error loading poseList.json:', error);
    return [];
  }
}

// actionList.json 로드
function loadActionList() {
  const actionListPath = path.join(process.cwd(), 'src', 'data', 'actionList.json');
  try {
    const data = fs.readFileSync(actionListPath, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.actionList || [];
  } catch (error) {
    console.error('Error loading actionList.json:', error);
    return [];
  }
}

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

  const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';
  return backgroundService.getBackgroundName(activeCharacter, backgroundId);
}

// 외모 정보 생성
function generateAppearanceInfo(appearanceData) {
  if (!appearanceData || !appearanceData.appearanceName || !appearanceData.appearanceData) {
    return 'default';
  }

  const { appearanceName, appearanceData: data } = appearanceData;
  const enabledItems = [];

  Object.entries(data.parts).forEach(([itemName, itemData]) => {
    if (itemData && itemData.enabled) {
      enabledItems.push(`${itemName}: ${itemData.name}`);
    }
  });

  return `${appearanceName} (${enabledItems.join(', ')})`;
}

// 외모 상세 정보 생성
function generateAppearanceDetail(appearanceData) {
  if (!appearanceData || !appearanceData.appearanceData) {
    return '[]';
  }

  const { appearanceData: data } = appearanceData;
  const enabledItems = [];

  Object.entries(data.parts).forEach(([itemName, itemData]) => {
    if (itemData && itemData.enabled) {
      enabledItems.push(`${itemName}: ${itemData.name}`);
    }
  });

  return `[${enabledItems.join(', ')}]`;
}

// 벗을 수 있는 아이템들 생성
function generateUndressableItems(appearanceData, affinity = 0) {
  if (!appearanceData || !appearanceData.appearanceData) {
    return '[]';
  }

  const { appearanceData: data } = appearanceData;
  const removableItems = [];

  Object.entries(data.parts).forEach(([itemName, itemData]) => {
    if (itemData && itemData.enabled) {
      if (itemData.removable_affinity !== null && affinity >= itemData.removable_affinity) {
        removableItems.push(itemName);
      }
    }
  });

  return `[${removableItems.join(', ')}]`;
}

// 착용 가능한 아이템들 생성
function generateWearableItems(appearanceData) {
  if (!appearanceData || !appearanceData.appearanceData) {
    return '[]';
  }

  const { appearanceData: data } = appearanceData;
  const wearableItems = [];

  Object.entries(data.parts).forEach(([itemName, itemData]) => {
    if (itemData && !itemData.enabled) {
      wearableItems.push(itemName);
    }
  });

  return `[${wearableItems.join(', ')}]`;
}

// 잠긴 아이템들 생성
function generateLockedItems(appearanceData) {
  if (!appearanceData || !appearanceData.appearanceData) {
    return '[]';
  }

  const { appearanceData: data } = appearanceData;
  const lockedItems = [];

  Object.entries(data.parts).forEach(([itemName, itemData]) => {
    if (itemData && itemData.enabled && itemData.removable_affinity === null) {
      lockedItems.push(`${itemName}: ${itemData.name}`);
    }
  });

  return `[${lockedItems.join(', ')}]`;
}

// 채팅 프롬프트 생성
export function generateChatPrompt(context) {
  const template = readTemplate('chat_template');
  if (!template) {
    console.error('Chat template not found');
    return null;
  }

  // 활성 캐릭터 정보 가져오기
  const activeCharacter = process.env.ACTIVE_CHARACTER?.toLowerCase() || 'shaki';
  const characterLastPose = characterStateService.getLastPose(activeCharacter);
  const characterState = characterStateService.getCharacterState(activeCharacter);

  // 현재 배경의 spots 정보 가져오기
  const location = backgroundService.getBackgroundSpots(activeCharacter, context.currentBackground);

  // poseList와 actionList 로드
  const poseList = loadPoseList();
  const actionList = loadActionList();

  // RP팩 메시지 프롬프트 로드
  let rpPackMessagePrompt = {
    context: '',
    atmosphere: '',
    behavior: '',
  };
  if (context.activeRpPack) {
    try {
      const rpPackContent = shopService.loadRpPackContent(context.activeRpPack.id, activeCharacter);
      if (rpPackContent && rpPackContent.messagePrompt) {
        rpPackMessagePrompt = rpPackContent.messagePrompt;
      }
    } catch (error) {
      console.error('Error loading RP pack message prompt:', error);
    }
  }

  // outfit 데이터 구조 생성
  const outfit = {
    name: context.appearanceData?.appearanceName || 'default',
    description: context.appearanceData?.appearanceData?.description || '',
    outfitStatus: characterState?.outfitStatus || 'Dressed',
    parts: context.appearanceData?.appearanceData?.parts || {},
  };

  // characterStatus 구조 생성
  const currentSpotName = characterState?.current_spot || (Array.isArray(location?.spots) ? location.spots[0]?.name : Object.keys(location || {})[0] || 'default');
  const currentSpot = Array.isArray(location?.spots) 
    ? location.spots.find(s => s.name === currentSpotName) || location.spots[0] || {}
    : location?.[currentSpotName] || {};

  const characterStatus = {
    spot: currentSpot,
  };

  // rpPack 전체 구조 생성
  const rpPack = {
    messagePrompt: rpPackMessagePrompt,
    poseList: poseList,
    actionList: actionList,
  };

  const templateContext = {
    userInput: context.userInput || '',
    lastMessage: context.lastMessage || 'none',
    affinity: context.affinity || 0,
    coercionPoint: coercionPointService.getCoercionPoint(), // ✅ 협박도 추가
    currentBackground: generateBackgroundInfo(context.currentBackground),
    currentBackgroundId: context.currentBackground || 'default',
    location: {
      name: generateBackgroundInfo(context.currentBackground),
      spots: Array.isArray(location) ? location : (location ? Object.values(location) : []),
    },
    currentAppearance: generateAppearanceInfo(context.appearanceData),
    appearanceDetail: generateAppearanceDetail(context.appearanceData),
    undressableItems: generateUndressableItems(context.appearanceData, context.affinity),
    wearableItems: generateWearableItems(context.appearanceData),
    lockedItems: generateLockedItems(context.appearanceData),
    ownedBackgrounds: context.ownedBackgrounds || 'none',
    ownedAppearances: context.ownedAppearances || 'none',
    isAdultCharacter: context.isAdultCharacter || false,
    characterForAdult: context.isAdultCharacter || false, // 템플릿에서 사용하는 이름
    character: context.character || 'shaki',
    characterName: activeCharacter,
    characterLastPose: characterLastPose,
    characterStatus: characterStatus, // 템플릿에서 사용
    outfit: outfit, // 템플릿에서 사용
    activeRpPack: context.activeRpPack || null,
    rpPack: rpPack, // 템플릿에서 rpPack.messagePrompt 등으로 접근
    userLastMessages: (context.userLastResponses || []).join('\n\n'), // 템플릿에서 사용하는 이름
    userLastResponses: (context.userLastResponses || []).join('\n\n'),
    llmLastResponses: (context.llmLastResponses || []).join('\n\n'),
    poseList: poseList,
    actionList: actionList,
    userRequestCharacterStatus: 'init', // 기본값 설정
  };

  const result = renderTemplate(template, templateContext);
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
    coercionPoint: coercionPointService.getCoercionPoint(), // ✅ 협박도 추가
    currentBackground: generateBackgroundInfo(context.currentBackground),
    currentAppearance: generateAppearanceInfo(context.appearanceData),
    appearanceDetail: generateAppearanceDetail(context.appearanceData),
    undressableItems: generateUndressableItems(context.appearanceData, context.affinity),
    wearableItems: generateWearableItems(context.appearanceData),
    lockedItems: generateLockedItems(context.appearanceData),
    ownedBackgrounds: context.ownedBackgrounds || 'none',
    ownedAppearances: context.ownedAppearances || 'none',
    isAdultCharacter: context.isAdultCharacter || false,
    character: context.character || 'shaki',
    activeRpPack: context.activeRpPack || null,
  };

  return renderTemplate(template, templateContext);
}
