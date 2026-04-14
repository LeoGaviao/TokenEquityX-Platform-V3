'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/api';

export function useAuth(requiredRole = null) {
  const router  = useRouter();
  const [user,  setUser]  = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token  = localStorage.getItem('token');
    const stored = localStorage.getItem('user');

    if (!token || !stored) {
      router.replace('/');
      return;
    }

    const parsed = JSON.parse(stored);
    setUser(parsed);

    api.get('/auth/me')
      .then(res => {
        const fresh = {
          id:            res.data.id,
          walletAddress: res.data.wallet_address,
          role:          res.data.role,
          kycStatus:     res.data.kyc_status
        };
        setUser(fresh);
        localStorage.setItem('user', JSON.stringify(fresh));

        if (requiredRole &&
            fresh.role !== requiredRole &&
            fresh.role !== 'ADMIN') {
          router.replace('/investor');
        }
      })
      .catch(() => {
        localStorage.clear();
        router.replace('/');
      })
      .finally(() => setReady(true));
  }, []);

  function logout() {
    localStorage.clear();
    router.replace('/');
  }

  return { user, ready, logout };
}