'use client';
import { useState, useEffect } from 'react';

export function useWallet() {
  const [account, setAccount] = useState(null);
  const [user,    setUser]    = useState(null);
  const [ready,   setReady]   = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const u     = localStorage.getItem('user');
    if (token && u) {
      const parsed = JSON.parse(u);
      setUser(parsed);
      setAccount(parsed.walletAddress || parsed.wallet_address || parsed.address || '');
    }
    setReady(true);
  }, []);

  return { account, user, ready };
}
