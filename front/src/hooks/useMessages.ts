import { useState, useEffect } from 'react';
import { Message } from '../types';

const useMessages = (currentCharacter: string) => {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const fetchFirstMessage = async () => {
      try {
        const settingsResponse = await fetch('/character-settings');
        const settingsData = await settingsResponse.json();

        // 현재 캐릭터의 첫 메시지가 있다면 메시지 배열에 추가
        const firstMessage = settingsData[currentCharacter]?.firstMessage;
        if (firstMessage) {
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              text: firstMessage,
              isUser: false,
            },
          ]);
        }
      } catch (error) {
        console.error('Error fetching first message:', error);
      }
    };

    if (currentCharacter !== 'Default Character') {
      fetchFirstMessage();
    }
  }, [currentCharacter]);

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const addUserMessage = (text: string) => {
    addMessage({ text, isUser: true });
  };

  const addBotMessage = (text: string) => {
    addMessage({ text, isUser: false });
  };

  const addBotMessageFromMessage = (message: Message) => {
    addMessage(message);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return {
    messages,
    addMessage,
    addUserMessage,
    addBotMessage,
    addBotMessageFromMessage,
    clearMessages,
  };
};

export default useMessages;
