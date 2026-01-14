const pool = require('../config/db');
const bcrypt = require('bcrypt');

async function crearSolicitud(data) {
  const { razon_social, rfc, regimen_fiscal, correo_contacto, telefono, direccion_fiscal, representante, observaciones, csf_fileId, logo_fileId } = data;

  const [result] = await pool.query(
    `INSERT INTO solicitudes_empresa (razon_social, rfc, regimen_fiscal, correo_contacto, telefono, direccion_fiscal, representante, observaciones, csf_fileId, logo_fileId)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [razon_social, rfc, regimen_fiscal, correo_contacto, telefono, direccion_fiscal, representante, observaciones, csf_fileId, logo_fileId]
  );
  return { id_solicitud: result.insertId };
}

async function listarSolicitudes() {
  const [rows] = await pool.query('SELECT * FROM solicitudes_empresa ORDER BY fecha_solicitud DESC');
  return rows;
}

async function aprobarSolicitud(id_solicitud) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM solicitudes_empresa WHERE id_solicitud = ?', [id_solicitud]);
    if (rows.length === 0) throw new Error('Solicitud no encontrada');
    const sol = rows[0];

    const [emp] = await conn.query(
      `INSERT INTO empresas (razon_social, rfc, regimen_fiscal, correo_contacto, telefono, direccion_fiscal, estatus)
       VALUES (?,?,?,?,?,?,?)`,
      [sol.razon_social, sol.rfc, sol.regimen_fiscal, sol.correo_contacto, sol.telefono, sol.direccion_fiscal, 'activa']
    );

    const idEmpresa = emp.insertId;
    const tempPass = Math.random().toString(36).slice(-8);
    const hash = await bcrypt.hash(tempPass, 10);

    const [admin] = await conn.query(
      `INSERT INTO usuarios (id_empresa, nombre, correo, contrasena, rol)
       VALUES (?, ?, ?, ?, ?)`,
      [idEmpresa, sol.representante || 'Administrador', sol.correo_contacto, hash, 'admin_empresa']
    );

    await conn.query('UPDATE solicitudes_empresa SET estatus = ? WHERE id_solicitud = ?', ['aprobada', id_solicitud]);

    // Inserta documentos si existen (dentro de la transacción para atomicidad)
    if (sol.csf_fileId) {
      await conn.query(
        `INSERT INTO documentos_empresa (id_empresa, tipo_documento, nombre_original, nombre_storage, file_id, extension, validado, observaciones)
         VALUES (?, 'csf', ?, ?, ?, ?, ?, ?)`,
        [idEmpresa, sol.razon_social + '_csf', `sol_${id_solicitud}_csf`, sol.csf_fileId, null, 0, 'Subido por solicitud']
      );
    }

    if (sol.logo_fileId) {
      await conn.query(
        `INSERT INTO documentos_empresa (id_empresa, tipo_documento, nombre_original, nombre_storage, file_id, extension, validado, observaciones)
         VALUES (?, 'logo', ?, ?, ?, ?, ?, ?)`,
        [idEmpresa, sol.razon_social + '_logo', `sol_${id_solicitud}_logo`, sol.logo_fileId, null, 0, 'Subido por solicitud']
      );
    }

    await conn.commit();
    return { id_empresa: idEmpresa, admin_id: admin.insertId, password_temporal: tempPass };
  } catch (err) {
    await conn.rollback();
    console.error('Error en aprobarSolicitud, rollback:', err.message || err);
    throw err;
  } finally {
    conn.release();
  }
}

async function rechazarSolicitud(id_solicitud, motivo) {
  await pool.query(
    'UPDATE solicitudes_empresa SET estatus = ?, observaciones = CONCAT(IFNULL(observaciones, ""), ?) WHERE id_solicitud = ?',
    ['rechazada', `\nMotivo: ${motivo}`, id_solicitud]
  );
  return { ok: true };
}

module.exports = { crearSolicitud, listarSolicitudes, aprobarSolicitud, rechazarSolicitud };
