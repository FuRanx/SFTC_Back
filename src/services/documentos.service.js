const pool = require('../config/db');

// Tipos de documentos que deben ser únicos por empresa (solo uno activo)
const TIPOS_DOCUMENTOS_UNICOS = ['logo', 'csf'];

async function subirDocumento(data) {
  const { id_empresa, tipo_documento, nombre_original, nombre_storage, file_id, extension } = data;

  if (!id_empresa || !tipo_documento || !file_id) throw new Error('Faltan datos obligatorios');

  // Verificar si el tipo de documento debe ser único
  const tipoNormalizado = tipo_documento.toLowerCase();
  const esDocumentoUnico = TIPOS_DOCUMENTOS_UNICOS.includes(tipoNormalizado);

  if (esDocumentoUnico) {
    // Verificar si ya existe un documento de este tipo para esta empresa
    const [existentes] = await pool.query(
      'SELECT id_documento FROM documentos_empresa WHERE id_empresa = ? AND tipo_documento = ?',
      [id_empresa, tipo_documento]
    );

    if (existentes.length > 0) {
      // Actualizar el documento existente
      const idDocumento = existentes[0].id_documento;
      await pool.query(
        `UPDATE documentos_empresa 
         SET nombre_original = ?, nombre_storage = ?, file_id = ?, extension = ?, fecha_subida = NOW()
         WHERE id_documento = ?`,
        [nombre_original, nombre_storage, file_id, extension, idDocumento]
      );
      return { id_documento: idDocumento, actualizado: true };
    }
  }

  // Si no existe o no es un documento único, crear uno nuevo
  const [result] = await pool.query(
    `INSERT INTO documentos_empresa (id_empresa, tipo_documento, nombre_original, nombre_storage, file_id, extension)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id_empresa, tipo_documento, nombre_original, nombre_storage, file_id, extension]
  );

  return { id_documento: result.insertId, actualizado: false };
}

async function listarDocumentosEmpresa(id_empresa) {
  // Obtener todos los documentos de la empresa
  // Para tipos únicos, solo debería haber uno (el más reciente) ya que se actualizan al subir uno nuevo
  // Para otros tipos, devolver todos ordenados por fecha
  // Usamos una subconsulta para obtener solo el más reciente de cada tipo único
  const placeholders = TIPOS_DOCUMENTOS_UNICOS.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT d1.* 
     FROM documentos_empresa d1
     WHERE d1.id_empresa = ?
       AND (
         d1.tipo_documento NOT IN (${placeholders})
         OR d1.id_documento = (
           SELECT d2.id_documento 
           FROM documentos_empresa d2
           WHERE d2.id_empresa = d1.id_empresa 
             AND d2.tipo_documento = d1.tipo_documento 
             AND d2.tipo_documento IN (${placeholders})
           ORDER BY d2.fecha_subida DESC 
           LIMIT 1
         )
       )
     ORDER BY d1.fecha_subida DESC`,
    [id_empresa, ...TIPOS_DOCUMENTOS_UNICOS, ...TIPOS_DOCUMENTOS_UNICOS]
  );
  return rows;
}

async function validarDocumento(id_documento, validado, observaciones) {
  await pool.query(
    'UPDATE documentos_empresa SET validado = ?, observaciones = ? WHERE id_documento = ?',
    [validado ? 1 : 0, observaciones || null, id_documento]
  );
  return { ok: true };
}

module.exports = { subirDocumento, listarDocumentosEmpresa, validarDocumento };
