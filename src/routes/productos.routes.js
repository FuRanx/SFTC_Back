const express = require('express');
const router = express.Router();
const productosController = require('../controllers/productos.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/empresa/:id_empresa', authenticateToken, productosController.listarProductos);
router.get('/', authenticateToken, productosController.listarProductos);
router.get('/:id', authenticateToken, productosController.obtenerProducto);
router.post('/', authenticateToken, productosController.crearProducto);
router.put('/:id', authenticateToken, productosController.actualizarProducto);
router.delete('/:id', authenticateToken, productosController.eliminarProducto);

module.exports = router;

