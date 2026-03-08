module.exports = function isAdminMiddleware(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role.toUpperCase() !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  next();
};
