// Admin service layer

const service = require('./admin.service');

// Dashboard and user-management request handlers

const getDashboard = async (req, res) => {
  const data = await service.getDashboardOverview(req.user);

  res.json({
    success: true,
    data,
  });
};

const createUser = async (req, res) => {
  const user = await service.createUser(
    req.body,
    req.user
  );

  res.status(201).json({
    success: true,
    message: 'ID created successfully',
    user,
  });
};

const listActiveIds = async (req, res) => {
  const users = await service.listActiveIds();

  res.json({
    success: true,
    users,
  });
};


const listIdentityDocuments = async (req, res) => {
  res.set('Cache-Control', 'no-store, private');
  res.set('Pragma', 'no-cache');

  const records = await service.listIdentitySubmissions();

  res.json({
    success: true,
    records,
  });
};

const openIdentityDocument = async (req, res) => {
  res.set('Cache-Control', 'no-store, private');
  res.set('Pragma', 'no-cache');

  const access = await service.getIdentityDocumentAccess(
    req.params.source,
    req.params.id,
    req.params.documentId
  );

  res.json({
    success: true,
    ...access,
  });
};

// Signup request review handlers

const listSignupRequests = async (req, res) => {
  const requests = await service.listSignupRequests(
    req.user
  );

  res.json({
    success: true,
    requests,
  });
};

const getSignupRequestCount = async (req, res) => {
  const count = await service.getSignupRequestCount(
    req.user
  );

  res.json({
    success: true,
    count,
  });
};

const approveSignupRequest = async (req, res) => {
  const user = await service.approveSignupRequest(
    req.params.id,
    req.user,
    req.body?.vendorId || ''
  );

  res.json({
    success: true,
    message: 'Signup request approved and user ID activated',
    user,
  });
};

const rejectSignupRequest = async (req, res) => {
  const request = await service.rejectSignupRequest(
    req.params.id,
    req.user
  );

  res.json({
    success: true,
    message: 'Signup request rejected',
    request,
  });
};

// User management handlers

const listUsers = async (req, res) => {
  const users = await service.listUsers(req.user);

  res.json({
    success: true,
    users,
  });
};

const updateRole = async (req, res) => {
  const user = await service.updateRole(
    req.params.id,
    req.body.role,
    req.user
  );

  res.json({
    success: true,
    message: 'Role updated',
    user,
  });
};

const updateVendor = async (req, res) => {
  const user = await service.updateVendor(
    req.params.id,
    req.body.vendorId,
    req.user
  );

  res.json({
    success: true,
    message: 'Supervisor Vendor updated',
    user,
  });
};

const updateStatus = async (req, res) => {
  const user = await service.updateStatus(
    req.params.id,
    req.body.isActive,
    req.user
  );

  res.json({
    success: true,
    message: 'Account status updated',
    user,
  });
};


// Delete a user account when the current role has permission

const deleteUser = async (req, res) => {
  const user = await service.deleteUser(
    req.params.id,
    req.user
  );

  res.json({
    success: true,
    message: 'User deleted successfully',
    user,
  });
};

// Export Admin controller handlers

module.exports = {
  getDashboard,
  createUser,
  listActiveIds,
  listIdentityDocuments,
  openIdentityDocument,
  listSignupRequests,
  getSignupRequestCount,
  approveSignupRequest,
  rejectSignupRequest,
  listUsers,
  updateRole,
  updateVendor,
  updateStatus,
  deleteUser,
};
