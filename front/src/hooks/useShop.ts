import { useState, useEffect } from 'react';
import { ShopData, BoosterStatus, OutfitData, OutfitStateData } from '../types';

interface AudioSegment {
  type: 'text' | 'tag';
  content: string;
  audioUrl?: string;
  index: number;
}

interface AudioData {
  dialogue: string;
  emotion: string;
  segments: AudioSegment[];
  infiniteTag?: string;
  matureTags: string[];
}

interface UseShopProps {
  onPointUpdate: (newPoint: number) => void;
  onMessageAdd: (message: string) => void;
  refreshOutfitData: () => Promise<{
    outfitData: OutfitData | null;
    stateData: OutfitStateData | null;
  } | null>;
  onAudioData: (audioData: AudioData | null) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

const useShop = ({
  onPointUpdate,
  onMessageAdd,
  refreshOutfitData,
  onAudioData,
  onLoadingChange,
}: UseShopProps) => {
  const [shopData, setShopData] = useState<ShopData>({
    backgrounds: [],
    outfits: [],
    boosters: [],
  });
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [currentBackground, setCurrentBackground] = useState('default');
  const [currentOutfit, setCurrentOutfit] = useState('default');
  const [boosterStatus, setBoosterStatus] = useState<BoosterStatus | null>(null);

  // 상점 데이터 가져오기
  const fetchShopData = async () => {
    try {
      const response = await fetch('http://localhost:3333/shop/items');
      if (response.ok) {
        const data = await response.json();
        setShopData(data);
      }
    } catch (error) {
      console.error('Error fetching shop data:', error);
    }
  };

  // 소유한 아이템 가져오기
  const fetchOwnedItems = async () => {
    try {
      const response = await fetch('http://localhost:3333/shop/owned');
      if (response.ok) {
        const data = await response.json();
        setCurrentBackground(data.currentBackground || 'default');
        setCurrentOutfit(data.currentOutfit || 'default');
      }
    } catch (error) {
      console.error('Error fetching owned items:', error);
    }
  };

  // 부스터 상태 확인
  const fetchBoosterStatus = async () => {
    try {
      const response = await fetch('http://localhost:3333/shop/booster-status');
      if (response.ok) {
        const data = await response.json();
        setBoosterStatus(data);
      }
    } catch (error) {
      console.error('Error fetching booster status:', error);
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    fetchShopData();
    fetchOwnedItems();
    fetchBoosterStatus();
  }, []);

  // 부스터 상태 주기적 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBoosterStatus();
    }, 5000); // 5초마다 업데이트

    return () => clearInterval(interval);
  }, []);

  // 아이템 구매
  const purchaseItem = async (itemId: string, itemType: string, price: number) => {
    try {
      const response = await fetch('http://localhost:3333/shop/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId, itemType, price }),
      });

      if (response.ok) {
        const data = await response.json();
        onPointUpdate(data.newPoint);
        await fetchShopData();
        await fetchOwnedItems();
        return data;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '구매에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error purchasing item:', error);
      throw error;
    }
  };

  // 부스터 사용
  const useBooster = async (boosterId: string) => {
    try {
      const response = await fetch('http://localhost:3333/shop/use-booster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ boosterId }),
      });

      if (response.ok) {
        const data = await response.json();
        await fetchShopData();
        await fetchBoosterStatus();
        return data;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '부스터 사용에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error using booster:', error);
      throw error;
    }
  };

  // 아이템 착용 (단일 아이템용 - 기존 호환성)
  const equipItem = async (itemId: string, itemType: string) => {
    return await equipItems([{ itemId, itemType }]);
  };

  // 아이템들 착용 (장바구니용)
  const equipItems = async (items: { itemId: string; itemType: string }[]) => {
    try {
      // 로딩 시작
      onLoadingChange?.(true);

      const response = await fetch('http://localhost:3333/shop/equip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      });

      if (response.ok) {
        const data = await response.json();

        // 각 아이템 타입에 따라 상태 업데이트
        for (const item of items) {
          if (item.itemType === 'background') {
            setCurrentBackground(data.currentBackground);
          } else if (item.itemType === 'outfit') {
            setCurrentOutfit(data.currentOutfit);
            // 의상 변경 시 의상 데이터 새로고침
            await refreshOutfitData();
          }
        }

        // 반응 처리
        if (data.outfitReaction) {
          console.log('Reaction received from server:', data.outfitReaction);
          onMessageAdd(data.outfitReaction.message);
          if (data.outfitReaction.audioData) {
            console.log('Playing audio data:', data.outfitReaction.audioData);
            onAudioData(data.outfitReaction.audioData);
          }
        }

        return data;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '착용에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error equipping items:', error);
      throw error;
    } finally {
      // 로딩 종료
      onLoadingChange?.(false);
    }
  };

  // 상점 열기/닫기
  const openShop = () => {
    setIsShopOpen(true);
    fetchShopData(); // 상점 열 때 최신 데이터 가져오기
  };

  const closeShop = () => {
    setIsShopOpen(false);
  };

  return {
    shopData,
    isShopOpen,
    currentBackground,
    currentOutfit,
    boosterStatus,
    purchaseItem,
    useBooster,
    equipItem,
    equipItems,
    openShop,
    closeShop,
  };
};

export default useShop;
