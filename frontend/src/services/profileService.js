// frontend/src/services/profileService.js

import api from './api';

export const updateMyProfile = async (payload) =>
  (
    await api.patch('/api/auth/profile', payload)
  ).data;
