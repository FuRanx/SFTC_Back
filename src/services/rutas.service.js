const pool = require('../config/db');

async function listarRutas(id_empresa) {
  const [rows] = await pool.query(
    'SELECT * FROM rutas WHERE id_empresa = ? ORDER BY origen, destino',
    [id_empresa]
  );
  return rows;
}

async function obtenerRuta(id_ruta) {
  const [rows] = await pool.query('SELECT * FROM rutas WHERE id_ruta = ?', [id_ruta]);
  if (rows.length === 0) throw new Error('Ruta no encontrada');
  return rows[0];
}

async function crearRuta(data) {
  const { id_empresa, origen, destino, distancia_km } = data;
  
  if (!id_empresa || !origen || !destino) {
    throw new Error('id_empresa, origen y destino son requeridos');
  }

  const [result] = await pool.query(
    `INSERT INTO rutas (id_empresa, origen, destino, distancia_km)
     VALUES (?, ?, ?, ?)`,
    [id_empresa, origen, destino, distancia_km || null]
  );

  return { id_ruta: result.insertId };
}

async function actualizarRuta(id_ruta, data) {
  const { origen, destino, distancia_km } = data;
  
  const [result] = await pool.query(
    `UPDATE rutas SET origen=?, destino=?, distancia_km=? WHERE id_ruta=?`,
    [origen, destino, distancia_km, id_ruta]
  );

  if (result.affectedRows === 0) throw new Error('Ruta no encontrada');
  return { ok: true };
}

async function eliminarRuta(id_ruta) {
  const [result] = await pool.query('DELETE FROM rutas WHERE id_ruta = ?', [id_ruta]);
  if (result.affectedRows === 0) throw new Error('Ruta no encontrada');
  return { ok: true };
}

module.exports = { listarRutas, obtenerRuta, crearRuta, actualizarRuta, eliminarRuta };

