import api, { API_BASE_URL } from './api';

const RECORDS_BASE_PATH = '/api/records';

const normalizeApiError = (error, fallbackMessage) => {
  if (error.response) {
    const { status, data } = error.response;
    const normalizedError = new Error(data?.message || fallbackMessage);
    normalizedError.statusCode = status;
    normalizedError.fieldErrors = data?.errors || null;
    normalizedError.isConflict = status === 409 && data?.conflict === true;
    normalizedError.conflictData = normalizedError.isConflict ? data.data : null;
    return normalizedError;
  }

  if (error.request) {
    const normalizedError = new Error(
      'No response from server. Check that the backend is running and VITE_API_BASE_URL is correct.'
    );
    normalizedError.statusCode = null;
    return normalizedError;
  }

  return error;
};

export const createRecord = async (payload) => {
  try {
    const response = await api.post(RECORDS_BASE_PATH, payload);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'Unable to create record');
  }
};

export const resolveConflict = async ({
  brandName,
  packageDate,
  lineNumber,
  action,
  payload,
}) => {
  try {
    const response = await api.post(`${RECORDS_BASE_PATH}/resolve`, {
      brandName,
      packageDate,
      lineNumber,
      action,
      payload: action === 'update' ? payload : undefined,
    });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'Unable to resolve record conflict');
  }
};

const buildDeliveryUrl = (endpoint, lineInfo, numberOfHands) => {
  if (!lineInfo) return '#';

  const params = new URLSearchParams({
    brandName: lineInfo.brandName,
    packageDate: lineInfo.packageDate,
    lineNumber: String(lineInfo.lineNumber),
    numberOfHands: String(numberOfHands),
  });

  return `${API_BASE_URL}${RECORDS_BASE_PATH}/${endpoint}?${params.toString()}`;
};

export const buildStickerDownloadUrl = (lineInfo, numberOfHands) =>
  buildDeliveryUrl('download', lineInfo, numberOfHands);

export const buildStickerPrintUrl = (lineInfo, numberOfHands) =>
  buildDeliveryUrl('print', lineInfo, numberOfHands);
