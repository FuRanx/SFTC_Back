const express = require('express');
const router = express.Router();
const cartasPorteCtrl = require('../controllers/cartas-porte.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/empresa/:id_empresa', authenticateToken, cartasPorteCtrl.listar);
router.get('/', authenticateToken, cartasPorteCtrl.listar);
router.get('/:id', authenticateToken, cartasPorteCtrl.obtener);
router.post('/', authenticateToken, cartasPorteCtrl.crear);
router.put('/:id', authenticateToken, cartasPorteCtrl.actualizar);
router.delete('/:id', authenticateToken, cartasPorteCtrl.eliminar);

module.exports = router;
