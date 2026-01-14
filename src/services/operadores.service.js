const pool = require('../config/db');

async function listarOperadores(id_empresa) {
  const [rows] = await pool.query(
    'SELECT * FROM operadores WHERE id_empresa = ? ORDER BY nombre',
    [id_empresa]
  );
  return rows;
}

async function obtenerOperador(id_operador) {
  const [rows] = await pool.query('SELECT * FROM operadores WHERE id_operador = ?', [id_operador]);
  if (rows.length === 0) throw new Error('Operador no encontrado');
  return rows[0];
}

async function crearOperador(data) {
  const { id_empresa, nombre, rfc, numero_licencia, tipo_licencia, vigencia_licencia, telefono } = data;
  
  if (!id_empresa || !nombre) {
    throw new Error('id_empresa y nombre son requeridos');
  }

  const [result] = await pool.query(
    `INSERT INTO operadores (id_empresa, nombre, rfc, numero_licencia, tipo_licencia, vigencia_licencia, telefono)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id_empresa, nombre, rfc || null, numero_licencia || null, tipo_licencia || null, vigencia_licencia || null, telefono || null]
  );

  return { id_operador: result.insertId };
}

async function actualizarOperador(id_operador, data) {
  const { nombre, rfc, numero_licencia, tipo_licencia, vigencia_licencia, telefono } = data;
  
  const [result] = await pool.query(
    `UPDATE operadores SET nombre=?, rfc=?, numero_licencia=?, tipo_licencia=?, vigencia_licencia=?, telefono=?
     WHERE id_operador=?`,
    [nombre, rfc, numero_licencia, tipo_licencia, vigencia_licencia, telefono, id_operador]
  );

  if (result.affectedRows === 0) throw new Error('Operador no encontrado');
  return { ok: true };
}

async function eliminarOperador(id_operador) {
  const [result] = await pool.query('DELETE FROM operadores WHERE id_operador = ?', [id_operador]);
  if (result.affectedRows === 0) throw new Error('Operador no encontrado');
  return { ok: true };
}

module.exports = { listarOperadores, obtenerOperador, crearOperador, actualizarOperador, eliminarOperador };

