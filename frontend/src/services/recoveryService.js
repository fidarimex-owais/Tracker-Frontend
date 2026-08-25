// frontend/src/services/recoveryService.js

import api from './api';

export const getRecoverySheetOptions = async () =>
  (
    await api.get('/api/recovery-sheets/options')
  ).data;

export const findRecoverySheet = async ({
  packagingDate,
  vendorName,
  lineNumber,
}) =>
  (
    await api.get('/api/recovery-sheets/lookup', {
      params: {
        packagingDate,
        vendorName,
        lineNumber,
      },
    })
  ).data;


export const deleteRecoverySheet = async (sheetId) =>
  (
    await api.delete(`/api/recovery-sheets/${sheetId}`)
  ).data;
