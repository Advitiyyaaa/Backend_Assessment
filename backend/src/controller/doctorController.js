const { Doctor, User, Mapping } = require('../models/index');
const validateDoctor = require('../utils/doctorValidator');
const validator = require('validator');

/**
 * Normalizes doctor object to ensure backward-compatible properties (name, email)
 */
const formatDoctor = (doctorInstance) => {
    if (!doctorInstance) return null;
    const doc = doctorInstance.toJSON ? doctorInstance.toJSON() : doctorInstance;
    return {
        ...doc,
        name: doc.displayName || doc.user?.name || null,
        email: doc.user?.email || null,
    };
};

// ─── Create Doctor ────────────────────────────────────────────────────────────
// Authenticated users (admin or doctor self-onboarding)
const createDoctor = async (req, res) => {
    try {
        let targetUserId = null;
        let targetUser = null;

        if (req.user.role === 'admin') {
            if (req.body.userId) {
                targetUserId = req.body.userId;
                if (!validator.isUUID(targetUserId)) {
                    return res.status(400).json({ error: 'Invalid userId format. Must be a UUID.' });
                }
                targetUser = await User.findByPk(targetUserId);
                if (!targetUser) {
                    return res.status(404).json({ error: 'Target user not found' });
                }
            }
        } else {
            // Standard user creating their own doctor profile
            targetUserId = req.user.id;
            targetUser = req.user;
        }

        const doctorName = req.body.name || req.body.displayName || targetUser?.name;

        validateDoctor(
            {
                ...req.body,
                displayName: doctorName,
            },
            { requireName: !targetUser }
        );

        const { specialization, experienceYears, contactNumber, availableDays } = req.body;

        if (targetUserId) {
            const existing = await Doctor.findOne({ where: { userId: targetUserId } });
            if (existing) {
                return res.status(409).json({ error: 'A doctor profile is already linked to this user' });
            }
        }

        const doctor = await Doctor.create({
            userId: targetUserId,
            displayName: doctorName || null,
            specialization,
            experienceYears: experienceYears !== undefined ? Number(experienceYears) : 0,
            contactNumber: contactNumber || null,
            availableDays: Array.isArray(availableDays) ? availableDays : [],
        });

        const created = await Doctor.findByPk(doctor.id, {
            include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }],
        });

        return res.status(201).json({
            message: 'Doctor added successfully',
            doctor: formatDoctor(created),
        });
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ error: 'Doctor profile already exists with these details' });
        }
        return res.status(400).json({ error: err.message });
    }
};

// ─── Get All Doctors (public) ─────────────────────────────────────────────────
const getAllDoctors = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
        const offset = (page - 1) * limit;

        const { rows, count } = await Doctor.findAndCountAll({
            include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }],
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });

        return res.status(200).json({
            doctors: rows.map(formatDoctor),
            total: count,
            page,
            totalPages: Math.ceil(count / limit) || 1,
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ─── Get Current Doctor Profile (/me) ─────────────────────────────────────────
const getMyDoctor = async (req, res) => {
    try {
        const doctor = await Doctor.findOne({
            where: { userId: req.user.id },
            include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }],
        });

        if (!doctor) {
            return res.status(404).json({ error: 'No doctor profile linked to this account' });
        }

        return res.status(200).json({ doctor: formatDoctor(doctor) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ─── Update Current Doctor Profile (/me) ──────────────────────────────────────
const updateMyDoctor = async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.user.id } });

        if (!doctor) {
            return res.status(404).json({ error: 'No doctor profile linked to this account' });
        }

        req.params.id = doctor.id;
        return updateDoctor(req, res);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ─── Get Single Doctor (public) ───────────────────────────────────────────────
const getDoctor = async (req, res) => {
    try {
        if (!validator.isUUID(req.params.id)) {
            return res.status(400).json({ error: 'Invalid doctor ID format. Must be a UUID.' });
        }

        const doctor = await Doctor.findByPk(req.params.id, {
            include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }],
        });

        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        return res.status(200).json({ doctor: formatDoctor(doctor) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ─── Update Doctor ────────────────────────────────────────────────────────────
const updateDoctor = async (req, res) => {
    try {
        if (!validator.isUUID(req.params.id)) {
            return res.status(400).json({ error: 'Invalid doctor ID format. Must be a UUID.' });
        }

        const doctor = await Doctor.findByPk(req.params.id, {
            include: [{ model: User, as: 'user' }],
        });

        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        // Non-admin can only update their own linked doctor profile
        if (req.user.role !== 'admin' && doctor.userId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied: only admin or the assigned doctor can update' });
        }

        const allowedFields = ['displayName', 'specialization', 'experienceYears', 'contactNumber', 'availableDays'];
        const updates = {};

        for (const key of allowedFields) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }

        // Allow 'name' as alias for displayName
        if (req.body.name !== undefined) {
            updates.displayName = req.body.name;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields provided for update' });
        }

        if (updates.experienceYears !== undefined) {
            const exp = Number(updates.experienceYears);
            if (isNaN(exp) || exp < 0) {
                return res.status(400).json({ error: 'Experience years must be a non-negative number' });
            }
            updates.experienceYears = exp;
        }

        if (updates.availableDays !== undefined && !Array.isArray(updates.availableDays)) {
            return res.status(400).json({ error: 'availableDays must be an array of strings' });
        }

        await doctor.update(updates);

        const reloaded = await Doctor.findByPk(doctor.id, {
            include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }],
        });

        return res.status(200).json({
            message: 'Doctor updated successfully',
            doctor: formatDoctor(reloaded),
        });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
};

// ─── Delete Doctor ────────────────────────────────────────────────────────────
const deleteDoctor = async (req, res) => {
    try {
        if (!validator.isUUID(req.params.id)) {
            return res.status(400).json({ error: 'Invalid doctor ID format. Must be a UUID.' });
        }

        const doctor = await Doctor.findByPk(req.params.id);

        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        // Non-admin can only delete their own linked doctor profile
        if (req.user.role !== 'admin' && doctor.userId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied: admin access required to delete doctor' });
        }

        // Clean up mappings first
        await Mapping.destroy({ where: { doctorId: doctor.id } });

        await doctor.destroy();

        return res.status(200).json({ message: 'Doctor deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

module.exports = {
    createDoctor,
    getAllDoctors,
    getMyDoctor,
    updateMyDoctor,
    getDoctor,
    updateDoctor,
    deleteDoctor,
};
