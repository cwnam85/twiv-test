import React from 'react';
import { OutfitData, OutfitStateData } from '../types';

interface OutfitStatusProps {
  outfitData: OutfitData | null;
  outfitStateData: OutfitStateData | null;
}

const OutfitStatus: React.FC<OutfitStatusProps> = ({ outfitData, outfitStateData }) => {
  // 현재 캐릭터의 의상 상태 가져오기
  const getCurrentCharacterState = () => {
    if (!outfitStateData) return null;
    const characters = Object.keys(outfitStateData);
    return characters.length > 0 ? outfitStateData[characters[0]] : null;
  };

  const characterState = getCurrentCharacterState();

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, margin: 8 }}>
      <strong>현재 복장 정보</strong>

      {/* 현재 복장 정보 표시 */}
      {outfitData && outfitData.outfitData && characterState && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 500, color: '#2563eb', fontSize: '1.1em' }}>
            🎭 현재 복장: {outfitData.outfitName}
          </div>
          <ul style={{ marginTop: 4, fontSize: '0.9em' }}>
            {Object.entries(outfitData.outfitData.parts).map(([category, items]) =>
              Object.entries(items).map(([itemName, item]) => {
                if (!item || !item.name) return null;

                // 해당 부위의 착용 상태 확인
                const categoryState = characterState[category as keyof typeof characterState];
                const isWorn =
                  typeof categoryState === 'object' && categoryState
                    ? (categoryState as Record<string, boolean>)[itemName]
                    : false;

                return (
                  <li key={category + '-' + itemName}>
                    <span style={{ fontWeight: 500 }}>{category}</span>.<span>{itemName}</span>:{' '}
                    {isWorn ? (
                      <span style={{ color: '#059669' }}>✅ {item.name}</span>
                    ) : (
                      <span style={{ color: '#dc2626', fontStyle: 'italic' }}>❌ 벗음</span>
                    )}
                  </li>
                );
              }),
            )}
          </ul>
        </div>
      )}

      {/* 복장 정보가 없는 경우 */}
      {!outfitData && <div style={{ marginTop: 8, color: '#6b7280' }}>복장 정보 없음</div>}
    </div>
  );
};

export default OutfitStatus;
