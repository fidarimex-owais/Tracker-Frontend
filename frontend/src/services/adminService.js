import api from './api';

export const SIGNUP_REQUESTS_CHANGED_EVENT =
  'signup-requests-changed';

const userBase = (role) =>
  role === 'subadmin'
    ? '/api/sub-admin/users'
    : '/api/admin/users';

export const createId = async (payload) =>
  (
    await api.post(
      '/api/admin/users',
      payload
    )
  ).data;

export const getActiveIds = async () =>
  (
    await api.get(
      '/api/admin/active-ids'
    )
  ).data;

export const getSignupRequests = async () =>
  (
    await api.get(
      '/api/admin/signup-requests'
    )
  ).data;

export const getSignupRequestCount = async () =>
  (
    await api.get(
      '/api/admin/signup-requests/count'
    )
  ).data;

export const approveSignupRequest = async (id) =>
  (
    await api.patch(
      `/api/admin/signup-requests/${id}/approve`
    )
  ).data;

export const rejectSignupRequest = async (id) =>
  (
    await api.patch(
      `/api/admin/signup-requests/${id}/reject`
    )
  ).data;

export const getUsers = async (
  actorRole = 'admin'
) =>
  (
    await api.get(
      userBase(actorRole)
    )
  ).data;

export const updateUserRole = async (
  id,
  role,
  actorRole = 'admin'
) =>
  (
    await api.patch(
      `${userBase(actorRole)}/${id}/role`,
      { role }
    )
  ).data;

export const updateUserStatus = async (
  id,
  isActive,
  actorRole = 'admin'
) =>
  (
    await api.patch(
      `${userBase(actorRole)}/${id}/status`,
      { isActive }
    )
  ).data;