import { useState, useEffect } from 'react';

const useCoercionPoint = () => {
  const [coercionPoint, setCoercionPoint] = useState(0);

  // 초기 협박도 가져오기
  useEffect(() => {
    const fetchCoercionPoint = async () => {
      try {
        const response = await fetch('http://localhost:3333/coercion-point');
        const data = await response.json();
        setCoercionPoint(data.coercionPoint);
      } catch (error) {
        console.error('Error fetching coercion point:', error);
      }
    };

    fetchCoercionPoint();
  }, []);

  // 협박도 업데이트 함수
  const updateCoercionPoint = (newCoercionPoint: number) => {
    setCoercionPoint(newCoercionPoint);
  };

  return { coercionPoint, updateCoercionPoint };
};

export default useCoercionPoint;

