import { useState } from 'react';
import { ShopData, ShopItem } from '../types';

interface ShopProps {
  shopData: ShopData;
  point: number;
  currentBackground: string;
  currentAppearance: string;
  activeRpPack?: { id: string; activatedAt: string } | null;
  onPurchase: (item: ShopItem) => void;
  onEquip: (items: ShopItem[]) => void;
  onUseBooster?: (boosterId: string) => void;
  onActivateRpPack?: (rpPackId: string) => void;
  onDeactivateRpPack?: () => void;
  onClose: () => void;
}

const Shop = ({
  shopData,
  point,
  currentBackground,
  currentAppearance,
  activeRpPack,
  onPurchase,
  onEquip,
  onUseBooster,
  onActivateRpPack,
  onDeactivateRpPack,
  onClose,
}: ShopProps) => {
  const [activeTab, setActiveTab] = useState<
    'backgrounds' | 'appearances' | 'boosters' | 'rpPacks'
  >('backgrounds');
  const [cart, setCart] = useState<ShopItem[]>([]);

  // 장바구니에 아이템 추가
  const addToCart = (item: ShopItem) => {
    // 같은 타입의 아이템이 이미 있으면 교체
    const existingItemIndex = cart.findIndex((cartItem) => cartItem.type === item.type);
    if (existingItemIndex !== -1) {
      const newCart = [...cart];
      newCart[existingItemIndex] = item;
      setCart(newCart);
    } else {
      setCart([...cart, item]);
    }
  };

  // 장바구니에서 아이템 제거
  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((item) => item.id !== itemId));
  };

  // 장바구니 적용
  const applyCart = async () => {
    if (cart.length > 0) {
      onClose(); // 상점 모달 닫기
      await onEquip(cart);
      setCart([]); // 장바구니 비우기
    }
  };

  // 장바구니에 있는지 확인
  const isInCart = (itemId: string) => {
    return cart.some((item) => item.id === itemId);
  };

  const renderShopItem = (item: ShopItem) => {
    const isEquipped =
      (item.type === 'background' && currentBackground === item.id) ||
      (item.type === 'appearance' && currentAppearance === item.id);

    const isActiveRpPack = item.type === 'rp_pack' && activeRpPack?.id === item.id;

    return (
      <div
        key={item.id}
        className={`bg-white rounded-lg p-4 border-2 ${
          isEquipped || isActiveRpPack ? 'border-blue-500' : 'border-gray-200'
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
            ) : item.type === 'rp_pack' ? (
              isActiveRpPack ? (
                <button
                  onClick={() => onDeactivateRpPack?.()}
                  className="px-3 py-1 rounded text-sm bg-red-500 text-white hover:bg-red-600"
                >
                  비활성화
                </button>
              ) : (
                <button
                  onClick={() => onActivateRpPack?.(item.id)}
                  className="px-3 py-1 rounded text-sm bg-purple-500 text-white hover:bg-purple-600"
                >
                  활성화
                </button>
              )
            ) : (
              <div className="flex gap-2">
                {isInCart(item.id) ? (
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="px-3 py-1 rounded text-sm bg-red-500 text-white hover:bg-red-600"
                  >
                    담기 취소
                  </button>
                ) : (
                  <button
                    onClick={() => addToCart(item)}
                    className={`px-3 py-1 rounded text-sm ${
                      isEquipped
                        ? 'bg-blue-500 text-white'
                        : item.price === 0
                          ? 'bg-purple-200 text-purple-700 hover:bg-purple-300'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {isEquipped ? '착용 중' : '담기'}
                  </button>
                )}
              </div>
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
      case 'appearances':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shopData.appearances.map(renderShopItem)}
          </div>
        );
      case 'boosters':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shopData.boosters.map(renderShopItem)}
          </div>
        );
      case 'rpPacks':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shopData.rpPacks.map(renderShopItem)}
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
            onClick={() => setActiveTab('appearances')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'appearances'
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
          <button
            onClick={() => setActiveTab('rpPacks')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'rpPacks'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            RP팩
          </button>
        </div>

        <div className="space-y-6">{renderTabContent()}</div>

        {/* 장바구니 영역 */}
        {cart.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">장바구니</h3>
            <div className="space-y-2 mb-4">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between items-center">
                  <span className="text-sm">{item.name}</span>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={applyCart}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 font-medium"
            >
              적용하기 ({cart.length}개 아이템)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Shop;
