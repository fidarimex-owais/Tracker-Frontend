import api from './api';

export const searchAddresses = async (text) =>
  (
    await api.get('/api/geo/autocomplete', {
      params: { text },
      skipServerErrorRedirect: true,
    })
  ).data;

export const calculateDistance = async ({ from, to }) =>
  (
    await api.get('/api/geo/distance', {
      params: {
        fromLat: from.latitude,
        fromLon: from.longitude,
        toLat: to.latitude,
        toLon: to.longitude,
      },
      skipServerErrorRedirect: true,
    })
  ).data;
