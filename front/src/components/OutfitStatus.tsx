import React from 'react';

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

const OutfitStatus: React.FC<{ outfitData: OutfitData | null }> = ({ outfitData }) => {
  if (!outfitData || !outfitData.outfitData) return <div>복장 정보 없음</div>;
  const { outfitName, outfitData: data } = outfitData;
  const enabledItems: { category: string; itemName: string; item: OutfitItem }[] = [];

  Object.entries(data.parts).forEach(([category, items]) => {
    Object.entries(items).forEach(([itemName, item]) => {
      if (item.enabled) {
        enabledItems.push({ category, itemName, item });
      }
    });
  });

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, margin: 8 }}>
      <strong>현재 복장: {outfitName}</strong>
      <ul style={{ marginTop: 8 }}>
        {enabledItems.map(({ category, itemName, item }) => (
          <li key={category + '-' + itemName}>
            <span style={{ fontWeight: 500 }}>{category}</span>.<span>{itemName}</span>:{' '}
            <span>{item.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OutfitStatus;
