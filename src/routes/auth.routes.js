const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.post('/login', authController.login);
router.post('/complete-setup', authenticateToken, authController.completeSetup);
router.post('/register', authenticateToken, requireRole('superadmin'), authController.register);
// Ruta pública para registro solo del administrador (sin empresa)
router.post('/register-admin', authController.registerAdmin);
// Ruta pública para verificar correo electrónico
router.post('/verificar-correo', authController.verificarCorreo);
// Ruta para refrescar token JWT (requiere autenticación)
router.post('/refresh-token', authenticateToken, authController.refreshToken);

// Rutas de usuarios
router.get('/usuarios', authenticateToken, authController.usuariosListar);
router.get('/usuarios/empresa/:id_empresa', authenticateToken, authController.usuariosListar);
router.get('/usuarios/:id', authenticateToken, authController.obtenerUsuario);
router.put('/usuarios/:id', authenticateToken, authController.actualizarUsuario);
router.delete('/usuarios/:id', authenticateToken, requireRole('superadmin'), authController.eliminarUsuario);
router.put('/usuarios/:id/contrasena', authenticateToken, authController.cambiarContrasena);

// Recuperación de contraseña (público)
router.post('/recuperar-contrasena', authController.solicitarRecuperacion);
router.post('/resetear-contrasena', authController.resetearContrasena);

module.exports = router;
