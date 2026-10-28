const { User } = require('../models/index');
const validateUser = require('../utils/userValidator');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const RedisClient = require('../config/redis');
const extractToken = require('../utils/extractToken');
require('dotenv').config();

const signToken = (user) =>
    jwt.sign(
        { _id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET_KEY,
        { expiresIn: 3600 }
    );

const setCookie = (res, token) =>
    res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 60 * 60 * 1000, // 1 hour
    });

const safeUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
});

// ─── Register ─────────────────────────────────────────────────────────────────
const register = async (req, res) => {
    try {
        validateUser(req.body);

        const { name, email, password } = req.body;

        const existing = await User.findOne({ where: { email: email.toLowerCase() } });
        if (existing) throw new Error('A user with this email already exists');

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashedPassword, role: 'user' });

        const token = signToken(user);
        setCookie(res, token);

        return res.status(201).json({
            message: 'Registration successful',
            user: safeUser(user),
        });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
};

// ─── Login ────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) throw new Error('Email and password are required');

        const user = await User.findOne({ where: { email: email.toLowerCase() } });
        if (!user) throw new Error('Invalid email or password');

        const match = await bcrypt.compare(password, user.password);
        if (!match) throw new Error('Invalid email or password');

        const token = signToken(user);
        setCookie(res, token);

        return res.status(200).json({
            message: 'Login successful',
            user: safeUser(user),
        });
    } catch (err) {
        return res.status(401).json({ error: err.message });
    }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
const logout = async (req, res) => {
    try {
        const token = extractToken(req);
        if (token) {
            const payload = jwt.decode(token);
            await RedisClient.set(`token:${token}`, 'blocked');
            if (payload?.exp) {
                await RedisClient.expireAt(`token:${token}`, payload.exp);
            }
        }
        res.cookie('token', null, { expires: new Date(0) });
        return res.status(200).json({ message: 'Logged out successfully' });
    } catch (err) {
        return res.status(503).json({ error: err.message });
    }
};

// ─── Check session ────────────────────────────────────────────────────────────
const checkSession = (req, res) => {
    return res.status(200).json({
        message: 'Valid session',
        user: safeUser(req.user),
    });
};

// ─── Admin Registration (Self-bootstraps first admin, thereafter requires admin) ───
const adminRegister = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            throw new Error('Required fields missing: name, email, password');
        }

        const adminCount = await User.count({ where: { role: 'admin' } });
        if (adminCount > 0) {
            const token = extractToken(req);
            if (!token) return res.status(401).json({ error: 'No token found. Please log in as admin.' });

            const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
            const blocked = await RedisClient.exists(`token:${token}`);
            if (blocked) return res.status(401).json({ error: 'Token is no longer valid' });

            const caller = await User.findByPk(payload._id);
            if (!caller || caller.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required to register another admin' });
            }
        }

        validateUser(req.body);

        const existing = await User.findOne({ where: { email: email.toLowerCase() } });
        if (existing) throw new Error('A user with this email already exists');

        const hashedPassword = await bcrypt.hash(password, 10);
        const admin = await User.create({ name, email, password: hashedPassword, role: 'admin' });

        const token = signToken(admin);
        setCookie(res, token);

        return res.status(201).json({
            message: adminCount === 0 ? 'First admin initialized successfully' : 'Admin registered successfully',
            user: safeUser(admin),
        });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
};

// ─── Admin: promote or demote a user role ────────────────────────────────────
const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!validator.isUUID(id)) {
            return res.status(400).json({ error: 'Invalid user ID format. Must be a valid UUID.' });
        }

        const validRoles = ['user', 'admin'];
        if (!role || !validRoles.includes(role)) {
            return res.status(400).json({ error: `Role must be one of: ${validRoles.join(', ')}` });
        }

        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Admin role is immutable — an admin cannot be changed to user
        if (user.role === 'admin' && role !== 'admin') {
            return res.status(400).json({ error: 'Admin role cannot be changed to another role' });
        }

        await user.update({ role });

        return res.status(200).json({
            message: `User role updated to '${role}'`,
            user: safeUser(user),
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ─── Admin: List all users ────────────────────────────────────────────────────
const getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'name', 'email', 'role', 'createdAt'],
            order: [['createdAt', 'DESC']],
        });
        return res.status(200).json({ users, total: users.length });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

module.exports = {
    register,
    login,
    logout,
    checkSession,
    adminRegister,
    updateUserRole,
    getAllUsers,
};
