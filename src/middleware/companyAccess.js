const pool = require('../config/db');

/**
 * Verifica que el usuario tenga acceso a una empresa específica
 * Retorna true si tiene acceso, false si no
 */
async function verificarAccesoEmpresa(user, id_empresa) {
  if (user.rol === 'superadmin') return true;
  if (!user.id_empresa) return false;
  return parseInt(user.id_empresa) === parseInt(id_empresa);
}

/**
 * Obtiene el id_empresa de un registro (cliente, producto, etc.)
 */
async function obtenerIdEmpresaDeRegistro(tabla, campo_id, id_registro) {
  const [rows] = await pool.query(
    `SELECT id_empresa FROM ${tabla} WHERE ${campo_id} = ?`,
    [id_registro]
  );
  if (rows.length === 0) return null;
  return rows[0].id_empresa;
}

module.exports = { verificarAccesoEmpresa, obtenerIdEmpresaDeRegistro };

