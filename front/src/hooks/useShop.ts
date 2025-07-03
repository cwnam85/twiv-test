import { useState, useEffect } from 'react';
import { ShopData, ShopItem, OutfitData } from '../types';
import { SHOP_DATA } from '../data/shopData';

interface UseShopProps {
  point: number;
  onPointUpdate: (newPoint: number) => void;
  onMessageAdd: (message: { text: string; isUser: boolean }) => void;
  refreshOutfitData?: () => Promise<OutfitData | null>;
}

const useShop = ({ point, onPointUpdate, onMessageAdd, refreshOutfitData }: UseShopProps) => {
  const [shopData, setShopData] = useState<ShopData>(SHOP_DATA);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [currentBackground, setCurrentBackground] = useState('default');
  const [currentOutfit, setCurrentOutfit] = useState('default');

  // 기본 의상과 기본 배경이 항상 소유 상태인지 확인하는 함수
  const ensureDefaultItemsOwned = (data: ShopData) => ({
    ...data,
    backgrounds: data.backgrounds.map((item) => ({
      ...item,
      isOwned: item.id === 'default' ? true : item.isOwned,
    })),
    outfits: data.outfits.map((item) => ({
      ...item,
      isOwned: item.id === 'default' ? true : item.isOwned,
    })),
  });
  const [isLoading, setIsLoading] = useState(false);

  // 서버에서 상점 데이터와 구매한 아이템들 불러오기
  useEffect(() => {
    const loadShopData = async () => {
      setIsLoading(true);
      try {
        // 서버에서 상점 데이터 가져오기
        const shopResponse = await fetch('http://localhost:3333/shop/items');
        if (shopResponse.ok) {
          const serverShopData = await shopResponse.json();
          // 기본 의상과 기본 배경은 항상 소유 상태로 설정
          const updatedShopData = ensureDefaultItemsOwned(serverShopData);
          setShopData(updatedShopData);
        }

        // 서버에서 구매한 아이템들 가져오기
        const ownedResponse = await fetch('http://localhost:3333/shop/owned');
        if (ownedResponse.ok) {
          const ownedData = await ownedResponse.json();
          setCurrentBackground(ownedData.currentBackground || 'default');
          // 서버에서 가져온 복장이 casual이면 default로 매핑
          const serverOutfit = ownedData.currentOutfit || 'default';
          const mappedOutfit = serverOutfit === 'casual' ? 'default' : serverOutfit;
          setCurrentOutfit(mappedOutfit);
        } else {
          // 서버 응답이 없으면 로컬스토리지에서 불러오기 (fallback)
          loadFromLocalStorage();
        }
      } catch (error) {
        console.error('Error loading shop data from server:', error);
        // 서버 통신 실패시 로컬스토리지에서 불러오기
        loadFromLocalStorage();
      } finally {
        setIsLoading(false);
      }
    };

    const loadFromLocalStorage = () => {
      try {
        const ownedItems = localStorage.getItem('ownedItems');
        const currentBg = localStorage.getItem('currentBackground') || 'default';
        const currentOutfit = localStorage.getItem('currentOutfit') || 'default';

        if (ownedItems) {
          const owned = JSON.parse(ownedItems);
          setShopData((prev) => ({
            backgrounds: prev.backgrounds.map((item) => ({
              ...item,
              isOwned: owned.includes(item.id),
            })),
            outfits: prev.outfits.map((item) => ({
              ...item,
              isOwned: item.id === 'default' ? true : owned.includes(item.id),
            })),
          }));
        } else {
          // ownedItems가 없어도 기본 의상과 기본 배경은 소유 상태로 설정
          setShopData((prev) => ensureDefaultItemsOwned(prev));
        }

        setCurrentBackground(currentBg);
        setCurrentOutfit(currentOutfit);
      } catch (error) {
        console.error('Error loading from localStorage:', error);
      }
    };

    loadShopData();
  }, []);

  const purchaseItem = async (item: ShopItem) => {
    if (item.isOwned) {
      onMessageAdd({
        text: `${item.name}은(는) 이미 구매하신 상품입니다.`,
        isUser: false,
      });
      return false;
    }

    // 기본 의상은 무료이므로 포인트 체크 생략
    if (item.price > 0 && point < item.price) {
      onMessageAdd({
        text: `포인트가 부족합니다. ${item.name} 구매에 ${item.price}포인트가 필요합니다.`,
        isUser: false,
      });
      return false;
    }

    setIsLoading(true);
    try {
      // 서버에 구매 요청
      const response = await fetch('http://localhost:3333/shop/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: item.id,
          itemType: item.type,
          price: item.price,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // 서버에서 업데이트된 포인트 받기
        onPointUpdate(data.newPoint);

        // 상점 데이터 업데이트
        setShopData((prev) => ({
          backgrounds: prev.backgrounds.map((bg) =>
            bg.id === item.id ? { ...bg, isOwned: true } : bg,
          ),
          outfits: prev.outfits.map((outfit) =>
            outfit.id === item.id ? { ...outfit, isOwned: true } : outfit,
          ),
        }));

        // 복장을 구매한 경우 서버의 복장 데이터도 업데이트
        if (item.type === 'outfit' && refreshOutfitData) {
          try {
            await refreshOutfitData();
            console.log('Outfit data refreshed after purchase');
          } catch (error) {
            console.error('Error refreshing outfit data after purchase:', error);
          }
        }

        return true;
      } else {
        const errorData = await response.json();
        onMessageAdd({
          text: errorData.error || '구매 중 오류가 발생했습니다.',
          isUser: false,
        });
        return false;
      }
    } catch (error) {
      console.error('Error purchasing item:', error);
      onMessageAdd({
        text: '서버 통신 오류로 구매에 실패했습니다. 잠시 후 다시 시도해주세요.',
        isUser: false,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const equipItem = async (item: ShopItem) => {
    if (!item.isOwned) {
      onMessageAdd({
        text: `${item.name}을(를) 먼저 구매해주세요.`,
        isUser: false,
      });
      return;
    }

    setIsLoading(true);
    try {
      // 서버에 착용 요청
      const response = await fetch('http://localhost:3333/shop/equip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: item.id,
          itemType: item.type,
        }),
      });

      if (response.ok) {
        await response.json(); // 응답 확인용

        if (item.type === 'background') {
          setCurrentBackground(item.id);
        } else if (item.type === 'outfit') {
          setCurrentOutfit(item.id);

          // 복장 착용 시 서버의 복장 데이터도 업데이트
          if (refreshOutfitData) {
            try {
              await refreshOutfitData();
              console.log('Outfit data refreshed after equipping');
            } catch (error) {
              console.error('Error refreshing outfit data after equipping:', error);
            }
          }
        }
      } else {
        const errorData = await response.json();
        onMessageAdd({
          text: errorData.error || '착용 중 오류가 발생했습니다.',
          isUser: false,
        });
      }
    } catch (error) {
      console.error('Error equipping item:', error);
      // 서버 통신 실패시 로컬에서만 처리
      if (item.type === 'background') {
        setCurrentBackground(item.id);
        localStorage.setItem('currentBackground', item.id);
      } else if (item.type === 'outfit') {
        setCurrentOutfit(item.id);
        localStorage.setItem('currentOutfit', item.id);

        if (refreshOutfitData) {
          try {
            await refreshOutfitData();
          } catch (error) {
            console.error('Error refreshing outfit data after equipping:', error);
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const openShop = () => setIsShopOpen(true);
  const closeShop = () => setIsShopOpen(false);

  return {
    shopData,
    isShopOpen,
    currentBackground,
    currentOutfit,
    purchaseItem,
    equipItem,
    openShop,
    closeShop,
    isLoading,
  };
};

export default useShop;
