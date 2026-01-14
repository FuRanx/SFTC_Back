const express = require('express');
const router = express.Router();
const solicitudesCtrl = require('../controllers/solicitudes.controller');

// Ruta para crear una nueva solicitud
router.post('/', solicitudesCtrl.crearSolicitud);

router.get('/', solicitudesCtrl.listarSolicitudes);
router.post('/:id/aprobar', solicitudesCtrl.aprobarSolicitud);
router.post('/:id/rechazar', solicitudesCtrl.rechazarSolicitud);


module.exports = router;
