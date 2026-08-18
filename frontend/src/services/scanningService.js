import api from './api';
export const resolveScan = async (code) => (await api.get('/api/scanning/resolve', { params: { code } })).data;
