const WebSocket = require('ws');
const logger    = require('../utils/logger');

let wss = null;

// Room subscriptions: tokenSymbol -> Set of WebSocket clients
const subscriptions = new Map();

function initWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    logger.info('WebSocket client connected', { ip: req.socket.remoteAddress });
    ws.isAlive    = true;
    ws.subscribed = new Set();

    // Send welcome message
    send(ws, { type: 'CONNECTED', message: 'TokenEquityX V2 WebSocket' });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        handleMessage(ws, msg);
      } catch (err) {
        send(ws, { type: 'ERROR', message: 'Invalid JSON' });
      }
    });

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('close', () => {
      // Remove from all subscriptions
      ws.subscribed.forEach(symbol => {
        if (subscriptions.has(symbol)) {
          subscriptions.get(symbol).delete(ws);
        }
      });
      logger.info('WebSocket client disconnected');
    });

    ws.on('error', (err) => {
      logger.error('WebSocket error', { error: err.message });
    });
  });

  // Heartbeat — ping all clients every 30 seconds
  const heartbeat = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  logger.info('WebSocket server initialised');
  return wss;
}

function handleMessage(ws, msg) {
  const { type, symbol } = msg;

  switch (type) {

    case 'SUBSCRIBE':
      if (!symbol) return send(ws, { type: 'ERROR', message: 'Symbol required' });
      if (!subscriptions.has(symbol)) subscriptions.set(symbol, new Set());
      subscriptions.get(symbol).add(ws);
      ws.subscribed.add(symbol);
      send(ws, { type: 'SUBSCRIBED', symbol });
      logger.info('Client subscribed', { symbol });
      break;

    case 'UNSUBSCRIBE':
      if (symbol && subscriptions.has(symbol)) {
        subscriptions.get(symbol).delete(ws);
        ws.subscribed.delete(symbol);
      }
      send(ws, { type: 'UNSUBSCRIBED', symbol });
      break;

    case 'PING':
      send(ws, { type: 'PONG', timestamp: Date.now() });
      break;

    default:
      send(ws, { type: 'ERROR', message: 'Unknown message type: ' + type });
  }
}

// ─── BROADCAST HELPERS ────────────────────────────────────────────

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(symbol, data) {
  if (!subscriptions.has(symbol)) return;
  const clients = subscriptions.get(symbol);
  const payload = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

function broadcastAll(data) {
  if (!wss) return;
  const payload = JSON.stringify(data);
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

// ─── EVENT EMITTERS ───────────────────────────────────────────────

function emitTrade(symbol, trade) {
  broadcast(symbol, {
    type:   'TRADE',
    symbol,
    data:   trade,
    timestamp: Date.now()
  });
}

function emitOrderBook(symbol, orderBook) {
  broadcast(symbol, {
    type:   'ORDER_BOOK',
    symbol,
    data:   orderBook,
    timestamp: Date.now()
  });
}

function emitTicker(symbol, ticker) {
  broadcast(symbol, {
    type:   'TICKER',
    symbol,
    data:   ticker,
    timestamp: Date.now()
  });
}

function emitMarketState(symbol, state) {
  broadcast(symbol, {
    type:   'MARKET_STATE',
    symbol,
    state,
    timestamp: Date.now()
  });
}

function emitAlert(message) {
  broadcastAll({
    type:    'ALERT',
    message,
    timestamp: Date.now()
  });
}

function getStats() {
  return {
    connectedClients: wss ? wss.clients.size : 0,
    subscriptions:    Object.fromEntries(
      [...subscriptions.entries()].map(([k, v]) => [k, v.size])
    )
  };
}

module.exports = {
  initWebSocket,
  broadcast,
  broadcastAll,
  emitTrade,
  emitOrderBook,
  emitTicker,
  emitMarketState,
  emitAlert,
  getStats
};