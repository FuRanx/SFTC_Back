const pool = require('../config/db');
const bcrypt = require('bcrypt');

async function listarEmpresas(user) {
  if (user.rol === 'superadmin') {
    const [rows] = await pool.query('SELECT * FROM empresas ORDER BY fecha_registro DESC');
    return rows;
  } else {
    const [rows] = await pool.query('SELECT * FROM empresas WHERE id_empresa = ?', [user.id_empresa]);
    return rows;
  }
}

async function obtenerEmpresa(id_empresa) {
  const [rows] = await pool.query('SELECT * FROM empresas WHERE id_empresa = ?', [id_empresa]);
  if (rows.length === 0) throw new Error("Empresa no encontrada");
  return rows[0];
}

async function actualizarEmpresa(id_empresa, data) {
  const { razon_social, rfc, regimen_fiscal, correo_contacto, telefono, direccion_fiscal, estatus } = data;
  await pool.query(
    `UPDATE empresas SET razon_social=?, rfc=?, regimen_fiscal=?, correo_contacto=?, telefono=?, direccion_fiscal=?, estatus=? WHERE id_empresa=?`,
    [razon_social, rfc, regimen_fiscal, correo_contacto, telefono, direccion_fiscal, estatus, id_empresa]
  );
  return { ok: true };
}

async function registrarEmpresa(data) {
  const { razon_social, rfc, regimen_fiscal, correo_contacto, telefono, direccion_fiscal, nombre_admin, email_admin, password_admin } = data;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Crear Empresa
    // Siempre establecer estatus como 'pendiente' al registrar
    const [resultEmpresa] = await connection.query(
      `INSERT INTO empresas (razon_social, rfc, regimen_fiscal, correo_contacto, telefono, direccion_fiscal, estatus) VALUES (?, ?, ?, ?, ?, ?, 'pendiente')`,
      [razon_social, rfc, regimen_fiscal, correo_contacto, telefono, direccion_fiscal]
    );
    const id_empresa = resultEmpresa.insertId;

    // 2. Crear Usuario Admin (si se enviaron datos)
    if (nombre_admin && email_admin && password_admin) {
      // Verificar si el email ya existe
      const [existingUser] = await connection.query('SELECT id_usuario FROM usuarios WHERE correo = ?', [email_admin]);
      if (existingUser.length > 0) {
        throw new Error(`El correo ${email_admin} ya está registrado para otro usuario.`);
      }

      const hashedPassword = await bcrypt.hash(password_admin, 10);
      
      await connection.query(
        `INSERT INTO usuarios (nombre, correo, contrasena, rol, id_empresa, estatus, force_password_change) VALUES (?, ?, ?, 'admin_empresa', ?, 'activo', 1)`,
        [nombre_admin, email_admin, hashedPassword, id_empresa]
      );
    }

    await connection.commit();
    return { id_empresa };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Completar registro de empresa (asociar empresa a usuario admin existente)
async function completarRegistroEmpresa(id_usuario, data) {
  console.log('=== COMPLETAR REGISTRO EMPRESA SERVICE ===');
  console.log('id_usuario recibido:', id_usuario, 'tipo:', typeof id_usuario);
  console.log('data recibida:', JSON.stringify(data, null, 2));
  
  // Convertir id_usuario a número si es string
  const idUsuarioNum = typeof id_usuario === 'string' ? parseInt(id_usuario, 10) : id_usuario;
  if (isNaN(idUsuarioNum)) {
    console.error('Error: id_usuario no es un número válido:', id_usuario);
    throw new Error('ID de usuario inválido');
  }
  
  console.log('id_usuario convertido a número:', idUsuarioNum);
  
  const { razon_social, rfc, regimen_fiscal, correo_contacto, telefono, direccion_fiscal } = data;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verificar que el usuario existe y es admin_empresa sin empresa
    console.log('Buscando usuario en BD con id_usuario:', idUsuarioNum);
    const [usuario] = await connection.query(
      'SELECT id_usuario, rol, id_empresa, nombre, correo FROM usuarios WHERE id_usuario = ?',
      [idUsuarioNum]
    );
    
    console.log('Resultado de consulta usuario:', usuario);
    console.log('Número de usuarios encontrados:', usuario.length);
    
    if (usuario.length === 0) {
      console.error('Error: Usuario no encontrado con id_usuario:', idUsuarioNum);
      // Verificar si existe algún usuario en la tabla
      const [allUsers] = await connection.query('SELECT id_usuario, nombre, correo, rol FROM usuarios LIMIT 5');
      console.log('Usuarios disponibles en BD (primeros 5):', allUsers);
      throw new Error('Usuario no encontrado. Por favor, verifica tu sesión e intenta nuevamente.');
    }
    
    if (usuario[0].rol !== 'admin_empresa') {
      throw new Error('El usuario no es un administrador de empresa');
    }
    
    if (usuario[0].id_empresa) {
      throw new Error('El usuario ya tiene una empresa asociada');
    }

    // Verificar si el RFC ya existe
    const [existingRfc] = await connection.query('SELECT id_empresa FROM empresas WHERE rfc = ?', [rfc]);
    if (existingRfc.length > 0) {
      throw new Error('El RFC ya está registrado');
    }

    // Crear Empresa con estatus 'pendiente'
    const [resultEmpresa] = await connection.query(
      `INSERT INTO empresas (razon_social, rfc, regimen_fiscal, correo_contacto, telefono, direccion_fiscal, estatus) VALUES (?, ?, ?, ?, ?, ?, 'pendiente')`,
      [razon_social, rfc, regimen_fiscal, correo_contacto, telefono, direccion_fiscal]
    );
    const id_empresa = resultEmpresa.insertId;

    // Asociar empresa al usuario
    console.log('Asociando empresa', id_empresa, 'al usuario', idUsuarioNum);
    await connection.query(
      'UPDATE usuarios SET id_empresa = ? WHERE id_usuario = ?',
      [id_empresa, idUsuarioNum]
    );

    await connection.commit();
    return { id_empresa, message: 'Empresa registrada exitosamente. Estará pendiente de aprobación.' };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { listarEmpresas, obtenerEmpresa, actualizarEmpresa, registrarEmpresa, completarRegistroEmpresa };
