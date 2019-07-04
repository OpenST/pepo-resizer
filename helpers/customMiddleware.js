const uuid = require('uuid');

module.exports = function() {
  return function(req, res, next) {
    req.id = uuid.v4();
    req.startTime = process.hrtime();
    next();
  };
};
