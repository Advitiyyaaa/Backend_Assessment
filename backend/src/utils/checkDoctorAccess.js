const { Doctor, Mapping } = require('../models/index');

/**
 * Checks if a user has doctor access to a specific patient
 * (i.e. user has a doctor profile that is mapped to the patient).
 */
const checkDoctorAccess = async (userId, patientId) => {
    if (!userId || !patientId) return false;

    const doctor = await Doctor.findOne({ where: { userId } });
    if (!doctor) return false;

    const mapping = await Mapping.findOne({
        where: {
            doctorId: doctor.id,
            patientId,
        },
    });

    return !!mapping;
};

module.exports = checkDoctorAccess;

