import { useState, useEffect } from 'react';

const useAffinity = () => {
  const [affinity, setAffinity] = useState(0);
  const [point, setPoint] = useState(100);
  const [maxAffinity, setMaxAffinity] = useState(200);

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
        if (affinityData.maxAffinity !== undefined) {
          setMaxAffinity(affinityData.maxAffinity);
        }
      } catch (error) {
        console.error('Error fetching affinity data:', error);
      }
    };

    fetchAffinityData();

    // 주기적으로 호감도 데이터 업데이트
    const interval = setInterval(fetchAffinityData, 5000); // 5초마다 업데이트

    return () => clearInterval(interval);
  }, []);

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
    maxAffinity,
    updateAffinity,
    updatePoint,
    addPoints,
  };
};

export default useAffinity;
