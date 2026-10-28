const { Mapping, Patient, Doctor, User } = require('../models/index');
const validator = require('validator');

/**
 * Normalizes populated mapping to guarantee patient.name and doctor.name
 */
const formatMapping = (mappingInstance) => {
    if (!mappingInstance) return null;
    const m = mappingInstance.toJSON ? mappingInstance.toJSON() : mappingInstance;
    return {
        ...m,
        patient: m.patient
            ? {
                  ...m.patient,
                  name: m.patient.displayName || m.patient.user?.name || null,
                  email: m.patient.user?.email || null,
              }
            : null,
        doctor: m.doctor
            ? {
                  ...m.doctor,
                  name: m.doctor.displayName || m.doctor.user?.name || null,
                  email: m.doctor.user?.email || null,
              }
            : null,
    };
};

// ─── Assign Doctor to Patient ─────────────────────────────────────────────────
const createMapping = async (req, res) => {
    try {
        let { patientId, doctorId, notes } = req.body;

        // Auto-detect patientId from logged-in user if omitted
        if (!patientId && req.user) {
            const selfPatient = await Patient.findOne({ where: { userId: req.user.id } });
            if (selfPatient) {
                patientId = selfPatient.id;
            }
        }

        if (!patientId || !doctorId) {
            return res.status(400).json({ error: 'patientId and doctorId are required' });
        }

        if (!validator.isUUID(patientId) || !validator.isUUID(doctorId)) {
            return res.status(400).json({ error: 'Invalid patientId or doctorId format. Must be UUIDs.' });
        }

        // Ensure both patient and doctor exist
        const [patient, doctor] = await Promise.all([
            Patient.findByPk(patientId),
            Doctor.findByPk(doctorId),
        ]);

        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        // Access check: only admin or the patient owner can assign a doctor
        const isAuthorized = req.user.role === 'admin' || patient.userId === req.user.id;
        if (!isAuthorized) {
            return res.status(403).json({ error: 'Access denied: you can only assign doctors to your own patient profile' });
        }

        const mapping = await Mapping.create({
            patientId,
            doctorId,
            assignedById: req.user.id,
            notes: notes || null,
        });

        // Fetch created mapping with included associations
        const populated = await Mapping.findByPk(mapping.id, {
            include: [
                {
                    model: Patient,
                    as: 'patient',
                    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
                },
                {
                    model: Doctor,
                    as: 'doctor',
                    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
                },
                { model: User, as: 'assignedBy', attributes: ['id', 'name', 'email'] },
            ],
        });

        return res.status(201).json({
            message: 'Doctor assigned to patient successfully',
            mapping: formatMapping(populated),
        });
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ error: 'This doctor is already assigned to the patient' });
        }
        return res.status(400).json({ error: err.message });
    }
};

// ─── Get All Mappings ─────────────────────────────────────────────────────────
// Admin gets all mappings. Patient gets own mappings. Doctor gets assigned mappings.
const getAllMappings = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
        const offset = (page - 1) * limit;

        const include = [
            {
                model: Patient,
                as: 'patient',
                include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
            },
            {
                model: Doctor,
                as: 'doctor',
                include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
            },
            { model: User, as: 'assignedBy', attributes: ['id', 'name', 'email'] },
        ];

        const whereClause = {};

        // If not admin, filter at the database level!
        if (req.user.role !== 'admin') {
            const [patient, doctor] = await Promise.all([
                Patient.findOne({ where: { userId: req.user.id } }),
                Doctor.findOne({ where: { userId: req.user.id } }),
            ]);

            if (patient && doctor) {
                // User is both patient and doctor
                whereClause[require('sequelize').Op.or] = [
                    { patientId: patient.id },
                    { doctorId: doctor.id },
                ];
            } else if (patient) {
                whereClause.patientId = patient.id;
            } else if (doctor) {
                whereClause.doctorId = doctor.id;
            } else {
                return res.status(200).json({ mappings: [], total: 0, page, totalPages: 0 });
            }
        }

        const { rows, count } = await Mapping.findAndCountAll({
            where: whereClause,
            include,
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });

        return res.status(200).json({
            mappings: rows.map(formatMapping),
            total: count,
            page,
            totalPages: Math.ceil(count / limit) || 1,
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ─── Get Doctors for a Specific Patient ──────────────────────────────────────
const getMappingsByPatient = async (req, res) => {
    try {
        const { patientId } = req.params;

        if (!validator.isUUID(patientId)) {
            return res.status(400).json({ error: 'Invalid patientId format. Must be a UUID.' });
        }

        const patient = await Patient.findByPk(patientId, {
            include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
        });
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Access check: Admin, patient owner, or assigned doctor
        let hasAccess = req.user.role === 'admin' || patient.userId === req.user.id;

        if (!hasAccess) {
            const doctor = await Doctor.findOne({ where: { userId: req.user.id } });
            if (doctor) {
                const assigned = await Mapping.findOne({
                    where: { doctorId: doctor.id, patientId: patient.id },
                });
                if (assigned) hasAccess = true;
            }
        }

        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this patient mappings' });
        }

        const mappings = await Mapping.findAll({
            where: { patientId },
            include: [
                {
                    model: Doctor,
                    as: 'doctor',
                    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        const assignedDoctors = mappings
            .map((m) => {
                if (!m.doctor) return null;
                const doc = m.doctor.toJSON ? m.doctor.toJSON() : m.doctor;
                return {
                    ...doc,
                    name: doc.displayName || doc.user?.name || null,
                    email: doc.user?.email || null,
                };
            })
            .filter(Boolean);

        return res.status(200).json({
            patient: {
                id: patient.id,
                name: patient.displayName || patient.user?.name || null,
            },
            assignedDoctors,
            total: assignedDoctors.length,
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ─── Remove Doctor from Patient ───────────────────────────────────────────────
const deleteMapping = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validator.isUUID(id)) {
            return res.status(400).json({ error: 'Invalid mapping ID format. Must be a UUID.' });
        }

        const mapping = await Mapping.findByPk(id, {
            include: [
                { model: Patient, as: 'patient' },
                { model: Doctor, as: 'doctor' },
            ],
        });

        if (!mapping) {
            return res.status(404).json({ error: 'Mapping not found' });
        }

        // Authorization: Admin, Patient owner, or Assigned Doctor
        const isAuthorized =
            req.user.role === 'admin' ||
            mapping.patient?.userId === req.user.id ||
            mapping.doctor?.userId === req.user.id;

        if (!isAuthorized) {
            return res.status(403).json({ error: 'Access denied: you cannot remove this doctor assignment' });
        }

        await mapping.destroy();
        return res.status(200).json({ message: 'Doctor removed from patient successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

module.exports = { createMapping, getAllMappings, getMappingsByPatient, deleteMapping };
