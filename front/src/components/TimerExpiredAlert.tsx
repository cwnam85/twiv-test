import React from 'react';

interface TimerExpiredAlertProps {
  show: boolean;
}

const TimerExpiredAlert: React.FC<TimerExpiredAlertProps> = ({ show }) => {
  if (!show) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: '#ff4757',
        color: 'white',
        padding: '20px 30px',
        borderRadius: '12px',
        fontSize: '18px',
        fontWeight: 'bold',
        zIndex: 2000,
        boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
        animation: 'slideIn 0.5s ease-out',
      }}
    >
      ⏰ 호감도 타이머 만료!
      <br />
      <span style={{ fontSize: '14px', opacity: 0.9 }}>호감도가 50으로 초기화되었습니다.</span>
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translate(-50%, -60%);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%);
            }
          }
        `}
      </style>
    </div>
  );
};

export default TimerExpiredAlert;
