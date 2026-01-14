const express = require('express');
const router = express.Router();
const operadoresController = require('../controllers/operadores.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/empresa/:id_empresa', authenticateToken, operadoresController.listarOperadores);
router.get('/', authenticateToken, operadoresController.listarOperadores);
router.get('/:id', authenticateToken, operadoresController.obtenerOperador);
router.post('/', authenticateToken, operadoresController.crearOperador);
router.put('/:id', authenticateToken, operadoresController.actualizarOperador);
router.delete('/:id', authenticateToken, operadoresController.eliminarOperador);

module.exports = router;

