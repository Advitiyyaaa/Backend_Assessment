const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Patient profile – 1:1 linked to a User.
 * A user self-upgrades by submitting this form.
 *
 * Name is NOT stored here – it comes from the linked `users` row.
 * For unlinked (walk-in) patients, `displayName` is used instead.
 */
const Patient = sequelize.define('Patient', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    // FK to User – set in associations file
    userId: {
        type: DataTypes.UUID,
        allowNull: true,
        unique: true, // 1 user = 1 patient profile (if linked)
        references: {
            model: 'users',
            key: 'id',
        },
    },
    displayName: {
        type: DataTypes.STRING(100),
        allowNull: true, // NULL when linked to a user (name comes from users table)
        validate: { len: [2, 100] },
    },
    age: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 0, max: 150 },
    },
    gender: {
        type: DataTypes.ENUM('male', 'female', 'other'),
        allowNull: false,
    },
    contactNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    medicalHistory: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'patients',
    timestamps: true,
    underscored: true,
});

module.exports = Patient;
