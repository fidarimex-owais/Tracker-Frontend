//frontend/src/services/qrBrandDetailsService.js

import api from './api';

const BASE_PATH = '/api/qr-brand-details';

const normalizeError = (error, fallbackMessage) => {
  if (error.response) {
    const normalized = new Error(
      error.response.data?.message || fallbackMessage
    );
    normalized.statusCode = error.response.status;
    return normalized;
  }

  if (error.request) {
    return new Error(
      'No response from server. Check that the backend is running and the API URL is correct.'
    );
  }

  return error;
};

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== '' &&
        value !== null &&
        value !== undefined
    )
  );

export const getQrBrandDetailOptions = async (params = {}) => {
  try {
    return (
      await api.get(`${BASE_PATH}/options`, {
        params: cleanParams(params),
      })
    ).data;
  } catch (error) {
    throw normalizeError(
      error,
      'Unable to load QR Brand Detail filter options'
    );
  }
};

export const getQrBrandDetails = async (params = {}) => {
  try {
    return (
      await api.get(BASE_PATH, {
        params: cleanParams(params),
      })
    ).data;
  } catch (error) {
    throw normalizeError(
      error,
      'Unable to load QR Brand Details'
    );
  }
};

export const deleteQrBrandRecord = async ({
  brandName,
  packageId,
  lineId,
}) => {
  try {
    return (
      await api.delete(
        `${BASE_PATH}/${packageId}/lines/${lineId}`,
        {
          data: { brandName },
        }
      )
    ).data;
  } catch (error) {
    throw normalizeError(
      error,
      'Unable to delete QR record'
    );
  }
};
