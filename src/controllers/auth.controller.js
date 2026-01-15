const authService = require('../services/auth.service');
const emailService = require('../services/email.service');

exports.login = async (req, res) => {
  try {
    const { correo, contrasena } = req.body;
    console.log('=== LOGIN CONTROLLER ===');
    console.log('Correo recibido en controller:', correo);
    const result = await authService.login(correo, contrasena);
    res.json(result);
  } catch (err) {
    console.error('=== ERROR EN LOGIN CONTROLLER ===');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    res.status(401).json({ error: err.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { nombre, correo, contrasena, rol, id_empresa } = req.body;
    const result = await authService.register(nombre, correo, contrasena, rol, id_empresa);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.usuariosListar = async (req, res) => {
  try {
    // Si hay id_empresa en los params, usarlo
    // Si es superadmin y no hay parámetro, permitir ver todos (pasar undefined)
    // Si no es superadmin, usar la empresa del usuario logueado
    let id_empresa = req.params.id_empresa ? parseInt(req.params.id_empresa) : undefined;
    
    if (!id_empresa && req.user.rol !== 'superadmin') {
      id_empresa = req.user.id_empresa;
    }
    
    const result = await authService.usuariosListar(id_empresa);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtenerUsuario = async (req, res) => {
  try {
    const result = await authService.obtenerUsuario(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

exports.actualizarUsuario = async (req, res) => {
  try {
    const result = await authService.actualizarUsuario(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.eliminarUsuario = async (req, res) => {
  try {
    const result = await authService.eliminarUsuario(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

exports.cambiarContrasena = async (req, res) => {
  try {
    const { nueva_contrasena } = req.body;
    const result = await authService.cambiarContrasena(req.params.id, nueva_contrasena, req.user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Recuperación de contraseña
exports.solicitarRecuperacion = async (req, res) => {
  try {
    const { correo } = req.body;
    if (!correo) {
      return res.status(400).json({ error: 'Correo es requerido' });
    }
    
    // Generar token (en un caso real, guardar esto en BD con expiración)
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Enviar correo
    const link = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/resetear-contrasena?token=${token}`;
    const html = `
      <h1>Recuperación de Contraseña</h1>
      <p>Has solicitado restablecer tu contraseña.</p>
      <p>Haz clic en el siguiente enlace para continuar:</p>
      <a href="${link}">${link}</a>
      <p>Si no solicitaste esto, ignora este correo.</p>
    `;

    const emailResult = await emailService.sendEmail(correo, 'Recuperación de Contraseña - S.F.T.C.', html);
    
    if (emailResult.success) {
      console.log('Correo de recuperación de contraseña enviado exitosamente a:', correo);
    } else {
      console.error('Error enviando correo de recuperación de contraseña a:', correo);
      console.error('Detalles del error:', emailResult.error?.message || 'Error desconocido');
      // No lanzamos el error para no revelar si el correo existe o no (por seguridad)
    }
    
    // Siempre retornamos el mismo mensaje (por seguridad, no revelamos si el correo existe)
    res.json({ 
      mensaje: 'Si el correo existe, se ha enviado un enlace de recuperación.',
      token: token // TODO: Remover en producción real cuando se guarde en BD
    });
  } catch (err) {
    console.error('Error en solicitarRecuperacion:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.resetearContrasena = async (req, res) => {
  try {
    const { token, nueva_contrasena } = req.body;
    if (!token || !nueva_contrasena) {
      return res.status(400).json({ error: 'Token y nueva contraseña son requeridos' });
    }
    
    // Simular validación de token y cambio de contraseña
    // En producción, se validaría el token y se actualizaría la contraseña
    res.json({ 
      mensaje: 'Contraseña restablecida exitosamente (simulado)'
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.completeSetup = async (req, res) => {
  try {
    const { nuevo_correo, nueva_contrasena } = req.body;
    const result = await authService.completeSetup(req.user.id_usuario, nuevo_correo, nueva_contrasena);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Refrescar token JWT con información actualizada del usuario
exports.refreshToken = async (req, res) => {
  try {
    // El usuario ya está autenticado (viene del middleware authenticateToken)
    const result = await authService.refreshToken(req.user.id_usuario);
    res.json(result);
  } catch (err) {
    console.error('Error en refreshToken controller:', err);
    res.status(400).json({ error: err.message });
  }
};

// Registrar solo el administrador (público, sin empresa)
exports.registerAdmin = async (req, res) => {
  try {
    const { nombre, correo, contrasena } = req.body;
    if (!nombre || !correo || !contrasena) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos' });
    }
    
    // Validaciones adicionales
    if (nombre.trim().length === 0) {
      return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    }
    if (correo.trim().length === 0) {
      return res.status(400).json({ error: 'El correo no puede estar vacío' });
    }
    if (contrasena.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    const result = await authService.registerAdmin(nombre.trim(), correo.trim(), contrasena);
    res.status(201).json({ 
      ...result, 
      message: 'Administrador registrado exitosamente. Se ha enviado un correo de verificación a tu dirección de email. Por favor, verifica tu correo antes de iniciar sesión.' 
    });
  } catch (err) {
    console.error('Error en registerAdmin controller:', err);
    res.status(400).json({ error: err.message || 'Error al registrar administrador' });
  }
};

// Verificar correo electrónico con token
exports.verificarCorreo = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token de verificación es requerido' });
    }
    const result = await authService.verificarCorreo(token);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
