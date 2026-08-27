// frontend/src/services/authService.js

import api, { setAuthToken } from './api';

const normalize = (error, fallback) => {
  let message = error.response?.data?.message || fallback;

  if (error.code === 'ECONNABORTED') {
    message =
      'Backend connection timed out. Make sure the backend is running on port 5000.';
  } else if (!error.response) {
    message =
      'Cannot connect to the backend. Start the backend and make sure port 5000 is reachable.';
  }

  const err = new Error(message);
  err.statusCode = error.response?.status;
  err.fieldErrors = error.response?.data?.errors || [];
  return err;
};

const storeSessionToken = (result, rememberMe = false) => {
  if (result?.token) {
    setAuthToken(result.token, rememberMe);
  }

  return result;
};

export const signup = async (credentials) => {
  try {
    return (await api.post('/api/auth/signup', credentials)).data;
  } catch (error) {
    throw normalize(error, 'Unable to sign up');
  }
};

export const login = async (credentials) => {
  try {
    const result = (await api.post('/api/auth/login', credentials)).data;
    return storeSessionToken(result, Boolean(credentials.rememberMe));
  } catch (error) {
    setAuthToken(null);
    throw normalize(error, 'Unable to log in');
  }
};

export const googleLogin = async (payload) => {
  try {
    const result = (await api.post('/api/auth/google', payload)).data;
    return storeSessionToken(result, Boolean(payload.rememberMe));
  } catch (error) {
    setAuthToken(null);
    throw normalize(error, 'Unable to sign in with Google');
  }
};

export const logout = async () => {
  try {
    return (await api.post('/api/auth/logout')).data;
  } finally {
    setAuthToken(null);
  }
};

export const getMe = async () => (await api.get('/api/auth/me')).data;
