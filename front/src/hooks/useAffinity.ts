import { useState, useEffect } from 'react';

interface TimerStatus {
  hasTimer: boolean;
  remainingTime: string | null;
}

const useAffinity = () => {
  const [affinity, setAffinity] = useState(0);
  const [point, setPoint] = useState(100);
  const [timerStatus, setTimerStatus] = useState<TimerStatus>({
    hasTimer: false,
    remainingTime: null,
  });
  const [showTimerExpiredAlert, setShowTimerExpiredAlert] = useState(false);

  useEffect(() => {
    const fetchAffinityData = async () => {
      try {
        const affinityResponse = await fetch('http://localhost:3333/affinity');
        const affinityData = await affinityResponse.json();

        if (affinityData.affinity !== undefined) {
          setAffinity(affinityData.affinity);
        }
        if (affinityData.point !== undefined) {
          setPoint(affinityData.point);
        }
        if (affinityData.timerStatus) {
          setTimerStatus(affinityData.timerStatus);
        }
      } catch (error) {
        console.error('Error fetching affinity data:', error);
      }
    };

    fetchAffinityData();

    // 타이머가 활성화되어 있으면 주기적으로 상태 업데이트
    const interval = setInterval(async () => {
      if (affinity >= 100) {
        try {
          const timerResponse = await fetch('http://localhost:3333/timer-status');
          const timerData = await timerResponse.json();
          setTimerStatus(timerData);

          // 타이머가 사라졌고 이전에 타이머가 있었으면 만료 알림 표시
          if (!timerData.hasTimer && timerStatus.hasTimer) {
            setShowTimerExpiredAlert(true);
            setTimeout(() => setShowTimerExpiredAlert(false), 5000); // 5초 후 알림 숨김
          }
        } catch (error) {
          console.error('Error fetching timer status:', error);
        }
      }
    }, 1000); // 1초마다 업데이트

    return () => clearInterval(interval);
  }, [affinity, timerStatus.hasTimer]);

  const updateAffinity = (newAffinity: number) => {
    setAffinity(newAffinity);
  };

  const updatePoint = (newPoint: number) => {
    setPoint(newPoint);
  };

  const addPoints = async (additionalPoints: number) => {
    try {
      const response = await fetch('http://localhost:3333/affinity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ point: point + additionalPoints }),
      });
      const data = await response.json();
      setPoint(data.point);
      return data.point;
    } catch (error) {
      console.error('Error updating point:', error);
      return point;
    }
  };

  return {
    affinity,
    point,
    timerStatus,
    showTimerExpiredAlert,
    updateAffinity,
    updatePoint,
    addPoints,
  };
};

export default useAffinity;
