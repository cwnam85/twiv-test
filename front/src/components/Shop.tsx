import { useState } from 'react';
import { ShopData, ShopItem } from '../types';

interface ShopProps {
  shopData: ShopData;
  point: number;
  currentBackground: string;
  currentOutfit: string;
  onPurchase: (item: ShopItem) => void;
  onEquip: (item: ShopItem) => void;
  onUseBooster?: (boosterId: string) => void;
  onClose: () => void;
}

const Shop = ({
  shopData,
  point,
  currentBackground,
  currentOutfit,
  onPurchase,
  onEquip,
  onUseBooster,
  onClose,
}: ShopProps) => {
  const [activeTab, setActiveTab] = useState<'backgrounds' | 'outfits' | 'boosters'>('backgrounds');

  const renderShopItem = (item: ShopItem) => {
    const isEquipped =
      (item.type === 'background' && currentBackground === item.id) ||
      (item.type === 'outfit' && currentOutfit === item.id);

    return (
      <div
        key={item.id}
        className={`bg-white rounded-lg p-4 border-2 ${
          isEquipped ? 'border-blue-500' : 'border-gray-200'
        }`}
      >
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg">{item.name}</h3>
          <span className="text-sm text-gray-500">{item.price} 포인트</span>
        </div>
        <p className="text-gray-600 text-sm mb-3">{item.description}</p>
        <div className="flex gap-2">
          {item.isOwned ? (
            item.type === 'booster' ? (
              <button
                onClick={() => onUseBooster?.(item.id)}
                className="px-3 py-1 rounded text-sm bg-orange-500 text-white hover:bg-orange-600"
              >
                사용하기
              </button>
            ) : (
              <button
                onClick={() => onEquip(item)}
                className={`px-3 py-1 rounded text-sm ${
                  isEquipped
                    ? 'bg-blue-500 text-white'
                    : item.price === 0
                      ? 'bg-purple-200 text-purple-700 hover:bg-purple-300'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {isEquipped ? '착용 중' : item.price === 0 ? '착용하기 (무료)' : '착용하기'}
              </button>
            )
          ) : (
            <button
              onClick={() => onPurchase(item)}
              disabled={point < item.price}
              className={`px-3 py-1 rounded text-sm ${
                point >= item.price
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {item.price === 0 ? '무료' : '구매하기'}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'backgrounds':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shopData.backgrounds.map(renderShopItem)}
          </div>
        );
      case 'outfits':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shopData.outfits.map(renderShopItem)}
          </div>
        );
      case 'boosters':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shopData.boosters.map(renderShopItem)}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">상점</h2>
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold text-blue-600">보유 포인트: {point}</span>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">
              ✕
            </button>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('backgrounds')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'backgrounds'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            배경
          </button>
          <button
            onClick={() => setActiveTab('outfits')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'outfits'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            복장
          </button>
          <button
            onClick={() => setActiveTab('boosters')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'boosters'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            부스터
          </button>
        </div>

        <div className="space-y-6">{renderTabContent()}</div>
      </div>
    </div>
  );
};

export default Shop;
