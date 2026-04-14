let socket = null;
const listeners = new Map();

export function connectWS(onConnected) {
  const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001') + '/ws';

  if (socket && socket.readyState === WebSocket.OPEN) {
    if (onConnected) onConnected();
    return socket;
  }

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('WebSocket connected');
    if (onConnected) onConnected();
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const key = msg.type + (msg.symbol ? ':' + msg.symbol : '');
      if (listeners.has(key)) {
        listeners.get(key).forEach(cb => cb(msg));
      }
      if (listeners.has(msg.type)) {
        listeners.get(msg.type).forEach(cb => cb(msg));
      }
    } catch {}
  };

  socket.onclose = () => {
    console.log('WebSocket disconnected');
    setTimeout(() => connectWS(), 3000);
  };

  socket.onerror = (err) => {
    console.error('WebSocket error', err);
  };

  return socket;
}

export function subscribe(symbol) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'SUBSCRIBE', symbol }));
  }
}

export function unsubscribe(symbol) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'UNSUBSCRIBE', symbol }));
  }
}

export function on(eventType, symbol, callback) {
  const key = eventType + (symbol ? ':' + symbol : '');
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
  return () => listeners.get(key)?.delete(callback);
}

export function off(eventType, symbol, callback) {
  const key = eventType + (symbol ? ':' + symbol : '');
  listeners.get(key)?.delete(callback);
}

export function disconnectWS() {
  if (socket) {
    socket.close();
    socket = null;
  }
}