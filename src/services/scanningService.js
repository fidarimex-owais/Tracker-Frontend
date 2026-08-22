import api from './api';

export const resolveQrScan = async (qrValue) =>
  (
    await api.post('/api/scanning/qr', {
      qrValue,
    })
  ).data;
