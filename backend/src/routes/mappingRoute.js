const express = require('express');
const mappingRouter = express.Router();
const {
    createMapping,
    getAllMappings,
    getMappingsByPatient,
    deleteMapping,
} = require('../controller/mappingController');
const authMiddleware = require('../middleware/authMiddleware');

// All mapping routes require authentication
mappingRouter.post('/', authMiddleware, createMapping);
mappingRouter.get('/', authMiddleware, getAllMappings);
mappingRouter.get('/:patientId', authMiddleware, getMappingsByPatient);
mappingRouter.delete('/:id', authMiddleware, deleteMapping);

module.exports = mappingRouter;
