const config = require('../config');

function sessionAuth(req, res, next) {
  const userId = req.cookies?.fathoms_user;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.userId = userId;
  next();
}

function optionalAuth(req, res, next) {
  req.userId = req.cookies?.fathoms_user || null;
  next();
}

module.exports = { sessionAuth, optionalAuth };
