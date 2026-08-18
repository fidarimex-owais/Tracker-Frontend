const service = require('./admin.service');

const listUsers = async (req, res) => {
  const users = await service.listUsers(req.user);
  res.json({ success: true, users });
};

const updateRole = async (req, res) => {
  const user = await service.updateRole(req.params.id, req.body.role, req.user);
  res.json({ success: true, message: 'Role updated', user });
};

const updateStatus = async (req, res) => {
  const user = await service.updateStatus(req.params.id, req.body.isActive, req.user);
  res.json({ success: true, message: 'Account status updated', user });
};

module.exports = { listUsers, updateRole, updateStatus };
