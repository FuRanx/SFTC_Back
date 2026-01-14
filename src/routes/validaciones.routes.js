const express = require('express');
const router = express.Router();
const validacionesCtrl = require('../controllers/validaciones.controller');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// Solo superadmin puede registrar o listar validaciones
router.post('/', authenticateToken, requireRole('superadmin'), validacionesCtrl.registrarValidacion);
router.get('/', authenticateToken, requireRole('superadmin'), validacionesCtrl.listarValidaciones);

module.exports = router;
