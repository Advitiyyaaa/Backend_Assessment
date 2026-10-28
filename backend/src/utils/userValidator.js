const validator = require('validator');

/**
 * Validates user registration data.
 * Throws an Error with a descriptive message on failure.
 */
const validateUser = (data) => {
    const { name, email, password } = data;

    if (!name || !email || !password) {
        throw new Error('Required fields missing: name, email, password');
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!validator.isEmail(cleanEmail)) {
        throw new Error('Invalid email address');
    }

    if (name.trim().length < 2 || name.trim().length > 80) {
        throw new Error('Name must be between 2 and 80 characters');
    }

    if (!validator.isStrongPassword(password)) {
        throw new Error(
            'Weak password. Must have at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 symbol'
        );
    }
};

module.exports = validateUser;
