import api from './api';

const BASE_PATH = '/api/cold-storages';

export const getColdStorages = async ({
  includeInactive = false,
  vendorId = '',
} = {}) => {
  const params = {};

  if (includeInactive) params.includeInactive = 'true';
  if (vendorId) params.vendorId = vendorId;

  return (
    await api.get(BASE_PATH, { params })
  ).data;
};

export const createColdStorage = async (payload) =>
  (
    await api.post(BASE_PATH, payload)
  ).data;

export const updateColdStorage = async (id, payload) =>
  (
    await api.patch(`${BASE_PATH}/${id}`, payload)
  ).data;

export const updateColdStorageStatus = async (id, isActive) =>
  (
    await api.patch(`${BASE_PATH}/${id}/status`, { isActive })
  ).data;

export const deleteColdStorage = async (id) =>
  (
    await api.delete(`${BASE_PATH}/${id}`)
  ).data;
