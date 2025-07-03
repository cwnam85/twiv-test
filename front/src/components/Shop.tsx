import { ShopData, ShopItem } from '../types';

interface ShopProps {
  shopData: ShopData;
  point: number;
  currentBackground: string;
  currentOutfit: string;
  onPurchase: (item: ShopItem) => void;
  onEquip: (item: ShopItem) => void;
  onClose: () => void;
}

const Shop = ({
  shopData,
  point,
  currentBackground,
  currentOutfit,
  onPurchase,
  onEquip,
  onClose,
}: ShopProps) => {
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

        <div className="space-y-6">
          {/* 배경 섹션 */}
          <div>
            <h3 className="text-xl font-semibold mb-3 text-gray-800">배경</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shopData.backgrounds.map(renderShopItem)}
            </div>
          </div>

          {/* 복장 섹션 */}
          <div>
            <h3 className="text-xl font-semibold mb-3 text-gray-800">복장</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shopData.outfits.map(renderShopItem)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Shop;
