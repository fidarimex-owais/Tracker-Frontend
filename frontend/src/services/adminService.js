import api from './api';

const userBase = (role) => (role === 'subadmin' ? '/api/sub-admin/users' : '/api/admin/users');

export const getUsers = async (actorRole = 'admin') =>
  (await api.get(userBase(actorRole))).data;

export const updateUserRole = async (id, role, actorRole = 'admin') =>
  (await api.patch(`${userBase(actorRole)}/${id}/role`, { role })).data;

export const updateUserStatus = async (id, isActive, actorRole = 'admin') =>
  (await api.patch(`${userBase(actorRole)}/${id}/status`, { isActive })).data;
