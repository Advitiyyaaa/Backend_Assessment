const express = require('express');
const doctorRouter = express.Router();
const {
    createDoctor,
    getAllDoctors,
    getMyDoctor,
    updateMyDoctor,
    getDoctor,
    updateDoctor,
    deleteDoctor,
} = require('../controller/doctorController');
const authMiddleware = require('../middleware/authMiddleware');

// Public: read all doctors
doctorRouter.get('/', getAllDoctors);

// Protected: current logged-in doctor profile (must precede /:id)
doctorRouter.get('/me', authMiddleware, getMyDoctor);
doctorRouter.put('/me', authMiddleware, updateMyDoctor);

// Public: read single doctor by ID
doctorRouter.get('/:id', getDoctor);

// Protected: admin/doctor mutations
doctorRouter.post('/', authMiddleware, createDoctor);
doctorRouter.put('/:id', authMiddleware, updateDoctor);
doctorRouter.delete('/:id', authMiddleware, deleteDoctor);

module.exports = doctorRouter;
