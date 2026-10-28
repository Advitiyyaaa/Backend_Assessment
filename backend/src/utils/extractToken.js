/**
 * Extracts JWT token from cookies or Authorization Bearer header.
 * Shared utility – used by auth middleware and controllers.
 */
const extractToken = (req) => {
    if (req.cookies?.token) return req.cookies.token;
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7).trim();
    }
    return null;
};

module.exports = extractToken;

