import { useState } from 'react';

const useModal = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseContent, setPurchaseContent] = useState('');
  const [originalUserInput, setOriginalUserInput] = useState('');

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const openPurchaseModal = (content: string, userInput: string) => {
    setPurchaseContent(content);
    setOriginalUserInput(userInput);
    setIsPurchaseModalOpen(true);
  };

  const closePurchaseModal = () => {
    setIsPurchaseModalOpen(false);
    setPurchaseContent('');
    setOriginalUserInput('');
  };

  return {
    isModalOpen,
    isPurchaseModalOpen,
    purchaseContent,
    originalUserInput,
    openModal,
    closeModal,
    openPurchaseModal,
    closePurchaseModal,
  };
};

export default useModal;
