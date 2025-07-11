import React from 'react';

interface TimerDisplayProps {
  hasTimer: boolean;
  remainingTime: string | null;
  affinity: number;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({ hasTimer, remainingTime, affinity }) => {
  if (!hasTimer || affinity < 100) {
    return null;
  }

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0% {
              opacity: 1;
            }
            50% {
              opacity: 0.7;
            }
            100% {
              opacity: 1;
            }
          }
        `}
      </style>
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#ff4757',
          color: 'white',
          padding: '10px 15px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 'bold',
          zIndex: 1000,
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          animation: 'pulse 2s infinite',
        }}
      >
        ⏰ 타이머: {remainingTime || '5분'} 후 호감도 초기화
      </div>
    </>
  );
};

export default TimerDisplay;
