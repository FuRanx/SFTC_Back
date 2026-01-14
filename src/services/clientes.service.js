const pool = require('../config/db');

async function listarClientes(id_empresa) {
  let query = `
    SELECT c1.* 
    FROM clientes c1
    INNER JOIN (
      SELECT id_empresa, rfc, MIN(id_cliente) as id_cliente_min
      FROM clientes
      WHERE rfc IS NOT NULL AND rfc != ''
      GROUP BY id_empresa, rfc
    ) c2 ON c1.id_cliente = c2.id_cliente_min 
         AND c1.id_empresa = c2.id_empresa 
         AND c1.rfc = c2.rfc
    
    UNION
    
    SELECT * 
    FROM clientes 
    WHERE (rfc IS NULL OR rfc = '')
  `;
  let params = [];
  
  // Si id_empresa es null o undefined, obtener todos los clientes (para superadmin)
  if (id_empresa !== null && id_empresa !== undefined) {
    query = `
      SELECT c1.* 
      FROM clientes c1
      INNER JOIN (
        SELECT id_empresa, rfc, MIN(id_cliente) as id_cliente_min
        FROM clientes
        WHERE rfc IS NOT NULL AND rfc != '' AND id_empresa = ?
        GROUP BY id_empresa, rfc
      ) c2 ON c1.id_cliente = c2.id_cliente_min 
           AND c1.id_empresa = c2.id_empresa 
           AND c1.rfc = c2.rfc
      
      UNION
      
      SELECT * 
      FROM clientes 
      WHERE id_empresa = ? AND (rfc IS NULL OR rfc = '')
    `;
    params = [id_empresa, id_empresa];
  }
  
  query += ' ORDER BY razon_social';
  
  const [rows] = await pool.query(query, params);
  return rows;
}

async function obtenerCliente(id_cliente) {
  const [rows] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [id_cliente]);
  if (rows.length === 0) throw new Error('Cliente no encontrado');
  return rows[0];
}

async function crearCliente(data) {
  const { id_empresa, razon_social, rfc, uso_cfdi, correo, telefono, domicilio } = data;
  
  if (!id_empresa || !razon_social || !rfc) {
    throw new Error('id_empresa, razon_social y rfc son requeridos');
  }

  const [result] = await pool.query(
    `INSERT INTO clientes (id_empresa, razon_social, rfc, uso_cfdi, correo, telefono, domicilio)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id_empresa, razon_social, rfc, uso_cfdi || null, correo || null, telefono || null, domicilio || null]
  );

  return { id_cliente: result.insertId };
}

async function actualizarCliente(id_cliente, data) {
  const { razon_social, rfc, uso_cfdi, correo, telefono, domicilio } = data;
  
  const [result] = await pool.query(
    `UPDATE clientes SET razon_social=?, rfc=?, uso_cfdi=?, correo=?, telefono=?, domicilio=?
     WHERE id_cliente=?`,
    [razon_social, rfc, uso_cfdi, correo, telefono, domicilio, id_cliente]
  );

  if (result.affectedRows === 0) throw new Error('Cliente no encontrado');
  return { ok: true };
}

async function eliminarCliente(id_cliente) {
  const [result] = await pool.query('DELETE FROM clientes WHERE id_cliente = ?', [id_cliente]);
  if (result.affectedRows === 0) throw new Error('Cliente no encontrado');
  return { ok: true };
}

module.exports = { listarClientes, obtenerCliente, crearCliente, actualizarCliente, eliminarCliente };

