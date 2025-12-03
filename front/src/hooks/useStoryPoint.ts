import { useState, useEffect } from 'react';

const useStoryPoint = () => {
  const [storyPoint, setStoryPoint] = useState(0);

  // 초기 스토리 포인트 가져오기
  useEffect(() => {
    const fetchStoryPoint = async () => {
      try {
        const response = await fetch('http://localhost:3333/story-point');
        const data = await response.json();
        setStoryPoint(data.storyPoint);
      } catch (error) {
        console.error('Error fetching story point:', error);
      }
    };

    fetchStoryPoint();
  }, []);

  // 스토리 포인트 업데이트 함수
  const updateStoryPoint = (newStoryPoint: number) => {
    setStoryPoint(newStoryPoint);
  };

  return { storyPoint, updateStoryPoint };
};

export default useStoryPoint;





