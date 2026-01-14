const pool = require('../config/db');

async function listarProductos(id_empresa) {
  let query = 'SELECT * FROM productos_servicios';
  let params = [];
  
  // Si id_empresa es null o undefined, obtener todos los productos (para superadmin)
  if (id_empresa !== null && id_empresa !== undefined) {
    query += ' WHERE id_empresa = ?';
    params.push(id_empresa);
  }
  
  query += ' ORDER BY descripcion';
  
  const [rows] = await pool.query(query, params);
  return rows;
}

async function obtenerProducto(id_producto) {
  const [rows] = await pool.query('SELECT * FROM productos_servicios WHERE id_producto = ?', [id_producto]);
  if (rows.length === 0) throw new Error('Producto/Servicio no encontrado');
  return rows[0];
}

async function crearProducto(data) {
  const { id_empresa, clave_sat, descripcion, unidad_sat, precio, iva, ieps } = data;
  
  if (!id_empresa || !clave_sat || !descripcion || !unidad_sat || precio === undefined) {
    throw new Error('id_empresa, clave_sat, descripcion, unidad_sat y precio son requeridos');
  }

  const [result] = await pool.query(
    `INSERT INTO productos_servicios (id_empresa, clave_sat, descripcion, unidad_sat, precio, iva, ieps)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id_empresa, clave_sat, descripcion, unidad_sat, precio, iva || 0, ieps || 0]
  );

  return { id_producto: result.insertId };
}

async function actualizarProducto(id_producto, data) {
  const { clave_sat, descripcion, unidad_sat, precio, iva, ieps } = data;
  
  const [result] = await pool.query(
    `UPDATE productos_servicios SET clave_sat=?, descripcion=?, unidad_sat=?, precio=?, iva=?, ieps=?
     WHERE id_producto=?`,
    [clave_sat, descripcion, unidad_sat, precio, iva, ieps, id_producto]
  );

  if (result.affectedRows === 0) throw new Error('Producto/Servicio no encontrado');
  return { ok: true };
}

async function eliminarProducto(id_producto) {
  const [result] = await pool.query('DELETE FROM productos_servicios WHERE id_producto = ?', [id_producto]);
  if (result.affectedRows === 0) throw new Error('Producto/Servicio no encontrado');
  return { ok: true };
}

module.exports = { listarProductos, obtenerProducto, crearProducto, actualizarProducto, eliminarProducto };

