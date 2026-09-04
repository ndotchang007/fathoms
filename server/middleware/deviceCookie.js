const { ensureDeviceCookie } = require('../utils/signupLimits');

function deviceCookieMiddleware(req, res, next) {
  ensureDeviceCookie(req, res);
  next();
}

module.exports = deviceCookieMiddleware;
