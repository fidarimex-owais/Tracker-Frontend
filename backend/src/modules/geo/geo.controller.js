const service = require('./geo.service');

const autocomplete = async (req, res) => {
  const suggestions = await service.autocompleteAddress(req.query.text);

  return res.json({
    success: true,
    suggestions,
  });
};

const distance = async (req, res) => {
  const route = await service.calculateRouteDistance({
    from: {
      latitude: req.query.fromLat,
      longitude: req.query.fromLon,
    },
    to: {
      latitude: req.query.toLat,
      longitude: req.query.toLon,
    },
  });

  return res.json({
    success: true,
    route,
  });
};

module.exports = {
  autocomplete,
  distance,
};
