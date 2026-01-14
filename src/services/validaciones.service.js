const pool = require('../config/db');

async function registrarValidacion(data) {
  const { id_empresa, id_documento, tipo_documento, resultado, confianza, detalles } = data;
  if (!id_empresa || !id_documento || !tipo_documento)
    throw new Error('Faltan datos para registrar validación');

  const [result] = await pool.query(
    `INSERT INTO bitacora_validaciones (id_empresa, id_documento, tipo_documento, resultado, confianza, detalles)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id_empresa, id_documento, tipo_documento, resultado ? 1 : 0, confianza, detalles]
  );

  if (resultado) {
    await pool.query('UPDATE documentos_empresa SET validado = 1 WHERE id_documento = ?', [id_documento]);
  }

  return { id_validacion: result.insertId };
}

async function listarValidaciones() {
  const [rows] = await pool.query('SELECT * FROM bitacora_validaciones ORDER BY fecha_validacion DESC');
  return rows;
}

module.exports = { registrarValidacion, listarValidaciones };
