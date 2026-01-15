const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('./email.service');

async function login(correo, contrasena) {
  console.log('=== LOGIN SERVICE ===');
  console.log('Correo recibido:', correo);

  // Buscar usuario por correo
  const [rows] = await pool.query("SELECT * FROM usuarios WHERE correo = ?", [correo]);
  if (rows.length === 0) {
    console.log('Error: Usuario no encontrado para correo:', correo);
    throw new Error("Usuario no encontrado");
  }

  const user = rows[0];
  console.log('Usuario encontrado:', { 
    id: user.id_usuario, 
    nombre: user.nombre, 
    correo: user.correo, 
    rol: user.rol,
    estatus: user.estatus,
    estatus_type: typeof user.estatus,
    estatus_length: user.estatus ? user.estatus.length : 'null',
    id_empresa: user.id_empresa
  });

  // Comparar contraseña con hash almacenado
  const isMatch = await bcrypt.compare(contrasena, user.contrasena);
  if (!isMatch) {
    console.log('Error: Contraseña incorrecta');
    throw new Error("Credenciales incorrectas");
  }

  // Normalizar estatus (trim whitespace y convertir a lowercase para comparación)
  // Manejar casos donde estatus puede ser null, undefined, o string
  let estatusNormalizado = null;
  if (user.estatus) {
    if (typeof user.estatus === 'string') {
      estatusNormalizado = user.estatus.trim().toLowerCase();
    } else {
      estatusNormalizado = String(user.estatus).trim().toLowerCase();
    }
  }
  console.log('Estatus normalizado:', estatusNormalizado);
  console.log('Estatus original (raw):', JSON.stringify(user.estatus));

  // Verificar que el usuario esté activo (no pendiente de verificación)
  if (estatusNormalizado === 'pendiente_verificacion') {
    console.log('Error: Usuario pendiente de verificación de correo');
    throw new Error("Por favor, verifica tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.");
  }
  
  if (estatusNormalizado !== 'activo') {
    console.log('Error: Usuario inactivo. Estatus recibido:', user.estatus, 'Estatus normalizado:', estatusNormalizado);
    console.log('Tipo de estatus:', typeof user.estatus);
    throw new Error(`Usuario inactivo. Estatus actual: ${user.estatus || 'no definido'}`);
  }

  // Solo validar estatus de empresa si el usuario tiene empresa asociada
  // Permitir que admin_empresa sin empresa pueda hacer login para completar registro
  if (user.id_empresa && user.id_empresa !== 0) {
    console.log('Verificando estatus de empresa con id_empresa:', user.id_empresa);
    console.log('Tipo de id_empresa:', typeof user.id_empresa);
    
    // Consultar empresa con todos los campos para debugging
    const [empresa] = await pool.query("SELECT * FROM empresas WHERE id_empresa = ?", [user.id_empresa]);
    console.log('Resultado de consulta empresa:', JSON.stringify(empresa, null, 2));
    
    if (empresa.length > 0) {
      const empresaData = empresa[0];
      console.log('Datos completos de empresa:', empresaData);
      console.log('Campos disponibles:', Object.keys(empresaData));
      
      // Intentar obtener estatus con diferentes nombres posibles
      const estatusRaw = empresaData.estatus || empresaData.estado || empresaData.status || null;
      console.log('Estatus raw encontrado:', estatusRaw);
      console.log('Tipo de estatus:', typeof estatusRaw);
      
      const estatusEmpresa = estatusRaw ? String(estatusRaw).trim().toLowerCase() : null;
      const razonSocial = empresaData.razon_social || empresaData.nombre || 'la empresa';
      
      console.log('Estatus de empresa (raw):', estatusRaw);
      console.log('Estatus de empresa (normalizado):', estatusEmpresa);
      console.log('Razón social:', razonSocial);
      
      if (!estatusRaw) {
        console.log('ERROR: El campo estatus no existe o es NULL en la base de datos');
        throw new Error(`Error de configuración: La empresa "${razonSocial}" no tiene un estatus definido en la base de datos. Por favor, contacta al administrador.`);
      }
      
      if (estatusEmpresa !== 'activa') {
        console.log('Error: Empresa no activa. Estatus:', estatusRaw);
        // Mensaje más claro según el estatus de la empresa
        let mensajeError = '';
        if (estatusEmpresa === 'suspendida') {
          mensajeError = `Tu cuenta está suspendida. La empresa "${razonSocial}" se encuentra suspendida. Por favor, contacta al administrador para más información.`;
        } else if (estatusEmpresa === 'pendiente') {
          mensajeError = `La empresa "${razonSocial}" está pendiente de aprobación. Por favor, espera a que sea activada.`;
        } else {
          mensajeError = `La empresa "${razonSocial}" no se encuentra activa. Estatus actual: ${estatusRaw}`;
        }
        throw new Error(mensajeError);
      }
      
      console.log('✓ Empresa activa, continuando con login');
    } else {
      console.log('ERROR: Empresa con id_empresa', user.id_empresa, 'no encontrada en la base de datos');
      throw new Error(`La empresa asociada a tu cuenta no fue encontrada. Por favor, contacta al administrador.`);
    }
  } else {
    console.log('Usuario sin empresa asociada (id_empresa:', user.id_empresa, '), omitiendo validación de empresa');
  }

  // Generar token JWT
  const token = jwt.sign(
    { id_usuario: user.id_usuario, id_empresa: user.id_empresa, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  console.log('Token generado correctamente para:', user.nombre);

  return { 
    token,
    user: { 
      id: user.id_usuario, 
      nombre: user.nombre, 
      correo: user.correo, 
      rol: user.rol, 
      id_empresa: user.id_empresa,
      force_password_change: user.force_password_change
    }
  };
}

async function completeSetup(id_usuario, nuevo_correo, nueva_contrasena) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verificar si el nuevo correo ya existe (si es diferente al actual)
    const [currentUser] = await connection.query("SELECT correo FROM usuarios WHERE id_usuario = ?", [id_usuario]);
    if (currentUser.length === 0) throw new Error("Usuario no encontrado");

    if (nuevo_correo !== currentUser[0].correo) {
      const [exists] = await connection.query("SELECT id_usuario FROM usuarios WHERE correo = ?", [nuevo_correo]);
      if (exists.length > 0) throw new Error("El correo ya está en uso");
    }

    const hash = await bcrypt.hash(nueva_contrasena, 10);

    await connection.query(
      "UPDATE usuarios SET correo = ?, contrasena = ?, force_password_change = 0 WHERE id_usuario = ?",
      [nuevo_correo, hash, id_usuario]
    );

    await connection.commit();
    return { message: "Configuración completada exitosamente" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function register(nombre, correo, contrasena, rol, id_empresa) {
  console.log('=== REGISTER SERVICE ===');
  console.log(`Registrando usuario ${nombre} (${correo})`);

  // Validar duplicado
  const [exists] = await pool.query("SELECT id_usuario FROM usuarios WHERE correo = ?", [correo]);
  if (exists.length > 0) throw new Error("El correo ya está registrado");

  const hash = await bcrypt.hash(contrasena, 10);
  const [result] = await pool.query(
    "INSERT INTO usuarios (id_empresa, nombre, correo, contrasena, rol, estatus, fecha_creacion) VALUES (?, ?, ?, ?, ?, 'activo', NOW())",
    [id_empresa || null, nombre, correo, hash, rol]
  );

  console.log('Usuario registrado exitosamente con ID:', result.insertId);
  return { id: result.insertId, nombre, correo, rol };
}

async function usuariosListar(id_empresa) {
  console.log('=== USUARIOS LISTAR SERVICE ===');
  let query = "SELECT id_usuario, id_empresa, nombre, correo, rol, estatus, fecha_creacion FROM usuarios";
  let params = [];
  
  if (id_empresa) {
    query += " WHERE id_empresa = ?";
    params.push(id_empresa);
  }
  
  query += " ORDER BY fecha_creacion DESC";
  
  const [rows] = await pool.query(query, params);
  
  // Mapear id_usuario a id para mantener consistencia con la interfaz User
  return rows.map(row => ({
    id: row.id_usuario,
    id_usuario: row.id_usuario, // Mantener también id_usuario por compatibilidad
    id_empresa: row.id_empresa,
    nombre: row.nombre,
    correo: row.correo,
    rol: row.rol,
    estatus: row.estatus,
    fecha_creacion: row.fecha_creacion
  }));
}

async function obtenerUsuario(id_usuario) {
  const [rows] = await pool.query(
    "SELECT id_usuario, id_empresa, nombre, correo, rol, estatus, fecha_creacion FROM usuarios WHERE id_usuario = ?",
    [id_usuario]
  );
  if (rows.length === 0) throw new Error('Usuario no encontrado');
  
  const row = rows[0];
  // Mapear id_usuario a id para mantener consistencia con la interfaz User
  return {
    id: row.id_usuario,
    id_usuario: row.id_usuario, // Mantener también id_usuario por compatibilidad
    id_empresa: row.id_empresa,
    nombre: row.nombre,
    correo: row.correo,
    rol: row.rol,
    estatus: row.estatus,
    fecha_creacion: row.fecha_creacion
  };
}

async function actualizarUsuario(id_usuario, data) {
  const { nombre, correo, rol, estatus, id_empresa } = data;
  
  const [result] = await pool.query(
    `UPDATE usuarios SET nombre=?, correo=?, rol=?, estatus=?, id_empresa=? WHERE id_usuario=?`,
    [nombre, correo, rol, estatus, id_empresa || null, id_usuario]
  );

  if (result.affectedRows === 0) throw new Error('Usuario no encontrado');
  return { ok: true };
}

async function eliminarUsuario(id_usuario) {
  const [result] = await pool.query('DELETE FROM usuarios WHERE id_usuario = ?', [id_usuario]);
  if (result.affectedRows === 0) throw new Error('Usuario no encontrado');
  return { ok: true };
}

async function cambiarContrasena(id_usuario, nueva_contrasena) {
  const hash = await bcrypt.hash(nueva_contrasena, 10);
  const [result] = await pool.query(
    'UPDATE usuarios SET contrasena=? WHERE id_usuario=?',
    [hash, id_usuario]
  );
  if (result.affectedRows === 0) throw new Error('Usuario no encontrado');
  return { ok: true };
}

// Registrar solo el administrador (sin empresa)
async function registerAdmin(nombre, correo, contrasena) {
  console.log('=== REGISTER ADMIN SERVICE ===');
  console.log(`Registrando administrador ${nombre} (${correo})`);

  // Validar duplicado
  const [exists] = await pool.query("SELECT id_usuario FROM usuarios WHERE correo = ?", [correo]);
  if (exists.length > 0) throw new Error("El correo ya está registrado");

  // Generar token de verificación
  const token = crypto.randomBytes(32).toString('hex');
  const fechaExpiracion = new Date();
  fechaExpiracion.setHours(fechaExpiracion.getHours() + 24); // Expira en 24 horas

  const hash = await bcrypt.hash(contrasena, 10);
  
  try {
    // Intentar insertar con las nuevas columnas
    const [result] = await pool.query(
      "INSERT INTO usuarios (id_empresa, nombre, correo, contrasena, rol, estatus, token_verificacion, fecha_expiracion_token, fecha_creacion) VALUES (?, ?, ?, ?, 'admin_empresa', 'pendiente_verificacion', ?, ?, NOW())",
      [null, nombre, correo, hash, token, fechaExpiracion]
    );

    const idUsuario = result.insertId;
    console.log('Administrador registrado exitosamente con ID:', idUsuario);

    // Enviar correo de verificación
    const emailResult = await emailService.enviarCorreoVerificacion(correo, nombre, token);
    if (emailResult.success) {
      console.log('Correo de verificación enviado exitosamente a:', correo);
    } else {
      console.error('Error enviando correo de verificación a:', correo);
      console.error('Detalles del error:', emailResult.error?.message || 'Error desconocido');
      // No lanzamos el error para que el registro se complete, pero logueamos el error
    }

    return { id: idUsuario, nombre, correo, rol: 'admin_empresa' };
  } catch (error) {
    console.error('Error en registerAdmin:', error);
    // Si el error es por columnas faltantes o estatus inválido, dar un mensaje más claro
    if (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
      throw new Error('Error de configuración de base de datos: Las columnas de verificación no existen o el estatus no está permitido. Por favor, ejecuta el script SQL: database/add_verification_token.sql');
    }
    throw error;
  }
}

// Verificar token de verificación de correo
async function verificarCorreo(token) {
  console.log('=== VERIFICAR CORREO SERVICE ===');
  
  // Buscar usuario por token
  const [rows] = await pool.query(
    "SELECT id_usuario, nombre, correo, fecha_expiracion_token FROM usuarios WHERE token_verificacion = ? AND estatus = 'pendiente_verificacion'",
    [token]
  );
  
  if (rows.length === 0) {
    throw new Error('Token de verificación inválido o ya utilizado');
  }
  
  const usuario = rows[0];
  
  // Verificar que el token no haya expirado
  const fechaExpiracion = new Date(usuario.fecha_expiracion_token);
  const ahora = new Date();
  
  if (ahora > fechaExpiracion) {
    throw new Error('El token de verificación ha expirado. Por favor, solicita un nuevo correo de verificación.');
  }
  
  // Actualizar usuario: activar cuenta y limpiar token
  await pool.query(
    "UPDATE usuarios SET estatus = 'activo', token_verificacion = NULL, fecha_expiracion_token = NULL WHERE id_usuario = ?",
    [usuario.id_usuario]
  );
  
  console.log('Correo verificado exitosamente para usuario:', usuario.id_usuario);
  return { 
    message: 'Correo verificado exitosamente. Ya puedes iniciar sesión.',
    usuario: {
      id: usuario.id_usuario,
      nombre: usuario.nombre,
      correo: usuario.correo
    }
  };
}

// Actualizar token JWT con información actualizada del usuario (sin requerir contraseña)
async function refreshToken(id_usuario) {
  console.log('=== REFRESH TOKEN SERVICE ===');
  console.log('id_usuario recibido:', id_usuario);

  // Buscar usuario actualizado en BD
  const [rows] = await pool.query(
    "SELECT id_usuario, id_empresa, nombre, correo, rol, estatus, force_password_change FROM usuarios WHERE id_usuario = ?",
    [id_usuario]
  );
  
  if (rows.length === 0) {
    throw new Error("Usuario no encontrado");
  }

  const user = rows[0];
  console.log('Usuario encontrado para refresh:', { id: user.id_usuario, nombre: user.nombre, id_empresa: user.id_empresa });

  // Verificar que el usuario esté activo
  if (user.estatus !== 'activo') {
    throw new Error("Usuario no activo");
  }

  // Generar nuevo token JWT con información actualizada
  const token = jwt.sign(
    { id_usuario: user.id_usuario, id_empresa: user.id_empresa, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  console.log('Token refrescado correctamente para:', user.nombre);

  return { 
    token,
    user: { 
      id: user.id_usuario, 
      nombre: user.nombre, 
      correo: user.correo, 
      rol: user.rol, 
      id_empresa: user.id_empresa,
      force_password_change: user.force_password_change
    }
  };
}

module.exports = { login, register, usuariosListar, obtenerUsuario, actualizarUsuario, eliminarUsuario, cambiarContrasena, completeSetup, registerAdmin, verificarCorreo, refreshToken };
