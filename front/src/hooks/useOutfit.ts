import { useState, useEffect } from 'react';
import { OutfitData } from '../types';

const useOutfit = () => {
  const [outfitData, setOutfitData] = useState<OutfitData | null>(null);

  useEffect(() => {
    const fetchOutfitData = async () => {
      try {
        const outfitResponse = await fetch('http://localhost:3333/current-outfit');
        const outfitData = await outfitResponse.json();
        if (outfitData.outfitData) {
          setOutfitData(outfitData);
        }
      } catch (error) {
        console.error('Error fetching outfit data:', error);
      }
    };

    fetchOutfitData();
  }, []);

  const updateOutfitData = (newOutfitData: OutfitData) => {
    setOutfitData(newOutfitData);
  };

  const refreshOutfitData = async () => {
    try {
      const currentOutfitResponse = await fetch('http://localhost:3333/current-outfit');
      if (currentOutfitResponse.ok) {
        const newOutfitData = await currentOutfitResponse.json();
        if (newOutfitData.outfitData) {
          setOutfitData(newOutfitData);
          return newOutfitData;
        }
      }
    } catch (error) {
      console.error('Error fetching updated outfit data:', error);
    }
    return null;
  };

  return {
    outfitData,
    updateOutfitData,
    refreshOutfitData,
  };
};

export default useOutfit;
