const express = require('express');
const router = express.Router();
const facturasCtrl = require('../controllers/facturas.controller');
const { authenticateToken } = require('../middleware/auth');
const { requireSameCompanyOrSuperAdmin } = require('../middleware/roles');

router.post('/', authenticateToken, facturasCtrl.crearFactura);
router.post('/validar-sat', authenticateToken, facturasCtrl.validarConSAT);
router.get('/empresa/:id_empresa', authenticateToken, facturasCtrl.listarFacturasEmpresa);
router.get('/', authenticateToken, facturasCtrl.listarFacturasEmpresa);
router.get('/:id', authenticateToken, facturasCtrl.obtenerFactura);
router.get('/:id/xml', authenticateToken, facturasCtrl.descargarXML);
router.get('/:id/pdf', authenticateToken, facturasCtrl.descargarPDF);
router.put('/:id', authenticateToken, facturasCtrl.actualizarFactura);
router.put('/:id/cancelar', authenticateToken, facturasCtrl.cancelarFactura);
router.post('/:id/enviar-email', authenticateToken, facturasCtrl.enviarFacturaEmail);
router.delete('/:id', authenticateToken, facturasCtrl.eliminarFactura);

module.exports = router;
