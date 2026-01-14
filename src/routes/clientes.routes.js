const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientes.controller');
const { authenticateToken } = require('../middleware/auth');
const { requireSameCompanyOrSuperAdmin } = require('../middleware/roles');

router.get('/empresa/:id_empresa', authenticateToken, clientesController.listarClientes);
router.get('/', authenticateToken, clientesController.listarClientes);
router.get('/:id', authenticateToken, clientesController.obtenerCliente);
router.post('/', authenticateToken, clientesController.crearCliente);
router.put('/:id', authenticateToken, clientesController.actualizarCliente);
router.delete('/:id', authenticateToken, clientesController.eliminarCliente);

module.exports = router;

