import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:3333';

interface CotState {
  cotEnabled: boolean;
  isLoading: boolean;
}

const useCot = () => {
  const [state, setState] = useState<CotState>({
    cotEnabled: true,
    isLoading: false,
  });

  // 초기 CoT 상태 조회
  const fetchCotStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/cot-status`);
      if (response.ok) {
        const data = await response.json();
        setState((prev) => ({ ...prev, cotEnabled: data.cotEnabled }));
      }
    } catch (error) {
      console.error('Failed to fetch CoT status:', error);
    }
  }, []);

  // 컴포넌트 마운트 시 상태 조회
  useEffect(() => {
    fetchCotStatus();
  }, [fetchCotStatus]);

  // CoT 토글
  const toggleCot = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/cot/toggle`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setState({ cotEnabled: data.cotEnabled, isLoading: false });
        console.log(`[COT] ${data.message}`);
        return data.cotEnabled;
      }
    } catch (error) {
      console.error('Failed to toggle CoT:', error);
    }
    setState((prev) => ({ ...prev, isLoading: false }));
    return state.cotEnabled;
  }, [state.cotEnabled]);

  // CoT 활성화
  const enableCot = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/cot/enable`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setState({ cotEnabled: true, isLoading: false });
        console.log(`[COT] ${data.message}`);
        return true;
      }
    } catch (error) {
      console.error('Failed to enable CoT:', error);
    }
    setState((prev) => ({ ...prev, isLoading: false }));
    return false;
  }, []);

  // CoT 비활성화
  const disableCot = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/cot/disable`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setState({ cotEnabled: false, isLoading: false });
        console.log(`[COT] ${data.message}`);
        return true;
      }
    } catch (error) {
      console.error('Failed to disable CoT:', error);
    }
    setState((prev) => ({ ...prev, isLoading: false }));
    return false;
  }, []);

  return {
    cotEnabled: state.cotEnabled,
    isCotLoading: state.isLoading,
    toggleCot,
    enableCot,
    disableCot,
    refreshCotStatus: fetchCotStatus,
  };
};

export default useCot;

