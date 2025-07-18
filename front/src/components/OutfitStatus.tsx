import React from 'react';
import { OutfitData, OutfitStateData, CharacterOutfitState } from '../types';

interface OutfitStatusProps {
  outfitData: OutfitData | null;
  outfitStateData?: OutfitStateData | null;
  currentOutfit?: string; // 상점에서 선택한 복장
  shopOutfits?: Array<{ id: string; name: string; isOwned: boolean }>; // 상점 복장 목록
  currentCharacter?: string;
}

const OutfitStatus: React.FC<OutfitStatusProps> = ({
  outfitData,
  outfitStateData,
  currentOutfit = 'default',
  shopOutfits = [],
  currentCharacter = 'shaki',
}) => {
  // 상점에서 구매한 복장 중 현재 착용 중인 것 찾기
  const equippedShopOutfit = shopOutfits.find(
    (outfit) => outfit.id === currentOutfit && outfit.isOwned,
  );

  // 현재 캐릭터의 의상 상태 가져오기
  const getCurrentCharacterState = (): CharacterOutfitState | null => {
    if (!outfitStateData || !currentCharacter) return null;
    return outfitStateData[currentCharacter] || null;
  };

  const characterState = getCurrentCharacterState();

  // 착용 중인 아이템들을 표시하는 함수
  const renderWornItems = (state: CharacterOutfitState) => {
    const wornItems: string[] = [];

    Object.entries(state).forEach(([category, items]) => {
      if (category === 'current_outfit') return;

      Object.entries(items).forEach(([itemName, isWorn]) => {
        if (isWorn) {
          wornItems.push(`${category}.${itemName}`);
        }
      });
    });

    return wornItems.length > 0 ? (
      <ul style={{ marginTop: 4, fontSize: '0.9em' }}>
        {wornItems.map((item, index) => (
          <li key={index}>
            <span style={{ fontWeight: 500 }}>{item}</span>
          </li>
        ))}
      </ul>
    ) : (
      <div style={{ marginTop: 4, fontSize: '0.9em', color: '#6b7280' }}>착용 중인 아이템 없음</div>
    );
  };

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, margin: 8 }}>
      <strong>현재 복장 정보</strong>

      {/* 상점에서 구매한 복장 정보 (우선 표시) */}
      {equippedShopOutfit && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 500, color: '#059669', fontSize: '1.1em' }}>
            🛍️ 상점 복장: {equippedShopOutfit.name}
          </div>
        </div>
      )}

      {/* 새로운 의상 상태 정보 (캐릭터별 상태) */}
      {characterState && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 500, color: '#dc2626', fontSize: '1.1em' }}>
            🎭 캐릭터 상태: {currentCharacter} ({characterState.current_outfit})
          </div>
          {renderWornItems(characterState)}
        </div>
      )}

      {/* 서버 복장 정보 (상점 복장이 없을 때만 표시) */}
      {!equippedShopOutfit && outfitData && outfitData.outfitData && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 500, color: '#2563eb' }}>
            🎭 서버 복장: {outfitData.outfitName}
          </div>
          <ul style={{ marginTop: 4, fontSize: '0.9em' }}>
            {Object.entries(outfitData.outfitData.parts).map(([category, items]) =>
              Object.entries(items).map(([itemName, item]) =>
                item && item.enabled ? (
                  <li key={category + '-' + itemName}>
                    <span style={{ fontWeight: 500 }}>{category}</span>.<span>{itemName}</span>:{' '}
                    <span>{item.name}</span>
                  </li>
                ) : null,
              ),
            )}
          </ul>
        </div>
      )}

      {/* 상점 복장이 착용 중일 때 서버 복장 정보도 함께 표시 (참고용) */}
      {equippedShopOutfit && outfitData && outfitData.outfitData && (
        <div style={{ marginTop: 8, opacity: 0.7 }}>
          <div style={{ fontWeight: 500, color: '#6b7280', fontSize: '0.9em' }}>
            📋 서버 복장 (참고): {outfitData.outfitName}
          </div>
          <ul style={{ marginTop: 4, fontSize: '0.9em', opacity: 0.7 }}>
            {Object.entries(outfitData.outfitData.parts).map(([category, items]) =>
              Object.entries(items).map(([itemName, item]) =>
                item && item.enabled ? (
                  <li key={category + '-' + itemName}>
                    <span style={{ fontWeight: 500 }}>{category}</span>.<span>{itemName}</span>:{' '}
                    <span>{item.name}</span>
                  </li>
                ) : null,
              ),
            )}
          </ul>
        </div>
      )}

      {/* 복장 정보가 없는 경우 */}
      {!outfitData && !equippedShopOutfit && !characterState && (
        <div style={{ marginTop: 8, color: '#6b7280' }}>복장 정보 없음</div>
      )}
    </div>
  );
};

export default OutfitStatus;
