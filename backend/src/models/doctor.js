const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Doctor profile – 1:1 linked to a User.
 * Only admin can create a doctor profile for another user.
 *
 * Name and email are NOT stored here – they come from the linked `users` row.
 * For unlinked doctors (e.g. visiting surgeons), `displayName` is used instead.
 */
const Doctor = sequelize.define('Doctor', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    // FK to User – set in associations file
    userId: {
        type: DataTypes.UUID,
        allowNull: true,
        unique: true, // 1 user = 1 doctor profile (if linked)
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
    specialization: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: { len: [2, 100], notEmpty: true },
    },
    experienceYears: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: { min: 0 },
    },
    contactNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    availableDays: {
        type: DataTypes.ARRAY(DataTypes.STRING), // PostgreSQL native array
        defaultValue: [],
    },
}, {
    tableName: 'doctors',
    timestamps: true,
    underscored: true,
});

module.exports = Doctor;
