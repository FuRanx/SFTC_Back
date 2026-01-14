const express = require('express');
const router = express.Router();
const vehiculosController = require('../controllers/vehiculos.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/empresa/:id_empresa', authenticateToken, vehiculosController.listarVehiculos);
router.get('/', authenticateToken, vehiculosController.listarVehiculos);
router.get('/:id', authenticateToken, vehiculosController.obtenerVehiculo);
router.post('/', authenticateToken, vehiculosController.crearVehiculo);
router.put('/:id', authenticateToken, vehiculosController.actualizarVehiculo);
router.delete('/:id', authenticateToken, vehiculosController.eliminarVehiculo);

module.exports = router;

