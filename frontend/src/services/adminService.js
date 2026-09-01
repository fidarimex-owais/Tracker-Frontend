// frontend/src/services/adminService.js

import api from './api';

export const SIGNUP_REQUESTS_CHANGED_EVENT =
  'signup-requests-changed';

export const getAdminDashboard = async () =>
  (
    await api.get('/api/admin/dashboard')
  ).data;


export const getPortalDashboard = async (actorRole) => {
  const paths = {
    subadmin: '/api/sub-admin/dashboard',
    vendor: '/api/vendor/dashboard',
    supervisor: '/api/supervisor/dashboard',
  };

  const path = paths[actorRole];

  if (!path) {
    throw new Error(
      'Dashboard is not available for this role'
    );
  }

  return (
    await api.get(path)
  ).data;
};

export const getVendorOptions = async () =>
  (
    await api.get('/api/auth/vendors')
  ).data;

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
  actorRole,
  vendorId = ''
) =>
  (
    await api.patch(
      `${portalBase(actorRole)}/signup-requests/${id}/approve`,
      vendorId ? { vendorId } : {}
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

export const updateUserVendor = async (
  id,
  vendorId,
  actorRole = 'admin'
) =>
  (
    await api.patch(
      `${userBase(actorRole)}/${id}/vendor`,
      { vendorId }
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


export const deleteUser = async (
  id,
  actorRole = 'admin'
) =>
  (
    await api.delete(
      `${userBase(actorRole)}/${id}`
    )
  ).data;

export const getIdentityDocuments = async () =>
  (
    await api.get('/api/admin/identity-documents')
  ).data;

export const getIdentityDocumentAccess = async (
  source,
  recordId,
  documentId
) =>
  (
    await api.get(
      `/api/admin/identity-documents/${source}/${recordId}/documents/${documentId}/open`
    )
  ).data;

export const updateIdentityDocumentRecord = async (
  source,
  recordId,
  payload
) =>
  (
    await api.patch(
      `/api/admin/identity-documents/${source}/${recordId}`,
      payload
    )
  ).data;

export const deleteIdentityDocumentRecord = async (
  source,
  recordId
) =>
  (
    await api.delete(
      `/api/admin/identity-documents/${source}/${recordId}`
    )
  ).data;

export const deleteIdentityDocumentFile = async (
  source,
  recordId,
  documentId
) =>
  (
    await api.delete(
      `/api/admin/identity-documents/${source}/${recordId}/documents/${documentId}`
    )
  ).data;

