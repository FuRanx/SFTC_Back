const pool = require('../config/db');

async function listarVehiculos(id_empresa) {
  const [rows] = await pool.query(
    'SELECT * FROM vehiculos WHERE id_empresa = ? ORDER BY tipo_unidad',
    [id_empresa]
  );
  return rows;
}

async function obtenerVehiculo(id_vehiculo) {
  const [rows] = await pool.query('SELECT * FROM vehiculos WHERE id_vehiculo = ?', [id_vehiculo]);
  if (rows.length === 0) throw new Error('Vehículo no encontrado');
  return rows[0];
}

async function crearVehiculo(data) {
  const { id_empresa, tipo_unidad, placas, permiso_sct, numero_permiso, aseguradora, numero_poliza } = data;
  
  if (!id_empresa || !tipo_unidad) {
    throw new Error('id_empresa y tipo_unidad son requeridos');
  }

  const [result] = await pool.query(
    `INSERT INTO vehiculos (id_empresa, tipo_unidad, placas, permiso_sct, numero_permiso, aseguradora, numero_poliza)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id_empresa, tipo_unidad, placas || null, permiso_sct || null, numero_permiso || null, aseguradora || null, numero_poliza || null]
  );

  return { id_vehiculo: result.insertId };
}

async function actualizarVehiculo(id_vehiculo, data) {
  const { tipo_unidad, placas, permiso_sct, numero_permiso, aseguradora, numero_poliza } = data;
  
  const [result] = await pool.query(
    `UPDATE vehiculos SET tipo_unidad=?, placas=?, permiso_sct=?, numero_permiso=?, aseguradora=?, numero_poliza=?
     WHERE id_vehiculo=?`,
    [tipo_unidad, placas, permiso_sct, numero_permiso, aseguradora, numero_poliza, id_vehiculo]
  );

  if (result.affectedRows === 0) throw new Error('Vehículo no encontrado');
  return { ok: true };
}

async function eliminarVehiculo(id_vehiculo) {
  const [result] = await pool.query('DELETE FROM vehiculos WHERE id_vehiculo = ?', [id_vehiculo]);
  if (result.affectedRows === 0) throw new Error('Vehículo no encontrado');
  return { ok: true };
}

module.exports = { listarVehiculos, obtenerVehiculo, crearVehiculo, actualizarVehiculo, eliminarVehiculo };

