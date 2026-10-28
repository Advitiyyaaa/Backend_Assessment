/**
 * Validates doctor creation/update data.
 * Throws an Error with a descriptive message on failure.
 */
const validateDoctor = (data, options = { requireName: true }) => {
    const nameToValidate = data.displayName || data.name;
    const { specialization } = data;

    if (options.requireName && !nameToValidate) {
        throw new Error('Required fields missing: name or displayName');
    }

    if (nameToValidate && (nameToValidate.trim().length < 2 || nameToValidate.trim().length > 100)) {
        throw new Error('Doctor name must be between 2 and 100 characters');
    }

    if (!specialization) {
        throw new Error('Required fields missing: specialization');
    }

    if (specialization.trim().length < 2) {
        throw new Error('Specialization must be at least 2 characters');
    }

    if (data.experienceYears !== undefined) {
        const exp = Number(data.experienceYears);
        if (isNaN(exp) || exp < 0) {
            throw new Error('Experience years must be a non-negative number');
        }
    }
};

module.exports = validateDoctor;
