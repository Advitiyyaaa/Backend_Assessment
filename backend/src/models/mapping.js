const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Patient ↔ Doctor many-to-many mapping.
 * A patient can have multiple doctors and vice versa.
 * Unique constraint prevents duplicate assignments.
 */
const Mapping = sequelize.define('Mapping', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    patientId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'patients', key: 'id' },
        onDelete: 'CASCADE',
    },
    doctorId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'doctors', key: 'id' },
        onDelete: 'CASCADE',
    },
    assignedById: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'patient_doctor_mappings',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ['patient_id', 'doctor_id'], // prevent duplicate assignments
        },
    ],
});

module.exports = Mapping;
