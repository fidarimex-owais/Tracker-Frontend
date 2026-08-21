export const roleHome = (role) => ({
  admin: '/admin',
  subadmin: '/sub-admin',
  vendor: '/vendor',
  supervisor: '/supervisor',
}[role] || '/login');
