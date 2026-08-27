// frontend/src/services/api.js

import axios from 'axios';

const configuredApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  '';

const isPrivateIpv4 = (hostname) =>
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

const resolveApiBaseUrl = () => {
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    const hostname = window.location.hostname;

    // When Vite is opened on this computer, always use the local backend.
    // This avoids getting stuck if an old LAN IP remains in .env.
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }

    // When Vite is opened from another device on the same Wi-Fi, use the
    // same LAN host that was used to open the frontend.
    if (isPrivateIpv4(hostname)) {
      return `http://${hostname}:5000`;
    }
  }

  return configuredApiBaseUrl || 'http://localhost:5000';
};

export const API_BASE_URL = resolveApiBaseUrl();

const TOKEN_KEY = 'fidar_auth_token';

export const getAuthToken = () =>
  sessionStorage.getItem(TOKEN_KEY) ||
  localStorage.getItem(TOKEN_KEY);

export const setAuthToken = (token, rememberMe = false) => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);

  if (!token) {
    return;
  }

  if (rememberMe) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
