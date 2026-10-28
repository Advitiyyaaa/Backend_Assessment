const express = require('express');
const patientRouter = express.Router();
const {
    createPatient,
    getAllPatients,
    getPatient,
    updatePatient,
    deletePatient,
    getMyPatient,
    updateMyPatient,
    deleteMyPatient,
} = require('../controller/patientController');
const authMiddleware = require('../middleware/authMiddleware');

// All patient routes require authentication
patientRouter.use(authMiddleware);

// Standard collection routes
patientRouter.post('/', createPatient);
patientRouter.get('/', getAllPatients);

// Convenience self-endpoints (must come before /:id)
patientRouter.get('/me', getMyPatient);
patientRouter.put('/me', updateMyPatient);
patientRouter.delete('/me', deleteMyPatient);

// Member routes by ID
patientRouter.get('/:id', getPatient);
patientRouter.put('/:id', updatePatient);
patientRouter.delete('/:id', deletePatient);

module.exports = patientRouter;
