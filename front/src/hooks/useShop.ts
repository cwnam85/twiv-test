import { useState, useEffect } from 'react';
import { ShopData, BoosterStatus, AppearanceData, AppearanceStateData } from '../types';

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
  refreshAppearanceData: () => Promise<{
    appearanceData: AppearanceData | null;
    stateData: AppearanceStateData | null;
  } | null>;
  onAudioData: (audioData: AudioData | null) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  onLocationUpdate?: (location: string | null) => void; // 위치 업데이트 콜백 추가
}

const useShop = ({
  onPointUpdate,
  onMessageAdd,
  refreshAppearanceData,
  onAudioData,
  onLoadingChange,
  onLocationUpdate,
}: UseShopProps) => {
  const [shopData, setShopData] = useState<ShopData>({
    backgrounds: [],
    appearances: [],
    boosters: [],
    rpPacks: [],
  });
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [currentBackground, setCurrentBackground] = useState<string>('');
  const [currentAppearance, setCurrentAppearance] = useState<string>('');
  const [boosterStatus, setBoosterStatus] = useState<BoosterStatus | null>(null);
  const [activeRpPack, setActiveRpPack] = useState<{ id: string; activatedAt: string } | null>(
    null,
  );

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
      console.log('Fetching owned items from server...');
      const response = await fetch('http://localhost:3333/shop/owned');
      if (response.ok) {
        const data = await response.json();
        console.log('Owned items response:', data);
        console.log('Setting current background to:', data.currentBackground || '');
        console.log('Setting current outfit to:', data.currentAppearance || '');
        setCurrentBackground(data.currentBackground || '');
        setCurrentAppearance(data.currentAppearance || '');
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
        setActiveRpPack(data.activeRpPack);
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

        // 부스터 반응 처리
        if (data.boosterReaction) {
          console.log('Booster reaction received from server:', data.boosterReaction);
          onMessageAdd(data.boosterReaction.message);
          if (data.boosterReaction.audioData) {
            console.log('Playing booster audio data:', data.boosterReaction.audioData);
            onAudioData(data.boosterReaction.audioData);
          }
        }

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

  // RP팩 활성화
  const activateRpPack = async (rpPackId: string) => {
    try {
      const response = await fetch('http://localhost:3333/shop/activate-rp-pack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rpPackId }),
      });

      if (response.ok) {
        const data = await response.json();

        // 즉시 UI 업데이트 (서버 응답 기반)
        if (data.backgroundChanged && data.newBackground) {
          console.log('Immediately setting background to:', data.newBackground);
          setCurrentBackground(data.newBackground);
        }
        if (data.appearanceChanged && data.newAppearance) {
          console.log('Immediately setting outfit to:', data.newAppearance);
          setCurrentAppearance(data.newAppearance);
        }

        await fetchBoosterStatus();
        await fetchOwnedItems(); // 현재 복장/배경 정보 업데이트
        await refreshAppearanceData(); // 의상 데이터 새로고침

        // RP팩 반응 처리
        if (data.rpPackReaction) {
          console.log('RP pack reaction received from server:', data.rpPackReaction);
          onMessageAdd(data.rpPackReaction.message);
          if (data.rpPackReaction.audioData) {
            console.log('Playing RP pack audio data:', data.rpPackReaction.audioData);
            onAudioData(data.rpPackReaction.audioData);
          }
        }

        // 위치 정보 처리
        if (data.spot && onLocationUpdate) {
          onLocationUpdate(data.spot);
        }

        return data;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'RP팩 활성화에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error activating RP pack:', error);
      throw error;
    }
  };

  // RP팩 비활성화
  const deactivateRpPack = async () => {
    try {
      console.log('Starting RP pack deactivation...');
      const response = await fetch('http://localhost:3333/shop/deactivate-rp-pack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('RP pack deactivation response:', data);

        // 즉시 UI 업데이트 (서버 응답 기반)
        if (data.backgroundChanged && data.newBackground) {
          console.log('Immediately setting background to:', data.newBackground);
          setCurrentBackground(data.newBackground);
        }
        if (data.appearanceChanged && data.newAppearance) {
          console.log('Immediately setting outfit to:', data.newAppearance);
          setCurrentAppearance(data.newAppearance);
        }

        console.log('Fetching booster status...');
        await fetchBoosterStatus();

        console.log('Fetching owned items...');
        await fetchOwnedItems(); // 현재 복장/배경 정보 업데이트

        console.log('Refreshing outfit data...');
        await refreshAppearanceData(); // 의상 데이터 새로고침

        // RP팩 반응 처리
        if (data.rpPackReaction) {
          console.log('RP pack reaction received from server:', data.rpPackReaction);
          onMessageAdd(data.rpPackReaction.message);
          if (data.rpPackReaction.audioData) {
            console.log('Playing RP pack audio data:', data.rpPackReaction.audioData);
            onAudioData(data.rpPackReaction.audioData);
          }
        }

        // RP팩 비활성화 시 위치 초기화
        if (onLocationUpdate) {
          onLocationUpdate(null);
        }

        return data;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'RP팩 비활성화에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error deactivating RP pack:', error);
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
          } else if (item.itemType === 'appearance') {
            setCurrentAppearance(data.currentAppearance);
            // 의상 변경 시 의상 데이터 새로고침
            await refreshAppearanceData();
          }
        }

        // 반응 처리
        if (data.appearanceReaction) {
          console.log('Reaction received from server:', data.appearanceReaction);
          onMessageAdd(data.appearanceReaction.message);
          if (data.appearanceReaction.audioData) {
            console.log('Playing audio data:', data.appearanceReaction.audioData);
            onAudioData(data.appearanceReaction.audioData);
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
    currentAppearance,
    boosterStatus,
    activeRpPack,
    purchaseItem,
    useBooster,
    activateRpPack,
    deactivateRpPack,
    equipItem,
    equipItems,
    openShop,
    closeShop,
  };
};

export default useShop;
