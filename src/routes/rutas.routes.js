const express = require('express');
const router = express.Router();
const rutasController = require('../controllers/rutas.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/empresa/:id_empresa', authenticateToken, rutasController.listarRutas);
router.get('/', authenticateToken, rutasController.listarRutas);
router.get('/:id', authenticateToken, rutasController.obtenerRuta);
router.post('/', authenticateToken, rutasController.crearRuta);
router.put('/:id', authenticateToken, rutasController.actualizarRuta);
router.delete('/:id', authenticateToken, rutasController.eliminarRuta);

module.exports = router;

