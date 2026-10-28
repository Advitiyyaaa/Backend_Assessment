const jwt = require('jsonwebtoken');
const { User } = require('../models/index');
const RedisClient = require('../config/redis');
const extractToken = require('../utils/extractToken');
require('dotenv').config();

/**
 * Verifies JWT, checks Redis blacklist, attaches user to req.user.
 * Accepts any authenticated user.
 */
const authMiddleware = async (req, res, next) => {
    try {
        const token = extractToken(req);
        if (!token) {
            return res.status(401).json({ error: 'No authentication token found. Please log in.' });
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
        if (!payload?._id) {
            return res.status(401).json({ error: 'Malformed token payload' });
        }

        const blocked = await RedisClient.exists(`token:${token}`);
        if (blocked) {
            return res.status(401).json({ error: 'Token has been invalidated (logged out). Please log in again.' });
        }

        const user = await User.findByPk(payload._id);
        if (!user) {
            return res.status(401).json({ error: 'User no longer exists' });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (err) {
        return res.status(401).json({ error: err.name === 'TokenExpiredError' ? 'Token expired' : err.message });
    }
};

module.exports = authMiddleware;
