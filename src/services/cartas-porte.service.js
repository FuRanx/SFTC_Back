const pool = require('../config/db');

/**
 * Listar todas las cartas porte de una empresa
 */
async function listarCartasPorte(id_empresa, id_usuario = null) {
  let query = `
    SELECT 
      cp.*,
      o.nombre as operador_nombre,
      o.rfc as operador_rfc,
      v.tipo_unidad as vehiculo_tipo,
      v.placas,
      u.nombre as usuario_nombre
    FROM cartas_porte cp
    LEFT JOIN operadores o ON cp.id_operador = o.id_operador
    LEFT JOIN vehiculos v ON cp.id_vehiculo = v.id_vehiculo
    LEFT JOIN usuarios u ON cp.id_usuario = u.id_usuario
  `;
  
  const params = [];
  const whereConditions = [];
  
  if (id_empresa) {
    whereConditions.push('cp.id_empresa = ?');
    params.push(id_empresa);
  }
  
  // Si se proporciona id_usuario, filtrar por él (útil para transportistas)
  if (id_usuario) {
    whereConditions.push('cp.id_usuario = ?');
    params.push(id_usuario);
  }
  
  if (whereConditions.length > 0) {
    query += ' WHERE ' + whereConditions.join(' AND ');
  }
  
  query += ' ORDER BY cp.fecha_creacion DESC';
  
  const [rows] = await pool.query(query, params);
  return rows;
}

/**
 * Obtener una carta porte por ID con todos sus detalles
 */
async function obtenerCartaPorte(id_carta_porte) {
  const [cartasPorte] = await pool.query(
    'SELECT * FROM cartas_porte WHERE id_carta_porte = ?',
    [id_carta_porte]
  );
  
  if (cartasPorte.length === 0) {
    throw new Error('Carta Porte no encontrada');
  }
  
  const cartaPorte = cartasPorte[0];
  
  // Obtener operador y vehículo
  if (cartaPorte.id_operador) {
    const [operadores] = await pool.query(
      'SELECT * FROM operadores WHERE id_operador = ?',
      [cartaPorte.id_operador]
    );
    cartaPorte.operador = operadores[0] || null;
  }
  
  if (cartaPorte.id_vehiculo) {
    const [vehiculos] = await pool.query(
      'SELECT * FROM vehiculos WHERE id_vehiculo = ?',
      [cartaPorte.id_vehiculo]
    );
    cartaPorte.vehiculo = vehiculos[0] || null;
  }
  
  // Obtener mercancías
  const [mercancias] = await pool.query(
    'SELECT * FROM cp_mercancias_carta_porte WHERE id_carta_porte = ?',
    [id_carta_porte]
  );
  cartaPorte.mercancias = mercancias;
  
  // Obtener ubicaciones
  const [ubicaciones] = await pool.query(
    'SELECT * FROM cp_ubicaciones_carta_porte WHERE id_carta_porte = ? ORDER BY fecha_hora',
    [id_carta_porte]
  );
  cartaPorte.ubicaciones = ubicaciones;
  
  return cartaPorte;
}

/**
 * Crear una nueva carta porte
 */
async function crearCartaPorte(user, data) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const {
      id_empresa,
      nombre,
      id_operador,
      id_vehiculo,
      estatus = 'borrador',
      mercancias = [],
      ubicaciones = []
    } = data;
    
    if (!id_empresa) {
      throw new Error('El ID de empresa es requerido');
    }
    
    // Crear la carta porte
    const [result] = await connection.query(
      `INSERT INTO cartas_porte 
       (id_empresa, id_usuario, nombre, id_operador, id_vehiculo, estatus, fecha_creacion, fecha_emision)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        id_empresa,
        user.id_usuario,
        nombre || `Carta Porte ${new Date().toLocaleDateString('es-MX')}`,
        id_operador || null,
        id_vehiculo || null,
        estatus,
        data.fecha_emision || null
      ]
    );
    
    const id_carta_porte = result.insertId;
    
    // Insertar mercancías
    if (mercancias && Array.isArray(mercancias)) {
      for (const mercancia of mercancias) {
        await connection.query(
          `INSERT INTO cp_mercancias_carta_porte 
           (id_carta_porte, descripcion, peso_kg, valor_mercancia, clave_sat, unidad_sat, cantidad)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id_carta_porte,
            mercancia.descripcion,
            mercancia.peso_kg || 0,
            mercancia.valor_mercancia || 0,
            mercancia.clave_sat || null,
            mercancia.unidad_sat || null,
            mercancia.cantidad || 0
          ]
        );
      }
    }
    
    // Insertar ubicaciones
    if (ubicaciones && Array.isArray(ubicaciones)) {
      for (const ubicacion of ubicaciones) {
        let fechaHoraFormatted = null;
        if (ubicacion.fecha_hora) {
          fechaHoraFormatted = new Date(ubicacion.fecha_hora).toISOString().slice(0, 19).replace('T', ' ');
        }
        
        await connection.query(
          `INSERT INTO cp_ubicaciones_carta_porte
           (id_carta_porte, tipo, descripcion, domicilio, fecha_hora, latitud, longitud)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id_carta_porte,
            ubicacion.tipo,
            ubicacion.descripcion,
            ubicacion.domicilio || null,
            fechaHoraFormatted,
            ubicacion.latitud || null,
            ubicacion.longitud || null
          ]
        );
      }
    }
    
    await connection.commit();
    return await obtenerCartaPorte(id_carta_porte);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Actualizar una carta porte existente
 */
async function actualizarCartaPorte(id_carta_porte, data) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const {
      nombre,
      id_operador,
      id_vehiculo,
      estatus,
      fecha_emision,
      mercancias,
      ubicaciones
    } = data;
    
    // Actualizar datos principales
    const updateFields = [];
    const updateValues = [];
    
    if (nombre !== undefined) {
      updateFields.push('nombre = ?');
      updateValues.push(nombre);
    }
    if (id_operador !== undefined) {
      updateFields.push('id_operador = ?');
      updateValues.push(id_operador);
    }
    if (id_vehiculo !== undefined) {
      updateFields.push('id_vehiculo = ?');
      updateValues.push(id_vehiculo);
    }
    if (estatus !== undefined) {
      updateFields.push('estatus = ?');
      updateValues.push(estatus);
    }
    if (fecha_emision !== undefined) {
      updateFields.push('fecha_emision = ?');
      updateValues.push(fecha_emision ? new Date(fecha_emision).toISOString().slice(0, 19).replace('T', ' ') : null);
    }
    
    if (updateFields.length > 0) {
      updateValues.push(id_carta_porte);
      await connection.query(
        `UPDATE cartas_porte SET ${updateFields.join(', ')} WHERE id_carta_porte = ?`,
        updateValues
      );
    }
    
    // Actualizar mercancías si se proporcionan
    if (mercancias !== undefined) {
      await connection.query('DELETE FROM cp_mercancias_carta_porte WHERE id_carta_porte = ?', [id_carta_porte]);
      if (Array.isArray(mercancias) && mercancias.length > 0) {
        for (const mercancia of mercancias) {
          await connection.query(
            `INSERT INTO cp_mercancias_carta_porte 
             (id_carta_porte, descripcion, peso_kg, valor_mercancia, clave_sat, unidad_sat, cantidad)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              id_carta_porte,
              mercancia.descripcion,
              mercancia.peso_kg || 0,
              mercancia.valor_mercancia || 0,
              mercancia.clave_sat || null,
              mercancia.unidad_sat || null,
              mercancia.cantidad || 0
            ]
          );
        }
      }
    }
    
    // Actualizar ubicaciones si se proporcionan
    if (ubicaciones !== undefined) {
      await connection.query('DELETE FROM cp_ubicaciones_carta_porte WHERE id_carta_porte = ?', [id_carta_porte]);
      if (Array.isArray(ubicaciones) && ubicaciones.length > 0) {
        for (const ubicacion of ubicaciones) {
          let fechaHoraFormatted = null;
          if (ubicacion.fecha_hora) {
            fechaHoraFormatted = new Date(ubicacion.fecha_hora).toISOString().slice(0, 19).replace('T', ' ');
          }
          
          await connection.query(
            `INSERT INTO cp_ubicaciones_carta_porte
             (id_carta_porte, tipo, descripcion, domicilio, fecha_hora, latitud, longitud)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              id_carta_porte,
              ubicacion.tipo,
              ubicacion.descripcion,
              ubicacion.domicilio || null,
              fechaHoraFormatted,
              ubicacion.latitud || null,
              ubicacion.longitud || null
            ]
          );
        }
      }
    }
    
    await connection.commit();
    return await obtenerCartaPorte(id_carta_porte);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Eliminar una carta porte
 */
async function eliminarCartaPorte(id_carta_porte) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Eliminar mercancías
    await connection.query('DELETE FROM cp_mercancias_carta_porte WHERE id_carta_porte = ?', [id_carta_porte]);
    
    // Eliminar ubicaciones
    await connection.query('DELETE FROM cp_ubicaciones_carta_porte WHERE id_carta_porte = ?', [id_carta_porte]);
    
    // Eliminar carta porte
    const [result] = await connection.query('DELETE FROM cartas_porte WHERE id_carta_porte = ?', [id_carta_porte]);
    
    if (result.affectedRows === 0) {
      throw new Error('Carta Porte no encontrada');
    }
    
    await connection.commit();
    return { ok: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listarCartasPorte,
  obtenerCartaPorte,
  crearCartaPorte,
  actualizarCartaPorte,
  eliminarCartaPorte
};
