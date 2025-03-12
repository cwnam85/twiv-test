import WebSocket from 'ws';

let webSocket;
let reconnectInterval = 1000;
let isReconnecting = false;

export function connectWebSocket() {
  webSocket = new WebSocket('ws://127.0.0.1:19190');

  webSocket.on('open', () => {
    console.log('WebSocket connection opened.');
    isReconnecting = false;
  });

  webSocket.on('close', (code, reason) => {
    console.warn(`WebSocket closed: ${code} - ${reason}`);
    attemptReconnect();
  });

  webSocket.on('error', (error) => {
    console.error('WebSocket error:', error);
    attemptReconnect();
  });

  return webSocket;
}

function attemptReconnect() {
  if (isReconnecting) return; // 이미 재연결 시도 중이면 중복 시도 방지
  isReconnecting = true;

  console.log(`Reconnecting in ${reconnectInterval / 1000} seconds...`);
  setTimeout(() => {
    console.log('Reconnecting to WebSocket...');
    connectWebSocket();
  }, reconnectInterval);
}

export function sendMessageToWarudo(message) {
  if (webSocket && webSocket.readyState === WebSocket.OPEN) {
    webSocket.send(message, (err) => {
      if (err) {
        console.error('Error sending message to Warudo:', err);
      }
    });
  } else {
    console.error('WebSocket is not open. Cannot send message.');
  }
}
