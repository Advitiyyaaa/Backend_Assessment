/**
 * Validates patient creation/update data.
 * Throws an Error with a descriptive message on failure.
 */
const validatePatient = (data, options = { requireName: true }) => {
    const nameToValidate = data.displayName || data.name;
    const { age, gender } = data;

    if (options.requireName && !nameToValidate) {
        throw new Error('Required fields missing: name or displayName');
    }

    if (nameToValidate && (nameToValidate.trim().length < 2 || nameToValidate.trim().length > 100)) {
        throw new Error('Patient name must be between 2 and 100 characters');
    }

    if (age === undefined || age === null || age === '') {
        throw new Error('Required field missing: age');
    }

    const ageNum = Number(age);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
        throw new Error('Age must be a number between 0 and 150');
    }

    if (!gender) {
        throw new Error('Required field missing: gender');
    }

    const validGenders = ['male', 'female', 'other'];
    if (!validGenders.includes(String(gender).toLowerCase())) {
        throw new Error('Gender must be one of: male, female, other');
    }
};

module.exports = validatePatient;
