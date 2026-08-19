import api from './api';

export const SIGNUP_REQUESTS_CHANGED_EVENT =
  'signup-requests-changed';

const portalBase = (actorRole) => {
  if (actorRole === 'admin') {
    return '/api/admin';
  }

  if (actorRole === 'subadmin') {
    return '/api/sub-admin';
  }

  if (actorRole === 'vendor') {
    return '/api/vendor';
  }

  throw new Error(
    'This role does not have account-management access'
  );
};

const userBase = (actorRole) =>
  `${portalBase(actorRole)}/users`;

export const createId = async (
  payload,
  actorRole
) =>
  (
    await api.post(
      `${portalBase(actorRole)}/users`,
      payload
    )
  ).data;

export const getActiveIds = async () =>
  (
    await api.get(
      '/api/admin/active-ids'
    )
  ).data;

export const getSignupRequests = async (
  actorRole
) =>
  (
    await api.get(
      `${portalBase(actorRole)}/signup-requests`
    )
  ).data;

export const getSignupRequestCount = async (
  actorRole
) =>
  (
    await api.get(
      `${portalBase(actorRole)}/signup-requests/count`
    )
  ).data;

export const approveSignupRequest = async (
  id,
  actorRole
) =>
  (
    await api.patch(
      `${portalBase(actorRole)}/signup-requests/${id}/approve`
    )
  ).data;

export const rejectSignupRequest = async (
  id,
  actorRole
) =>
  (
    await api.patch(
      `${portalBase(actorRole)}/signup-requests/${id}/reject`
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

export const updateUserBrand = async (
  id,
  brandName,
  actorRole = 'admin'
) =>
  (
    await api.patch(
      `${userBase(actorRole)}/${id}/brand`,
      { brandName }
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
