const { Patient, User, Doctor, Mapping } = require('../models/index');
const validatePatient = require('../utils/patientValidator');
const checkDoctorAccess = require('../utils/checkDoctorAccess');
const validator = require('validator');

/**
 * Normalizes patient object to ensure backward-compatible properties (name, email)
 */
const formatPatient = (patientInstance) => {
    if (!patientInstance) return null;
    const pt = patientInstance.toJSON ? patientInstance.toJSON() : patientInstance;
    return {
        ...pt,
        name: pt.displayName || pt.user?.name || null,
        email: pt.user?.email || null,
    };
};

// ─── Create Patient Profile ───────────────────────────────────────────────────
// Authenticated user creates a patient profile (self-upgrade or admin-assigned).
const createPatient = async (req, res) => {
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
            } else {
                // Admin creates a hospital walk-in patient record directly
                targetUserId = null;
            }
        } else {
            // Standard user self-registers as patient
            targetUserId = req.user.id;
            targetUser = req.user;
        }

        const patientName = req.body.name || req.body.displayName || targetUser?.name;

        validatePatient(
            {
                ...req.body,
                displayName: patientName,
            },
            { requireName: !targetUser }
        );

        // Check if a patient profile already exists for this user
        if (targetUserId) {
            const existing = await Patient.findOne({ where: { userId: targetUserId } });
            if (existing) {
                return res.status(409).json({ error: 'Patient profile already exists for this user' });
            }
        }

        const { age, gender, contactNumber, address, medicalHistory } = req.body;

        const patient = await Patient.create({
            userId: targetUserId,
            displayName: patientName || null,
            age: Number(age),
            gender: gender.toLowerCase(),
            contactNumber: contactNumber || null,
            address: address || null,
            medicalHistory: medicalHistory || null,
        });

        const created = await Patient.findByPk(patient.id, {
            include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }],
        });

        return res.status(201).json({
            message: 'Patient profile created successfully',
            patient: formatPatient(created),
        });
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ error: 'Patient profile already exists for this user' });
        }
        return res.status(400).json({ error: err.message });
    }
};

// ─── Get All Patients ─────────────────────────────────────────────────────────
// Admin gets all. Doctor gets assigned patients. Patients/users get own record.
const getAllPatients = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
        const offset = (page - 1) * limit;

        const include = [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }];

        if (req.user.role === 'admin') {
            const { rows, count } = await Patient.findAndCountAll({
                include,
                order: [['createdAt', 'DESC']],
                limit,
                offset,
            });
            return res.status(200).json({
                patients: rows.map(formatPatient),
                total: count,
                page,
                totalPages: Math.ceil(count / limit) || 1,
            });
        }

        // Check if caller is a doctor
        const doctor = await Doctor.findOne({ where: { userId: req.user.id } });
        if (doctor) {
            const mappings = await Mapping.findAll({
                where: { doctorId: doctor.id },
                attributes: ['patientId'],
            });
            const patientIds = mappings.map((m) => m.patientId);

            const { rows, count } = await Patient.findAndCountAll({
                where: { id: patientIds },
                include,
                order: [['createdAt', 'DESC']],
                limit,
                offset,
            });
            return res.status(200).json({
                patients: rows.map(formatPatient),
                total: count,
                page,
                totalPages: Math.ceil(count / limit) || 1,
            });
        }

        // Regular user: return own patient profile
        const { rows, count } = await Patient.findAndCountAll({
            where: { userId: req.user.id },
            include,
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });

        return res.status(200).json({
            patients: rows.map(formatPatient),
            total: count,
            page,
            totalPages: Math.ceil(count / limit) || 1,
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ─── Get Single Patient ───────────────────────────────────────────────────────
const getPatient = async (req, res) => {
    try {
        if (!validator.isUUID(req.params.id)) {
            return res.status(400).json({ error: 'Invalid patient ID format. Must be a UUID.' });
        }

        const patient = await Patient.findByPk(req.params.id, {
            include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }],
        });

        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Check access: Admin, Owner, or Assigned Doctor
        const isOwnerOrAdmin = req.user.role === 'admin' || patient.userId === req.user.id;
        const hasDoctorAccess = !isOwnerOrAdmin && (await checkDoctorAccess(req.user.id, patient.id));

        if (!isOwnerOrAdmin && !hasDoctorAccess) {
            return res.status(403).json({ error: 'Access denied to this patient record' });
        }

        return res.status(200).json({ patient: formatPatient(patient) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ─── Update Patient ───────────────────────────────────────────────────────────
const updatePatient = async (req, res) => {
    try {
        if (!validator.isUUID(req.params.id)) {
            return res.status(400).json({ error: 'Invalid patient ID format. Must be a UUID.' });
        }

        const patient = await Patient.findByPk(req.params.id);

        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Non-admin can only update their own patient profile
        if (req.user.role !== 'admin' && patient.userId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied to update this patient record' });
        }

        const allowedFields = ['displayName', 'age', 'gender', 'contactNumber', 'address', 'medicalHistory'];
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

        if (updates.age !== undefined) {
            const ageNum = Number(updates.age);
            if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
                return res.status(400).json({ error: 'Age must be a number between 0 and 150' });
            }
            updates.age = ageNum;
        }

        if (updates.gender !== undefined) {
            const validGenders = ['male', 'female', 'other'];
            if (!validGenders.includes(String(updates.gender).toLowerCase())) {
                return res.status(400).json({ error: 'Gender must be one of: male, female, other' });
            }
            updates.gender = String(updates.gender).toLowerCase();
        }

        await patient.update(updates);

        const reloaded = await Patient.findByPk(patient.id, {
            include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }],
        });

        return res.status(200).json({
            message: 'Patient updated successfully',
            patient: formatPatient(reloaded),
        });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
};

// ─── Delete Patient ───────────────────────────────────────────────────────────
const deletePatient = async (req, res) => {
    try {
        if (!validator.isUUID(req.params.id)) {
            return res.status(400).json({ error: 'Invalid patient ID format. Must be a UUID.' });
        }

        const patient = await Patient.findByPk(req.params.id);

        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Non-admin can only delete their own patient profile
        if (req.user.role !== 'admin' && patient.userId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied to delete this patient record' });
        }

        // Clean up any active mappings for this patient first
        await Mapping.destroy({ where: { patientId: patient.id } });

        await patient.destroy();

        return res.status(200).json({ message: 'Patient record deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ─── Current User Helpers (Convenience Endpoints) ─────────────────────────────
const getMyPatient = async (req, res) => {
    try {
        const patient = await Patient.findOne({
            where: { userId: req.user.id },
            include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }],
        });
        if (!patient) return res.status(404).json({ error: 'No patient profile found for this account' });
        return res.status(200).json({ patient: formatPatient(patient) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

const updateMyPatient = async (req, res) => {
    try {
        const patient = await Patient.findOne({ where: { userId: req.user.id } });
        if (!patient) return res.status(404).json({ error: 'No patient profile found for this account' });

        req.params.id = patient.id;
        return updatePatient(req, res);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

const deleteMyPatient = async (req, res) => {
    try {
        const patient = await Patient.findOne({ where: { userId: req.user.id } });
        if (!patient) return res.status(404).json({ error: 'No patient profile found for this account' });

        req.params.id = patient.id;
        return deletePatient(req, res);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

module.exports = {
    createPatient,
    getAllPatients,
    getPatient,
    updatePatient,
    deletePatient,
    getMyPatient,
    updateMyPatient,
    deleteMyPatient,
};
