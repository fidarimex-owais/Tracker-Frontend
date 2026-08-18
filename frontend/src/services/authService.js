import api from './api';

const normalize = (error, fallback) => {
  const err = new Error(error.response?.data?.message || fallback);
  err.statusCode = error.response?.status;
  err.fieldErrors = error.response?.data?.errors || [];
  return err;
};

export const signup = async (credentials) => {
  try { return (await api.post('/api/auth/signup', credentials)).data; }
  catch (error) { throw normalize(error, 'Unable to sign up'); }
};
export const login = async (credentials) => {
  try { return (await api.post('/api/auth/login', credentials)).data; }
  catch (error) { throw normalize(error, 'Unable to log in'); }
};
export const logout = async () => (await api.post('/api/auth/logout')).data;
export const getMe = async () => (await api.get('/api/auth/me')).data;
