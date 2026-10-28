const authMiddleware = require('./authMiddleware');

/**
 * Enforces role === 'admin'.
 * Composes authMiddleware, then verifies admin role.
 */
const adminMiddleware = (req, res, next) => {
    authMiddleware(req, res, () => {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }
        next();
    });
};

module.exports = adminMiddleware;
