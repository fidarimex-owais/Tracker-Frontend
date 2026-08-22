import api from './api';

export const listRawRecoveryVendors = async (packagingDate) =>
  (
    await api.get('/api/raw-recovery-sheets/vendors', {
      params: { packagingDate },
    })
  ).data;

export const listRawRecoveryLines = async ({
  packagingDate,
  vendorName,
}) =>
  (
    await api.get('/api/raw-recovery-sheets/lines', {
      params: { packagingDate, vendorName },
    })
  ).data;

export const lookupRawRecoverySheet = async ({
  packagingDate,
  vendorName,
  lineNumber,
}) =>
  (
    await api.get('/api/raw-recovery-sheets/lookup', {
      params: { packagingDate, vendorName, lineNumber },
    })
  ).data;

export const createRawRecoverySheet = async (payload) =>
  (await api.post('/api/raw-recovery-sheets', payload)).data;

export const scanRawRecoveryBarcode = async ({
  sheetId,
  rowNumber,
  barcodeId,
}) =>
  (
    await api.post(
      `/api/raw-recovery-sheets/${sheetId}/rows/${rowNumber}/barcodes`,
      { barcodeId }
    )
  ).data;

export const completeRawRecoveryRow = async ({
  sheetId,
  rowNumber,
}) =>
  (
    await api.patch(
      `/api/raw-recovery-sheets/${sheetId}/rows/${rowNumber}/complete`
    )
  ).data;

export const addRawRecoveryRow = async (sheetId) =>
  (
    await api.post(`/api/raw-recovery-sheets/${sheetId}/rows`)
  ).data;

export const removeRawRecoveryRow = async ({
  sheetId,
  rowNumber,
}) =>
  (
    await api.delete(
      `/api/raw-recovery-sheets/${sheetId}/rows/${rowNumber}`
    )
  ).data;


export const saveRawRecoverySheet = async (sheetId) =>
  (
    await api.patch(`/api/raw-recovery-sheets/${sheetId}/save`)
  ).data;


export const editRawRecoverySheet = async (sheetId) =>
  (
    await api.patch(`/api/raw-recovery-sheets/${sheetId}/edit`)
  ).data;

export const reopenRawRecoveryRow = async ({
  sheetId,
  rowNumber,
}) =>
  (
    await api.patch(
      `/api/raw-recovery-sheets/${sheetId}/rows/${rowNumber}/reopen`
    )
  ).data;

export const removeRawRecoveryBarcode = async ({
  sheetId,
  rowNumber,
  barcodeId,
}) =>
  (
    await api.delete(
      `/api/raw-recovery-sheets/${sheetId}/rows/${rowNumber}/barcodes/${encodeURIComponent(barcodeId)}`
    )
  ).data;
