import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  timeout: 30000,
});

// Attach JWT token to every request
api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Only redirect to login if user was previously authenticated
      // Do not redirect on initial auth check (auth/me) or if already on login page
      const isLoginPage = window.location.pathname === '/' || window.location.pathname === '/login';
      const isAuthMe = error.config?.url?.includes('/auth/me');
      const hasToken = localStorage.getItem('token');
      if (!isLoginPage && !isAuthMe && hasToken) {
        localStorage.clear();
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;