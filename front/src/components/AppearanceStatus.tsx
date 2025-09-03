import React from 'react';
import { AppearanceData, AppearanceStateData } from '../types';

interface AppearanceStatusProps {
  appearance: AppearanceData | null;
  appearanceStateData: AppearanceStateData | null;
}

const AppearanceStatus: React.FC<AppearanceStatusProps> = ({ appearance, appearanceStateData }) => {
  // 현재 캐릭터의 의상 상태 가져오기
  const getCurrentCharacterState = () => {
    if (!appearanceStateData) return null;
    const characters = Object.keys(appearanceStateData);
    return characters.length > 0 ? appearanceStateData[characters[0]] : null;
  };

  const characterState = getCurrentCharacterState();

  // 디버깅을 위한 로그
  console.log('AppearanceStatus - appearanceStateData:', appearanceStateData);
  console.log('AppearanceStatus - characterState:', characterState);

  // 헤어스타일 표시 이름 변환
  const getHairDisplayName = (hairName: string) => {
    return hairName;
  };

  // 아이템 표시 이름 변환
  const getItemDisplayName = (itemName: string) => {
    const itemNames: { [key: string]: string } = {
      hair: '헤어스타일',
      bra: '브라',
      top: '상의',
      outerwear: '겉옷',
      panty: '팬티',
      bottom: '하의',
      shoes: '신발',
      hat: '모자',
      necklace: '목걸이',
      belt: '벨트',
    };

    return itemNames[itemName] || itemName;
  };

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, margin: 8 }}>
      <strong>현재 복장 정보</strong>

      {/* 현재 복장 정보 표시 */}
      {appearance && appearance.appearanceData && characterState && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 500, color: '#2563eb', fontSize: '1.1em' }}>
            🎭 현재 복장: {appearance.appearanceName}
          </div>

          {/* 헤어스타일 별도 표시 */}
          {appearance.appearanceData.parts.hair && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 12px',
                backgroundColor: '#f8fafc',
                borderRadius: 6,
              }}
            >
              <div style={{ fontWeight: 600, color: '#7c3aed', fontSize: '1em' }}>
                💇‍♀️ 헤어스타일
              </div>
              <div style={{ marginTop: 4, fontSize: '0.9em' }}>
                <span style={{ fontWeight: 500 }}>스타일:</span>{' '}
                {getHairDisplayName(appearance.appearanceData.parts.hair.name)}
              </div>
            </div>
          )}

          {/* 기타 의상 아이템들 */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '1em' }}>👕 의상 아이템</div>
            <ul style={{ marginTop: 4, fontSize: '0.9em' }}>
              {Object.entries(appearance.appearanceData.parts)
                .filter(([itemName, item]) => itemName !== 'hair' && item && item.name) // 헤어스타일 제외
                .map(([itemName, item]) => {
                  if (!item || !item.name) return null;

                  // 새로운 구조: 직접 아이템에 접근
                  const isWorn = (characterState as Record<string, boolean>)[itemName] || false;

                  return (
                    <li key={itemName}>
                      <span style={{ fontWeight: 500 }}>{getItemDisplayName(itemName)}</span>:{' '}
                      {isWorn ? (
                        <span style={{ color: '#059669' }}>✅ {item.name}</span>
                      ) : (
                        <span style={{ color: '#dc2626', fontStyle: 'italic' }}>❌ 벗음</span>
                      )}
                    </li>
                  );
                })
                .filter(Boolean)}
            </ul>
          </div>
        </div>
      )}

      {/* 복장 정보가 없는 경우 */}
      {!appearance && <div style={{ marginTop: 8, color: '#6b7280' }}>복장 정보 없음</div>}
    </div>
  );
};

export default AppearanceStatus;
