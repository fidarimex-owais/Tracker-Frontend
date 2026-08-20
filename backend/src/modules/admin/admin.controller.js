const service = require('./admin.service');

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
    req.user
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

const updateBrand = async (req, res) => {
  const user = await service.updateBrand(
    req.params.id,
    req.body.brandName,
    req.user
  );

  res.json({
    success: true,
    message: 'Brand updated',
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

module.exports = {
  getDashboard,
  createUser,
  listActiveIds,
  listSignupRequests,
  getSignupRequestCount,
  approveSignupRequest,
  rejectSignupRequest,
  listUsers,
  updateRole,
  updateBrand,
  updateStatus,
};
