const service = require('./scanning.service');

const resolveCode = async (req, res) => {
  const data = await service.resolveCode(req.query.code);
  res.json({ success: true, data });
};

module.exports = { resolveCode };
