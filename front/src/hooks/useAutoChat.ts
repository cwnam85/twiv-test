import { useState, useCallback } from 'react';

interface AutoChatHook {
  isAutoChatMode: boolean;
  startAutoChat: (sendMessage?: (message: string) => Promise<void>) => Promise<void>;
  stopAutoChat: () => Promise<void>;
  checkAutoChatStatus: () => Promise<void>;
  triggerAutoMessage: (sendMessage: (message: string) => Promise<void>) => Promise<void>;
}

const useAutoChat = (): AutoChatHook => {
  const [isAutoChatMode, setIsAutoChatMode] = useState(false);

  // 자동모드 변경 추적을 위한 래퍼 함수
  const setIsAutoChatModeWithLog = (newValue: boolean) => {
    console.log(`🔄 자동모드 변경: ${isAutoChatMode} → ${newValue}`, new Error().stack);
    setIsAutoChatMode(newValue);
  };

  // 자동 메시지 트리거 (기존 sendMessage 함수 활용)
  const triggerAutoMessage = useCallback(
    async (sendMessage: (message: string) => Promise<void>) => {
      try {
        console.log('🤖 자동 프롬프트 요청 중...');
        const response = await fetch('http://localhost:3333/auto-prompt');

        if (response.ok) {
          const data = await response.json();
          console.log('🤖 자동 프롬프트 받음:', data.prompt);

          // 기존 sendMessage 함수를 사용해서 자동 메시지 전송
          await sendMessage(data.prompt);
        } else {
          const errorData = await response.json();
          console.error('자동 프롬프트 요청 실패:', errorData);
          // 오류 발생 시 자동 모드 중지
          setIsAutoChatModeWithLog(false);
        }
      } catch (error) {
        console.error('자동 메시지 트리거 중 오류:', error);
        // 오류 발생 시 자동 모드 중지
        setIsAutoChatModeWithLog(false);
      }
    },
    [],
  );

  // 자동 대화 모드 시작
  const startAutoChat = useCallback(
    async (sendMessage?: (message: string) => Promise<void>) => {
      try {
        console.log('🤖 자동 대화 모드 시작 요청');
        const response = await fetch('http://localhost:3333/start-auto-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('자동 대화 모드 시작:', data);
          setIsAutoChatModeWithLog(true);

          // 1초 후 첫 번째 자동 메시지 전송
          if (sendMessage) {
            setTimeout(() => {
              console.log('🤖 첫 번째 자동 메시지 전송 시작');
              triggerAutoMessage(sendMessage);
            }, 1000);
          }
        } else {
          const errorData = await response.json();
          console.error('자동 대화 모드 시작 실패:', errorData);
        }
      } catch (error) {
        console.error('자동 대화 모드 시작 중 오류:', error);
      }
    },
    [triggerAutoMessage],
  );

  // 자동 대화 모드 중지
  const stopAutoChat = useCallback(async () => {
    try {
      console.log('🛑 자동 대화 모드 중지 요청');

      const response = await fetch('http://localhost:3333/stop-auto-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('자동 대화 모드 중지:', data);
        setIsAutoChatModeWithLog(false);
      } else {
        const errorData = await response.json();
        console.error('자동 대화 모드 중지 실패:', errorData);
      }
    } catch (error) {
      console.error('자동 대화 모드 중지 중 오류:', error);
    }
  }, []);

  // 자동 대화 상태 확인
  const checkAutoChatStatus = useCallback(async () => {
    try {
      console.log('🔍 자동 대화 상태 확인 요청');
      const response = await fetch('http://localhost:3333/auto-chat-status');
      if (response.ok) {
        const data = await response.json();
        console.log('📋 백엔드 자동 대화 상태:', data.isAutoChatMode);
        setIsAutoChatModeWithLog(data.isAutoChatMode);
      }
    } catch (error) {
      console.error('자동 대화 상태 확인 중 오류:', error);
    }
  }, []);

  return {
    isAutoChatMode,
    startAutoChat,
    stopAutoChat,
    checkAutoChatStatus,
    triggerAutoMessage,
  };
};

export default useAutoChat;
