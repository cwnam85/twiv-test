import React from 'react';
import { OutfitData } from '../types';

interface OutfitStatusProps {
  outfitData: OutfitData | null;
  currentOutfit?: string; // 상점에서 선택한 복장
  shopOutfits?: Array<{ id: string; name: string; isOwned: boolean }>; // 상점 복장 목록
}

const OutfitStatus: React.FC<OutfitStatusProps> = ({
  outfitData,
  currentOutfit = 'default',
  shopOutfits = [],
}) => {
  // 상점에서 구매한 복장 중 현재 착용 중인 것 찾기
  const equippedShopOutfit = shopOutfits.find(
    (outfit) => outfit.id === currentOutfit && outfit.isOwned,
  );

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

      {/* 서버 복장 정보 (상점 복장이 없을 때만 표시) */}
      {!equippedShopOutfit && outfitData && outfitData.outfitData && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 500, color: '#2563eb' }}>
            🎭 서버 복장: {outfitData.outfitName}
          </div>
          <ul style={{ marginTop: 4, fontSize: '0.9em' }}>
            {Object.entries(outfitData.outfitData.parts).map(([category, items]) =>
              Object.entries(items).map(([itemName, item]) =>
                item.enabled ? (
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
                item.enabled ? (
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
      {!outfitData && !equippedShopOutfit && (
        <div style={{ marginTop: 8, color: '#6b7280' }}>복장 정보 없음</div>
      )}
    </div>
  );
};

export default OutfitStatus;
