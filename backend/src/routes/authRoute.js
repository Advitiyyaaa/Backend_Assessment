const express = require('express');
const authRouter = express.Router();
const {
    register,
    login,
    logout,
    adminRegister,
    checkSession,
    updateUserRole,
    getAllUsers,
} = require('../controller/userAuthenticate');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', authMiddleware, logout);
authRouter.get('/check', authMiddleware, checkSession);

// Admin registration: self-bootstraps if 0 admins exist; otherwise requires an active admin
authRouter.post('/admin/register', adminRegister);

// Admin-only management endpoints
authRouter.get('/users', adminMiddleware, getAllUsers);
authRouter.put('/users/:id/role', adminMiddleware, updateUserRole);

module.exports = authRouter;
