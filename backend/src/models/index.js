/**
 * Central place for all Sequelize model associations.
 * Import this ONCE in index.js after all models are loaded.
 */
const User = require('./user');
const Patient = require('./patient');
const Doctor = require('./doctor');
const Mapping = require('./mapping');

// User ↔ Patient (1:1)
User.hasOne(Patient, { foreignKey: 'userId', as: 'patientProfile', onDelete: 'CASCADE' });
Patient.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User ↔ Doctor (1:1)
User.hasOne(Doctor, { foreignKey: 'userId', as: 'doctorProfile', onDelete: 'CASCADE' });
Doctor.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Patient ↔ Doctor (many-to-many through Mapping)
Patient.belongsToMany(Doctor, { through: Mapping, foreignKey: 'patientId', otherKey: 'doctorId', as: 'doctors' });
Doctor.belongsToMany(Patient, { through: Mapping, foreignKey: 'doctorId', otherKey: 'patientId', as: 'patients' });

// Direct associations for querying Mapping table directly
Mapping.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient', onDelete: 'CASCADE' });
Patient.hasMany(Mapping, { foreignKey: 'patientId', as: 'mappings', onDelete: 'CASCADE' });

Mapping.belongsTo(Doctor, { foreignKey: 'doctorId', as: 'doctor', onDelete: 'CASCADE' });
Doctor.hasMany(Mapping, { foreignKey: 'doctorId', as: 'mappings', onDelete: 'CASCADE' });

// Mapping ↔ User (who assigned)
Mapping.belongsTo(User, { foreignKey: 'assignedById', as: 'assignedBy' });

module.exports = { User, Patient, Doctor, Mapping };
