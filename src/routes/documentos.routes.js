const express = require('express');
const router = express.Router();
const documentosCtrl = require('../controllers/documentos.controller');
const { authenticateToken } = require('../middleware/auth.js');
const { requireSameCompanyOrSuperAdmin } = require('../middleware/roles.js');

// Ruta pública para guardar documentos durante el registro de empresa
router.post('/registro-publico', documentosCtrl.subirDocumentoPublico);

// Rutas protegidas
router.post('/', authenticateToken, requireSameCompanyOrSuperAdmin(), documentosCtrl.subirDocumento);
router.get('/empresa/:id_empresa', authenticateToken, requireSameCompanyOrSuperAdmin(), documentosCtrl.listarDocumentosEmpresa);
router.post('/:id/validar', authenticateToken, documentosCtrl.validarDocumento);

module.exports = router;
