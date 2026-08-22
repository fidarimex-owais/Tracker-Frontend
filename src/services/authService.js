import api, { setAuthToken } from './api';

const normalize = (error, fallback) => {
  const err = new Error(error.response?.data?.message || fallback);
  err.statusCode = error.response?.status;
  err.fieldErrors = error.response?.data?.errors || [];
  return err;
};

const storeSessionToken = (result) => {
  if (result?.token) {
    setAuthToken(result.token);
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
    return storeSessionToken(result);
  } catch (error) {
    setAuthToken(null);
    throw normalize(error, 'Unable to log in');
  }
};

export const googleLogin = async (payload) => {
  try {
    const result = (await api.post('/api/auth/google', payload)).data;
    return storeSessionToken(result);
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
