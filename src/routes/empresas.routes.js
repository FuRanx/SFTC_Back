const express = require('express');
const router = express.Router();
const empresasController = require('../controllers/empresas.controller');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// Ruta pública para registro de empresas desde el login (siempre con estatus 'pendiente')
router.post('/registro-publico', empresasController.registrarEmpresaPublico);

// Ruta para completar registro de empresa (usuario admin autenticado)
router.post('/completar-registro', authenticateToken, empresasController.completarRegistroEmpresa);

// Rutas protegidas
router.get('/', authenticateToken, empresasController.listarEmpresas);
router.get('/:id', authenticateToken, empresasController.obtenerEmpresa);
router.put('/:id', authenticateToken, empresasController.actualizarEmpresa);
router.post('/', authenticateToken, requireRole('superadmin'), empresasController.registrarEmpresa);

module.exports = router;
