'use client';
import { useEffect, useRef } from 'react';
import { connectWS, subscribe, unsubscribe, on, off } from '../lib/websocket';

export function useWebSocket(symbol, handlers = {}) {
  const cleanupFns = useRef([]);

  useEffect(() => {
    connectWS(() => {
      if (symbol) subscribe(symbol);
    });

    if (symbol) subscribe(symbol);

    // Register event handlers
    Object.entries(handlers).forEach(([event, callback]) => {
      const cleanup = on(event, symbol, callback);
      cleanupFns.current.push(cleanup);
    });

    return () => {
      cleanupFns.current.forEach(fn => fn && fn());
      cleanupFns.current = [];
      if (symbol) unsubscribe(symbol);
    };
  }, [symbol]);
}