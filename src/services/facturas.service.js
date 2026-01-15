const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { uploadFileFromBuffer, downloadFileToBuffer } = require('./appwrite.service');
const facturamaService = require('./facturama.service');
require('dotenv').config();

async function crearFactura(user, data) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id_empresa, folio, cliente, rfc_cliente, total, estatus, conceptos, autotransporte, mercancias, ubicaciones } = data;

    if (!id_empresa) throw new Error('El usuario no tiene una empresa asignada o no se envió el ID de la empresa.');
    if (!folio) throw new Error('No se generó el folio de la factura.');
    
    // Permitir total 0 para borradores
    const esBorradorCrear = estatus === 'borrador' || estatus === 'pendiente';
    if (!esBorradorCrear && (!total || total === 0)) {
      throw new Error('El total de la factura no puede ser 0.');
    }

    // Crear factura inicial sin XML/PDF (se generarán después)
    const [result] = await connection.query(
      `INSERT INTO facturas (id_empresa, id_usuario, folio, cliente, rfc_cliente, regimen_fiscal_cliente, uso_cfdi_cliente, cp_cliente, forma_pago, metodo_pago, lugar_expedicion, total, estatus, xml_fileId, pdf_fileId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      [
        id_empresa, 
        user.id_usuario, 
        folio, 
        cliente, 
        rfc_cliente, 
        data.regimen_fiscal_cliente || '616',
        data.uso_cfdi_cliente || 'S01',
        data.cp_cliente || '78140',
        data.forma_pago || '99',
        data.metodo_pago || 'PPD',
        data.lugar_expedicion || '78140',
        total, 
        estatus || 'validada'
      ]
    );

    const id_factura = result.insertId;

    // Si es borrador, guardar y retornar sin timbrar
    if (esBorradorCrear) {
      await connection.commit();
      connection.release();
      return { id_factura, estatus: 'borrador', mensaje: 'Borrador guardado exitosamente' };
    }

    // Insertar conceptos
    if (conceptos && Array.isArray(conceptos)) {
      for (const concepto of conceptos) {
        await connection.query(
          `INSERT INTO conceptos_factura (id_factura, id_producto, clave_sat, unidad_sat, objeto_imp, descripcion, cantidad, precio_unitario, importe)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id_factura, 
            concepto.id_producto || null, 
            concepto.clave_sat || '01010101',
            concepto.unidad_sat || 'H87',
            concepto.objeto_imp || '02',
            concepto.descripcion, 
            concepto.cantidad, 
            concepto.precio_unitario, 
            concepto.importe
          ]
        );
      }
    }

    // Insertar complemento autotransporte
    if (autotransporte && autotransporte.id_vehiculo && autotransporte.id_operador && 
        autotransporte.id_vehiculo > 0 && autotransporte.id_operador > 0) {
      await connection.query(
        `INSERT INTO cp_autotransporte (id_factura, id_vehiculo, id_operador)
         VALUES (?, ?, ?)`,
        [id_factura, autotransporte.id_vehiculo, autotransporte.id_operador]
      );
    }

    // Insertar mercancías
    if (mercancias && Array.isArray(mercancias)) {
      for (const mercancia of mercancias) {
        await connection.query(
          `INSERT INTO cp_mercancias (id_factura, descripcion, peso_kg, valor_mercancia)
           VALUES (?, ?, ?, ?)`,
          [id_factura, mercancia.descripcion, mercancia.peso_kg, mercancia.valor_mercancia]
        );
      }
    }

    // Insertar ubicaciones
    if (ubicaciones && Array.isArray(ubicaciones)) {
      for (const ubicacion of ubicaciones) {
        await connection.query(
          `INSERT INTO cp_ubicaciones (id_factura, tipo, descripcion, domicilio, fecha_hora)
           VALUES (?, ?, ?, ?, ?)`,
          [id_factura, ubicacion.tipo, ubicacion.descripcion, ubicacion.domicilio, ubicacion.fecha_hora || null]
        );
      }
    }

    await connection.commit();

    // Si es borrador, retornar sin timbrar ni generar XML/PDF
    if (esBorradorCrear) {
      connection.release();
      return { id_factura, estatus: 'borrador', mensaje: 'Borrador guardado exitosamente' };
    }

    // ----- Generar y subir XML / PDF a Appwrite (o Facturama) -----
    let xml_fileId_final = null;
    let pdf_fileId_final = null;

    try {
      if (process.env.USE_FACTURAMA === 'true') {
        // 1. Preparar datos para Facturama
        const facturamaData = {
            Folio: folio,
            ExpeditionPlace: data.lugar_expedicion || "78140", // CP de prueba o del emisor
            PaymentConditions: "CREDITO",
            CfdiType: "I",
            PaymentForm: data.forma_pago || "99",
            PaymentMethod: data.metodo_pago || "PPD",
            Receiver: {
                Rfc: rfc_cliente,
                Name: cliente,
                CfdiUse: data.uso_cfdi_cliente || "S01",
                FiscalRegime: data.regimen_fiscal_cliente || "616",
                TaxZipCode: data.cp_cliente || "78140"
            },
            Items: conceptos.map(c => {
                const importe = parseFloat(c.importe || 0);
                const iva = c.iva !== undefined ? c.iva / 100 : 0.16;
                const ieps = c.ieps !== undefined ? c.ieps / 100 : 0;
                const retencionISR = c.retencion_isr !== undefined ? c.retencion_isr / 100 : 0;
                const retencionIVA = c.retencion_iva !== undefined ? c.retencion_iva / 100 : 0;
                
                const taxes = [];
                
                // IVA trasladado
                if (iva > 0) {
                    taxes.push({
                        Total: importe * iva,
                        Name: "IVA",
                        Base: importe,
                        Rate: iva,
                        IsRetention: false
                    });
                }
                
                // IEPS trasladado
                if (ieps > 0) {
                    taxes.push({
                        Total: importe * ieps,
                        Name: "IEPS",
                        Base: importe,
                        Rate: ieps,
                        IsRetention: false
                    });
                }
                
                // Retención ISR
                if (retencionISR > 0) {
                    taxes.push({
                        Total: importe * retencionISR,
                        Name: "ISR",
                        Base: importe,
                        Rate: retencionISR,
                        IsRetention: true
                    });
                }
                
                // Retención IVA
                if (retencionIVA > 0) {
                    taxes.push({
                        Total: importe * retencionIVA,
                        Name: "IVA",
                        Base: importe,
                        Rate: retencionIVA,
                        IsRetention: true
                    });
                }
                
                // Si no hay impuestos, agregar IVA por defecto
                if (taxes.length === 0) {
                    taxes.push({
                        Total: importe * 0.16,
                        Name: "IVA",
                        Base: importe,
                        Rate: 0.16,
                        IsRetention: false
                    });
                }
                
                const totalImpuestosTrasladados = taxes.filter(t => !t.IsRetention).reduce((sum, t) => sum + t.Total, 0);
                const totalImpuestosRetenidos = taxes.filter(t => t.IsRetention).reduce((sum, t) => sum + t.Total, 0);
                const total = importe + totalImpuestosTrasladados - totalImpuestosRetenidos;
                
                return {
                    ProductCode: c.clave_sat || "01010101",
                    IdentificationNumber: c.id_producto ? c.id_producto.toString() : "GENERICO",
                    Description: c.descripcion,
                    Unit: "Pieza",
                    UnitCode: c.unidad_sat || "H87",
                    UnitPrice: parseFloat(c.precio_unitario),
                    Quantity: parseFloat(c.cantidad),
                    Subtotal: importe,
                    Taxes: taxes,
                    Total: total
                };
            })
        };

        // 2. Crear factura en Facturama
        const facturamaResponse = await facturamaService.createInvoice(facturamaData);
        const facturamaId = facturamaResponse.Id;

        // 3. Descargar archivos
        const xmlContent = await facturamaService.downloadXML(facturamaId);
        const pdfBuffer = await facturamaService.downloadPDF(facturamaId);

        // 4. Subir a Appwrite
        const xmlBuffer = Buffer.from(xmlContent, 'utf8');
        xml_fileId_final = await uploadFileFromBuffer(xmlBuffer, `factura_${folio}.xml`, 'application/xml');
        pdf_fileId_final = await uploadFileFromBuffer(pdfBuffer, `factura_${folio}.pdf`, 'application/pdf');

      } else {
        // Simulación local
        const facturaData = { 
          folio, 
          cliente, 
          rfc_cliente, 
          total,
          conceptos: conceptos || [],
          regimen_fiscal_cliente: data.regimen_fiscal_cliente,
          uso_cfdi_cliente: data.uso_cfdi_cliente,
          cp_cliente: data.cp_cliente,
          forma_pago: data.forma_pago,
          metodo_pago: data.metodo_pago,
          lugar_expedicion: data.lugar_expedicion
        };
        // Obtener datos de la empresa
        const empresaData = await obtenerDatosEmpresa(id_empresa);
        const xmlContent = await generarXMLSimulado(facturaData, id_factura, empresaData);

        // Subir XML a Appwrite
        const xmlBuffer = Buffer.from(xmlContent, 'utf8');
        const xmlFilename = `factura_${id_factura}.xml`;
        xml_fileId_final = await uploadFileFromBuffer(xmlBuffer, xmlFilename, 'application/xml');

        // Generar PDF con logo (si existe) y subirlo
        const pdfBuffer = await generarPDFConLogo(id_factura, id_empresa);
        const pdfFilename = `factura_${id_factura}.pdf`;
        pdf_fileId_final = await uploadFileFromBuffer(pdfBuffer, pdfFilename, 'application/pdf');
      }

      // Actualizar factura con los fileIds reales y cambiar estatus a timbrada
      await pool.query(
        'UPDATE facturas SET xml_fileId = ?, pdf_fileId = ?, estatus = ? WHERE id_factura = ?',
        [xml_fileId_final, pdf_fileId_final, 'timbrada', id_factura]
      );

      return { id_factura, xml_fileId: xml_fileId_final, pdf_fileId: pdf_fileId_final };

    } catch (uploadError) {
      // Si falla la subida o timbrado, eliminar la factura de la BD para permitir reintento
      console.error('Error en proceso post-guardado (Timbrado/Appwrite):', uploadError);
      await pool.query('DELETE FROM facturas WHERE id_factura = ?', [id_factura]);
      // También eliminar detalles en cascada si la BD no lo hace automáticamente
      await pool.query('DELETE FROM conceptos_factura WHERE id_factura = ?', [id_factura]);
      await pool.query('DELETE FROM cp_autotransporte WHERE id_factura = ?', [id_factura]);
      await pool.query('DELETE FROM cp_mercancias WHERE id_factura = ?', [id_factura]);
      await pool.query('DELETE FROM cp_ubicaciones WHERE id_factura = ?', [id_factura]);
      
      throw new Error('Error al procesar archivos o timbrar: ' + uploadError.message + '. La factura no se guardó.');
    }

  } catch (error) {
    await connection.rollback();

    // Manejar folio duplicado de forma más clara
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw new Error('El folio de la factura ya existe. Genera un nuevo folio e inténtalo de nuevo.');
    }

    throw error;
  } finally {
    connection.release();
  }
}

// Función simulada para generar XML
async function generarXMLSimulado(facturaData, id_factura, empresaData) {
  const fecha = new Date().toISOString().slice(0, 19);
  const uuid = generarUUIDSimulado();
  const sello = generarSelloSimulado();
  const certificado = generarCertificadoSimulado();
  const subtotal = facturaData.conceptos.reduce((acc, c) => acc + Number(c.importe || 0), 0);
  const total = Number(facturaData.total);
  const iva = total - subtotal;

  // Usar datos de la empresa si se proporcionan, sino usar valores por defecto
  const rfcEmisor = empresaData?.rfc || facturaData.rfc_emisor || 'XAXX010101000';
  const nombreEmisor = empresaData?.razon_social || facturaData.nombre_emisor || 'EMPRESA NO REGISTRADA';
  const regimenFiscal = empresaData?.regimen_fiscal || facturaData.regimen_fiscal || '601';
  const lugarExpedicion = facturaData.lugar_expedicion || '78000';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" 
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd"
                  Version="4.0"
                  Serie="A"
                  Folio="${facturaData.folio || id_factura}"
                  Fecha="${fecha}"
                  Sello="${sello}"
                  FormaPago="${facturaData.forma_pago || '99'}"
                  NoCertificado="00001000000500000000"
                  Certificado="${certificado}"
                  SubTotal="${subtotal.toFixed(2)}"
                  Moneda="MXN"
                  Total="${total.toFixed(2)}"
                  TipoDeComprobante="I"
                  Exportacion="01"
                  MetodoPago="${facturaData.metodo_pago || 'PUE'}"
                  LugarExpedicion="${lugarExpedicion}">
  <cfdi:Emisor Rfc="${rfcEmisor}" Nombre="${nombreEmisor}" RegimenFiscal="${regimenFiscal}"/>
  <cfdi:Receptor Rfc="${facturaData.rfc_cliente || 'XAXX010101000'}" 
                 Nombre="${facturaData.cliente || 'PUBLICO EN GENERAL'}" 
                 DomicilioFiscalReceptor="${facturaData.cp_cliente || '78000'}"
                 RegimenFiscalReceptor="${facturaData.regimen_fiscal_cliente || '616'}"
                 UsoCFDI="${facturaData.uso_cfdi_cliente || 'S01'}"/>
  <cfdi:Conceptos>`;

  // Calcular totales de impuestos
  let totalIVA = 0;
  let totalIEPS = 0;
  let totalRetencionISR = 0;
  let totalRetencionIVA = 0;

  if (facturaData.conceptos) {
    facturaData.conceptos.forEach(c => {
      const importe = Number(c.importe || 0);
      const importeStr = importe.toFixed(2);
      const valorUnitario = Number(c.precio_unitario || 0).toFixed(2);
      const iva = c.iva !== undefined ? c.iva / 100 : 0.16;
      const ieps = c.ieps !== undefined ? c.ieps / 100 : 0;
      const retencionISR = c.retencion_isr !== undefined ? c.retencion_isr / 100 : 0;
      const retencionIVA = c.retencion_iva !== undefined ? c.retencion_iva / 100 : 0;
      
      const ivaImporte = importe * iva;
      const iepsImporte = importe * ieps;
      const retISRImporte = importe * retencionISR;
      const retIVAImporte = importe * retencionIVA;
      
      totalIVA += ivaImporte;
      totalIEPS += iepsImporte;
      totalRetencionISR += retISRImporte;
      totalRetencionIVA += retIVAImporte;
      
      xml += `
    <cfdi:Concepto ClaveProdServ="${c.clave_sat || '01010101'}" 
                   Cantidad="${c.cantidad}" 
                   ClaveUnidad="${c.unidad_sat || 'H87'}" 
                   Descripcion="${c.descripcion}" 
                   ValorUnitario="${valorUnitario}" 
                   Importe="${importeStr}" 
                   ObjetoImp="${c.objeto_imp || '02'}">
      <cfdi:Impuestos>`;
      
      // Traslados (IVA e IEPS)
      if (iva > 0 || ieps > 0) {
        xml += `
        <cfdi:Traslados>`;
        if (iva > 0) {
          xml += `
          <cfdi:Traslado Base="${importeStr}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="${iva.toFixed(6)}" Importe="${ivaImporte.toFixed(2)}"/>`;
        }
        if (ieps > 0) {
          xml += `
          <cfdi:Traslado Base="${importeStr}" Impuesto="003" TipoFactor="Tasa" TasaOCuota="${ieps.toFixed(6)}" Importe="${iepsImporte.toFixed(2)}"/>`;
        }
        xml += `
        </cfdi:Traslados>`;
      }
      
      // Retenciones (ISR e IVA)
      if (retencionISR > 0 || retencionIVA > 0) {
        xml += `
        <cfdi:Retenciones>`;
        if (retencionISR > 0) {
          xml += `
          <cfdi:Retencion Base="${importeStr}" Impuesto="001" TipoFactor="Tasa" TasaOCuota="${retencionISR.toFixed(6)}" Importe="${retISRImporte.toFixed(2)}"/>`;
        }
        if (retencionIVA > 0) {
          xml += `
          <cfdi:Retencion Base="${importeStr}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="${retencionIVA.toFixed(6)}" Importe="${retIVAImporte.toFixed(2)}"/>`;
        }
        xml += `
        </cfdi:Retenciones>`;
      }
      
      xml += `
      </cfdi:Impuestos>
    </cfdi:Concepto>`;
    });
  }

  const totalImpuestosTrasladados = totalIVA + totalIEPS;
  const totalImpuestosRetenidos = totalRetencionISR + totalRetencionIVA;

  xml += `
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="${totalImpuestosTrasladados.toFixed(2)}" TotalImpuestosRetenidos="${totalImpuestosRetenidos.toFixed(2)}">`;
  
  if (totalIVA > 0 || totalIEPS > 0) {
    xml += `
    <cfdi:Traslados>`;
    if (totalIVA > 0) {
      xml += `
      <cfdi:Traslado Base="${subtotal.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${totalIVA.toFixed(2)}"/>`;
    }
    if (totalIEPS > 0) {
      xml += `
      <cfdi:Traslado Base="${subtotal.toFixed(2)}" Impuesto="003" TipoFactor="Tasa" TasaOCuota="0.000000" Importe="${totalIEPS.toFixed(2)}"/>`;
    }
    xml += `
    </cfdi:Traslados>`;
  }
  
  if (totalRetencionISR > 0 || totalRetencionIVA > 0) {
    xml += `
    <cfdi:Retenciones>`;
    if (totalRetencionISR > 0) {
      xml += `
      <cfdi:Retencion Base="${subtotal.toFixed(2)}" Impuesto="001" TipoFactor="Tasa" TasaOCuota="0.000000" Importe="${totalRetencionISR.toFixed(2)}"/>`;
    }
    if (totalRetencionIVA > 0) {
      xml += `
      <cfdi:Retencion Base="${subtotal.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.000000" Importe="${totalRetencionIVA.toFixed(2)}"/>`;
    }
    xml += `
    </cfdi:Retenciones>`;
  }
  
  xml += `
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
                             xsi:schemaLocation="http://www.sat.gob.mx/TimbreFiscalDigital http://www.sat.gob.mx/sitio_internet/cfd/TimbreFiscalDigital/TimbreFiscalDigitalv11.xsd"
                             Version="1.1"
                             UUID="${uuid}"
                             FechaTimbrado="${fecha}"
                             RfcProvCertif="SAT970701NN3"
                             SelloCFD="${sello}"
                             NoCertificadoSAT="00001000000504465028"
                             SelloSAT="${generarSelloSimulado()}"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

  return xml;
}

function generarUUIDSimulado() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function generarSelloSimulado() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let sello = '';
  for (let i = 0; i < 344; i++) {
    sello += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return sello + '=';
}

function generarCertificadoSimulado() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let cert = '';
  for (let i = 0; i < 2000; i++) {
    cert += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return cert;
}

async function listarFacturasEmpresa(id_empresa) {
  let query = 'SELECT * FROM facturas';
  let params = [];
  
  // Si id_empresa es null o undefined, obtener todas las facturas (para superadmin)
  if (id_empresa !== null && id_empresa !== undefined) {
    query += ' WHERE id_empresa = ?';
    params.push(id_empresa);
  }
  
  query += ' ORDER BY fecha_emision DESC';
  
  const [rows] = await pool.query(query, params);
  return rows;
}

async function obtenerFactura(id) {
  const [factura] = await pool.query('SELECT * FROM facturas WHERE id_factura = ?', [id]);
  if (factura.length === 0) throw new Error('Factura no encontrada');

  const facturaData = factura[0];

  // Obtener conceptos
  const [conceptos] = await pool.query(
    'SELECT * FROM conceptos_factura WHERE id_factura = ?',
    [id]
  );

  // Obtener autotransporte
  const [autotransporte] = await pool.query(
    'SELECT * FROM cp_autotransporte WHERE id_factura = ?',
    [id]
  );

  // Obtener mercancías
  const [mercancias] = await pool.query(
    'SELECT * FROM cp_mercancias WHERE id_factura = ?',
    [id]
  );

  // Obtener ubicaciones
  const [ubicaciones] = await pool.query(
    'SELECT * FROM cp_ubicaciones WHERE id_factura = ? ORDER BY fecha_hora',
    [id]
  );

  return {
    ...facturaData,
    conceptos,
    autotransporte: autotransporte[0] || null,
    mercancias,
    ubicaciones
  };
}

async function actualizarFactura(id_factura, data) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { folio, cliente, rfc_cliente, total, estatus, xml_fileId, pdf_fileId, conceptos, autotransporte, mercancias, ubicaciones } = data;
    
    // Verificar si es borrador
    const esBorradorActualizar = estatus === 'borrador' || estatus === 'pendiente';

    // Actualizar factura (construcción dinámica de query)
    let updateFields = [];
    let updateParams = [];

    if (folio !== undefined) { updateFields.push('folio=?'); updateParams.push(folio); }
    if (cliente !== undefined) { updateFields.push('cliente=?'); updateParams.push(cliente); }
    if (rfc_cliente !== undefined) { updateFields.push('rfc_cliente=?'); updateParams.push(rfc_cliente); }
    if (total !== undefined) { updateFields.push('total=?'); updateParams.push(total); }
    if (estatus !== undefined) { updateFields.push('estatus=?'); updateParams.push(estatus); }
    if (xml_fileId !== undefined) { updateFields.push('xml_fileId=?'); updateParams.push(xml_fileId); }
    if (pdf_fileId !== undefined) { updateFields.push('pdf_fileId=?'); updateParams.push(pdf_fileId); }

    if (updateFields.length > 0) {
      const updateQuery = `UPDATE facturas SET ${updateFields.join(', ')} WHERE id_factura=?`;
      updateParams.push(id_factura);
      await connection.query(updateQuery, updateParams);
    }

    // Eliminar y recrear conceptos
    if (conceptos !== undefined) {
      await connection.query('DELETE FROM conceptos_factura WHERE id_factura = ?', [id_factura]);
      if (Array.isArray(conceptos)) {
        for (const concepto of conceptos) {
          await connection.query(
            `INSERT INTO conceptos_factura (id_factura, id_producto, descripcion, cantidad, precio_unitario, importe)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id_factura, concepto.id_producto || null, concepto.descripcion, concepto.cantidad, concepto.precio_unitario, concepto.importe]
          );
        }
      }
    }

    // Actualizar autotransporte
    if (autotransporte !== undefined) {
      await connection.query('DELETE FROM cp_autotransporte WHERE id_factura = ?', [id_factura]);
      if (autotransporte) {
        await connection.query(
          `INSERT INTO cp_autotransporte (id_factura, id_vehiculo, id_operador)
           VALUES (?, ?, ?)`,
          [id_factura, autotransporte.id_vehiculo, autotransporte.id_operador]
        );
      }
    }

    // Actualizar mercancías
    if (mercancias !== undefined) {
      await connection.query('DELETE FROM cp_mercancias WHERE id_factura = ?', [id_factura]);
      if (Array.isArray(mercancias)) {
        for (const mercancia of mercancias) {
          await connection.query(
            `INSERT INTO cp_mercancias (id_factura, descripcion, peso_kg, valor_mercancia)
             VALUES (?, ?, ?, ?)`,
            [id_factura, mercancia.descripcion, mercancia.peso_kg, mercancia.valor_mercancia]
          );
        }
      }
    }

    // Actualizar ubicaciones
    if (ubicaciones !== undefined) {
      await connection.query('DELETE FROM cp_ubicaciones WHERE id_factura = ?', [id_factura]);
      if (Array.isArray(ubicaciones)) {
        for (const ubicacion of ubicaciones) {
          // Formatear fecha_hora para MySQL (YYYY-MM-DD HH:mm:ss)
          let fechaHoraFormatted = null;
          if (ubicacion.fecha_hora) {
            fechaHoraFormatted = new Date(ubicacion.fecha_hora).toISOString().slice(0, 19).replace('T', ' ');
          }

          await connection.query(
            `INSERT INTO cp_ubicaciones (id_factura, tipo, descripcion, domicilio, fecha_hora)
             VALUES (?, ?, ?, ?, ?)`,
            [id_factura, ubicacion.tipo, ubicacion.descripcion, ubicacion.domicilio, fechaHoraFormatted]
          );
        }
      }
    }

    await connection.commit();

    // Si es borrador, retornar sin timbrar ni generar XML/PDF
    if (esBorradorActualizar) {
      connection.release();
      return { id_factura, estatus: 'borrador', mensaje: 'Borrador actualizado exitosamente' };
    }

    // ----- Regenerar y subir XML / PDF a Appwrite (o Facturama) -----
    // Obtener datos actualizados de la factura
    const facturaActualizada = await obtenerFactura(id_factura);
    const { id_empresa, folio: folioFinal } = facturaActualizada;

    let xml_fileId_final = null;
    let pdf_fileId_final = null;

    try {
      if (process.env.USE_FACTURAMA === 'true') {
        // Nota: La actualización en Facturama es compleja (requiere cancelar y re-crear o editar si es borrador).
        // Por simplicidad en esta simulación, asumiremos que si se edita, se regeneran los archivos locales o se crea uno nuevo en Facturama si fuera necesario.
        // Aquí implementaremos la lógica de simulación local para asegurar que los archivos se actualicen.
        
        // Si se quisiera implementar Facturama real:
        // 1. Cancelar factura anterior en Facturama (si estaba timbrada)
        // 2. Crear nueva factura
        // 3. Actualizar archivos
        console.warn('Edición con Facturama activo: Se regenerarán archivos locales por seguridad.');
      }

      // Simulación local (siempre regenerar archivos al editar para reflejar cambios)
      const empresaData = await obtenerDatosEmpresa(facturaActualizada.id_empresa || id_empresa);
      const xmlContent = await generarXMLSimulado(facturaActualizada, id_factura, empresaData);

      // Subir XML a Appwrite
      const xmlBuffer = Buffer.from(xmlContent, 'utf8');
      const xmlFilename = `factura_${id_factura}.xml`;
      xml_fileId_final = await uploadFileFromBuffer(xmlBuffer, xmlFilename, 'application/xml');

      // Generar PDF con logo (si existe) y subirlo
      const pdfBuffer = await generarPDFConLogo(id_factura, id_empresa);
      const pdfFilename = `factura_${id_factura}.pdf`;
      pdf_fileId_final = await uploadFileFromBuffer(pdfBuffer, pdfFilename, 'application/pdf');
      

      // Actualizar factura con los nuevos fileIds
      await pool.query(
        'UPDATE facturas SET xml_fileId = ?, pdf_fileId = ? WHERE id_factura = ?',
        [xml_fileId_final, pdf_fileId_final, id_factura]
      );

    } catch (uploadError) {
      console.error('Error al regenerar archivos tras actualización:', uploadError);
      // No lanzamos error para no revertir los cambios de datos, pero avisamos
    }

    return { ok: true, xml_fileId: xml_fileId_final, pdf_fileId: pdf_fileId_final };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function eliminarFactura(id_factura) {
  const [result] = await pool.query('DELETE FROM facturas WHERE id_factura = ?', [id_factura]);
  if (result.affectedRows === 0) throw new Error('Factura no encontrada');
  return { ok: true };
}

async function cancelarFactura(id_factura, motivo, folio_sustitucion) {
  // Verificar que la factura existe y está timbrada
  const [facturaRows] = await pool.query(
    'SELECT estatus, folio FROM facturas WHERE id_factura = ?',
    [id_factura]
  );
  
  if (facturaRows.length === 0) {
    throw new Error('Factura no encontrada');
  }
  
  const factura = facturaRows[0];
  
  if (factura.estatus === 'cancelada') {
    throw new Error('La factura ya está cancelada');
  }
  
  if (factura.estatus !== 'timbrada' && factura.estatus !== 'validada') {
    throw new Error('Solo se pueden cancelar facturas timbradas o validadas');
  }
  
  if (!motivo || motivo.trim().length === 0) {
    throw new Error('El motivo de cancelación es requerido');
  }
  
  // Actualizar factura a cancelada
  const [result] = await pool.query(
    `UPDATE facturas 
     SET estatus = 'cancelada', 
         motivo_cancelacion = ?, 
         folio_sustitucion = ?,
         fecha_cancelacion = NOW()
     WHERE id_factura = ?`,
    [motivo.trim(), folio_sustitucion || null, id_factura]
  );
  
  if (result.affectedRows === 0) {
    throw new Error('Error al cancelar la factura');
  }
  
  console.log(`Factura ${factura.folio} cancelada. Motivo: ${motivo}`);
  
  return { 
    ok: true, 
    mensaje: 'Factura cancelada exitosamente',
    folio: factura.folio,
    estatus: 'cancelada'
  };
}

async function enviarFacturaPorEmail(id_factura, email_cliente, enviar_automatico = false) {
  const emailService = require('./email.service');
  
  // Obtener datos de la factura
  const factura = await obtenerFactura(id_factura);
  
  if (!factura) {
    throw new Error('Factura no encontrada');
  }
  
  // Si no se proporciona email, intentar obtenerlo del cliente
  if (!email_cliente) {
    // Aquí podrías buscar el email del cliente desde la tabla de clientes
    // Por ahora, si no se proporciona, lanzar error
    throw new Error('El email del cliente es requerido para enviar la factura');
  }
  
  // Validar formato de email básico
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email_cliente)) {
    throw new Error('El email proporcionado no es válido');
  }
  
  // Obtener PDF y XML
  let pdfBuffer, xmlContent;
  
  try {
    const pdfData = await obtenerPDF(id_factura);
    pdfBuffer = pdfData.content;
    
    xmlContent = await obtenerXML(id_factura);
    if (Buffer.isBuffer(xmlContent)) {
      xmlContent = xmlContent.toString('utf8');
    }
  } catch (error) {
    throw new Error(`Error al generar archivos de la factura: ${error.message}`);
  }
  
  // Preparar datos para el email
  const datosFactura = {
    folio: factura.folio || `F-${id_factura}`,
    cliente: factura.cliente || 'Cliente',
    total: factura.total || 0,
    fecha: factura.fecha_emision ? new Date(factura.fecha_emision).toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX')
  };
  
  // Enviar email
  try {
    const emailResult = await emailService.enviarFacturaPorEmail(
      email_cliente,
      datosFactura,
      pdfBuffer,
      xmlContent
    );
    
    if (!emailResult) {
      throw new Error('No se pudo enviar el correo electrónico. Verifique la configuración SMTP.');
    }
    
    // Si se envía automáticamente y hay flag en la factura, actualizar
    if (enviar_automatico) {
      await pool.query(
        'UPDATE facturas SET email_enviado = 1, fecha_envio_email = NOW() WHERE id_factura = ?',
        [id_factura]
      );
    }
    
    return {
      ok: true,
      mensaje: 'Factura enviada por correo electrónico exitosamente',
      email: email_cliente,
      messageId: emailResult.messageId
    };
  } catch (error) {
    console.error('Error enviando factura por email:', error);
    throw new Error(`Error al enviar el correo: ${error.message}`);
  }
}

async function obtenerXML(id_factura) {
  const factura = await obtenerFactura(id_factura);
  
  // Intentar descargar el XML real desde Appwrite si existe
  if (factura.xml_fileId) {
    try {
      const buffer = await downloadFileToBuffer(factura.xml_fileId);
      return buffer;
    } catch (e) {
      console.warn('No se pudo descargar XML de Appwrite, generando simulado:', e.message);
    }
  }

  // Fallback: Generar XML simulado
  const empresaData = await obtenerDatosEmpresa(factura.id_empresa);
  return await generarXMLSimulado(factura, id_factura, empresaData);
}

async function obtenerPDF(id_factura) {
  // Intentar descargar el PDF real desde Appwrite si existe
  const [rows] = await pool.query('SELECT pdf_fileId, id_empresa, folio FROM facturas WHERE id_factura = ?', [id_factura]);
  if (rows.length === 0) throw new Error('Factura no encontrada');

  const facturaRow = rows[0];

  if (facturaRow.pdf_fileId) {
    const buffer = await downloadFileToBuffer(facturaRow.pdf_fileId);
    return {
      content: buffer,
      filename: `Factura_${facturaRow.folio || id_factura}.pdf`
    };
  }

  // Si no hay PDF en Appwrite, generar uno simple en memoria
  const buffer = await generarPDFConLogo(id_factura, facturaRow.id_empresa);
  return {
    content: buffer,
    filename: `Factura_${facturaRow.folio || id_factura}.pdf`
  };
}
async function obtenertodasLasFacturas() {
  const [rows] = await pool.query('SELECT * FROM facturas');
  return rows;
}

async function obtenerDatosEmpresa(id_empresa) {
  const [rows] = await pool.query(
    'SELECT razon_social, rfc, regimen_fiscal, direccion_fiscal FROM empresas WHERE id_empresa = ?',
    [id_empresa]
  );
  
  if (rows.length === 0) {
    throw new Error(`Empresa con id ${id_empresa} no encontrada`);
  }
  
  return rows[0];
}

async function obtenerLogoEmpresaBuffer(id_empresa) {
  // Buscar último logo de la empresa
  // Ordenamos por fecha_subida DESC para obtener el más reciente
  // Si hay múltiples (no debería, pero por seguridad), tomamos el más reciente
  const [rows] = await pool.query(
    `SELECT file_id, extension, nombre_storage, fecha_subida
     FROM documentos_empresa 
     WHERE id_empresa = ? AND tipo_documento = 'logo'
     ORDER BY fecha_subida DESC, id_documento DESC
     LIMIT 1`,
    [id_empresa]
  );

  if (rows.length === 0) {
    console.log(`❌ No se encontró logo para empresa ${id_empresa} en la base de datos`);
    return null;
  }

  const { file_id, extension, nombre_storage } = rows[0];
  console.log(`🔍 Intentando descargar logo para empresa ${id_empresa}:`, {
    file_id,
    extension,
    nombre_storage
  });
  
  // El bucket de documentos es el mismo que usa el frontend (donde se suben los logos)
  // Debe ser el mismo valor que appwriteConfig.bucketId en el frontend: '68cc453a00073b471c2d'
  const documentosBucket = process.env.APPWRITE_BUCKET_ID || process.env.APPWRITE_BUCKET || process.env.APPWRITE_BUCKET_DOCUMENTOS;
  const facturasBucket = process.env.APPWRITE_BUCKET_FACTURAS || documentosBucket;
  
  console.log(`📦 Buckets configurados:`, {
    documentosBucket: documentosBucket || 'NO CONFIGURADO',
    facturasBucket: facturasBucket || 'NO CONFIGURADO',
    'APPWRITE_BUCKET_ID': process.env.APPWRITE_BUCKET_ID || 'NO CONFIGURADO',
    'APPWRITE_BUCKET': process.env.APPWRITE_BUCKET || 'NO CONFIGURADO',
    'APPWRITE_BUCKET_FACTURAS': process.env.APPWRITE_BUCKET_FACTURAS || 'NO CONFIGURADO'
  });
  
  if (!documentosBucket) {
    console.error(`❌ ERROR: APPWRITE_BUCKET_ID o APPWRITE_BUCKET no está configurado en el .env`);
    console.error(`   Debe ser el mismo bucket que usa el frontend: 68cc453a00073b471c2d`);
    return null;
  }
  
  // Intentar descargar del bucket de documentos primero (donde se suben los logos)
  // Si falla, intentar con el bucket de facturas como fallback (por si están en el mismo bucket)
  const bucketsAIntentar = facturasBucket && facturasBucket !== documentosBucket 
    ? [documentosBucket, facturasBucket] 
    : [documentosBucket];
  
  for (const bucket of bucketsAIntentar) {
    if (!bucket) continue;
    
    try {
      console.log(`⬇️ Intentando descargar logo desde bucket: ${bucket}`);
      const buffer = await downloadFileToBuffer(file_id, bucket);
      
      if (!buffer || buffer.length === 0) {
        throw new Error('El buffer del logo está vacío después de descargar');
      }
      
      console.log(`✅ Logo descargado exitosamente desde bucket ${bucket}, tamaño: ${buffer.length} bytes`);
      return { buffer, extension };
      
    } catch (e) {
      console.warn(`⚠️ Error al descargar logo desde bucket ${bucket}:`, e.message);
      // Continuar con el siguiente bucket si hay más
      if (bucket !== bucketsAIntentar[bucketsAIntentar.length - 1]) {
        console.log(`🔄 Intentando con siguiente bucket...`);
        continue;
      } else {
        // Si era el último bucket, lanzar el error
        console.error(`❌ Error al descargar logo desde Appwrite para empresa ${id_empresa} desde todos los buckets:`, e.message);
        console.error('Detalles:', { file_id, extension, bucketsIntentados: bucketsAIntentar, error: e.stack });
      }
    }
  }
  
  return null;
}

async function generarPDFConLogo(id_factura, id_empresa) {
  const factura = await obtenerFactura(id_factura);
  const empresaData = await obtenerDatosEmpresa(id_empresa);
  const logoData = await obtenerLogoEmpresaBuffer(id_empresa);

  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    // Usar datos reales de la empresa
    const rfcEmisor = empresaData.rfc || 'XAXX010101000';
    const nombreEmisor = empresaData.razon_social || 'EMPRESA NO REGISTRADA';
    const regimenFiscal = empresaData.regimen_fiscal || '601';
    const lugarExpedicion = factura.lugar_expedicion || '78000';

    // Generar QR con datos reales
    const selloSimulado = generarSelloSimulado();
    const qrData = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${factura.folio}&re=${rfcEmisor}&rr=${factura.rfc_cliente}&tt=${factura.total}&fe=${selloSimulado.substring(336)}`;
    const qrBuffer = await QRCode.toBuffer(qrData);

    // Encabezado con logo
    let logoX = 40;
    let logoY = 40;
    let logoWidth = 100;
    let textoX = 160;
    let logoInsertado = false;

    if (logoData && logoData.buffer && logoData.buffer.length > 0) {
      try {
        // Validar que el buffer tenga contenido
        if (!Buffer.isBuffer(logoData.buffer)) {
          throw new Error('El logo no es un buffer válido');
        }

        // Validar que el buffer sea realmente una imagen (verificar magic numbers)
        const firstBytes = logoData.buffer.slice(0, 4);
        const hexSignature = firstBytes.toString('hex').toUpperCase();
        const isPNG = hexSignature === '89504E47'; // PNG: 89 50 4E 47
        const isJPEG = hexSignature.substring(0, 4) === 'FFD8FF'; // JPEG: FF D8 FF
        const extension = (logoData.extension || '').toLowerCase();

        console.log(`Intentando insertar logo para empresa ${id_empresa}:`, {
          extension: extension,
          bufferSize: logoData.buffer.length,
          hexSignature: hexSignature,
          isPNG: isPNG,
          isJPEG: isJPEG
        });

        if (!isPNG && !isJPEG && (extension !== 'png' && extension !== 'jpg' && extension !== 'jpeg')) {
          throw new Error(`El archivo no parece ser una imagen válida (PNG/JPEG). Signature: ${hexSignature}, Extension: ${extension}`);
        }

        // PDFKit puede aceptar buffers directamente
        // Intentar insertar el logo con fit para mantener proporción
        doc.image(logoData.buffer, logoX, logoY, {
          fit: [logoWidth, logoWidth * 0.75], // Ancho, alto máximo
          align: 'left'
        });
        
        logoInsertado = true;
        console.log(`✓ Logo insertado correctamente en posición (${logoX}, ${logoY}) con tamaño ${logoWidth}x${logoWidth * 0.75}`);
      } catch (e) { 
        console.error(`✗ Error al insertar logo en PDF para empresa ${id_empresa}:`, e.message);
        console.error('Stack:', e.stack);
        // Si falla, continuar sin logo y ajustar posición del texto
        textoX = 40;
        logoInsertado = false;
      }
    } else {
      // Si no hay logo, empezar el texto más a la izquierda
      if (!logoData) {
        console.log(`No se encontró logo para empresa ${id_empresa}`);
      } else if (!logoData.buffer || logoData.buffer.length === 0) {
        console.log(`El buffer del logo está vacío para empresa ${id_empresa}`);
      }
      textoX = 40;
    }

    // Datos Emisor (usando datos reales de la empresa)
    doc.fontSize(12).font('Helvetica-Bold').text(nombreEmisor, textoX, 40);
    doc.fontSize(9).font('Helvetica').text(`RFC: ${rfcEmisor}`, textoX, 55);
    doc.text(`Régimen Fiscal: ${regimenFiscal}`, textoX, 68);
    doc.text(`Lugar de Expedición: ${lugarExpedicion}`, textoX, 81);

    // Datos Factura
    doc.fontSize(10).font('Helvetica-Bold').text('FACTURA', 400, 40, { align: 'right' });
    doc.fontSize(9).font('Helvetica');
    doc.text(`Folio: ${factura.folio || id_factura}`, 400, 55, { align: 'right' });
    doc.text(`Fecha: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`, 400, 68, { align: 'right' });
    doc.text(`Tipo de Comprobante: I - Ingreso`, 400, 81, { align: 'right' });
    doc.text(`Versión: 4.0`, 400, 94, { align: 'right' });

    doc.moveDown(3);

    // Datos Receptor
    const startY = 130;
    doc.rect(40, startY, 515, 60).stroke();
    doc.fontSize(9).font('Helvetica-Bold').text('DATOS DEL CLIENTE', 50, startY + 10);
    doc.font('Helvetica').text(`Nombre: ${factura.cliente}`, 50, startY + 25);
    doc.text(`RFC: ${factura.rfc_cliente}`, 50, startY + 38);
    doc.text(`Uso CFDI: ${factura.uso_cfdi_cliente || 'S01'}`, 300, startY + 25);
    doc.text(`Régimen Fiscal: ${factura.regimen_fiscal_cliente || '616'}`, 300, startY + 38);
    doc.text(`C.P.: ${factura.cp_cliente || '78000'}`, 450, startY + 25);

    doc.moveDown(4);

    // Tabla Conceptos
    const tableTop = 210;
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('ClaveProd', 40, tableTop);
    doc.text('Cant', 100, tableTop);
    doc.text('Unidad', 140, tableTop);
    doc.text('Descripción', 200, tableTop);
    doc.text('P. Unitario', 400, tableTop, { width: 60, align: 'right' });
    doc.text('Importe', 480, tableTop, { width: 60, align: 'right' });
    
    doc.moveTo(40, tableTop + 12).lineTo(555, tableTop + 12).stroke();

    let y = tableTop + 20;
    doc.font('Helvetica');
    
    const conceptos = factura.conceptos || [];
    conceptos.forEach((c) => {
      doc.text(c.clave_sat || '01010101', 40, y);
      doc.text(c.cantidad?.toString() || '1', 100, y);
      doc.text(c.unidad_sat || 'H87', 140, y);
      doc.text(c.descripcion || '', 200, y, { width: 190 });
      doc.text(Number(c.precio_unitario || 0).toFixed(2), 400, y, { width: 60, align: 'right' });
      doc.text(Number(c.importe || 0).toFixed(2), 480, y, { width: 60, align: 'right' });
      y += 20;
    });

    // Totales
    y += 20;
    const subtotal = conceptos.reduce((acc, c) => acc + Number(c.importe || 0), 0);
    const total = Number(factura.total || 0);
    const iva = total - subtotal;

    doc.font('Helvetica-Bold');
    doc.text('Subtotal:', 400, y, { width: 80, align: 'right' });
    doc.font('Helvetica').text(`$${subtotal.toFixed(2)}`, 480, y, { width: 60, align: 'right' });
    
    y += 15;
    doc.font('Helvetica-Bold').text('IVA (16%):', 400, y, { width: 80, align: 'right' });
    doc.font('Helvetica').text(`$${iva.toFixed(2)}`, 480, y, { width: 60, align: 'right' });

    y += 15;
    doc.font('Helvetica-Bold').text('Total:', 400, y, { width: 80, align: 'right' });
    doc.font('Helvetica').text(`$${total.toFixed(2)}`, 480, y, { width: 60, align: 'right' });

    // QR y Sellos
    y += 40;
    doc.image(qrBuffer, 40, y, { width: 100 });
    
    doc.fontSize(6).font('Helvetica');
    const selloX = 150;
    doc.text('Sello Digital del CFDI:', selloX, y);
    doc.font('Courier').text(generarSelloSimulado(), selloX, y + 10, { width: 390, align: 'justify' });
    
    y += 50;
    doc.font('Helvetica').text('Sello del SAT:', selloX, y);
    doc.font('Courier').text(generarSelloSimulado(), selloX, y + 10, { width: 390, align: 'justify' });

    y += 50;
    doc.font('Helvetica').text('Cadena Original del complemento de certificación digital del SAT:', selloX, y);
    doc.font('Courier').text(`||1.1|${generarUUIDSimulado()}|${new Date().toISOString()}|SAT970701NN3|${generarSelloSimulado()}|00001000000504465028||`, selloX, y + 10, { width: 390, align: 'justify' });

    doc.fontSize(8).font('Helvetica-Bold').text('Este documento es una representación impresa de un CFDI (Simulado)', 40, 750, { align: 'center', width: 515 });

    doc.end();
  });
}

module.exports = { 
  crearFactura, 
  listarFacturasEmpresa, 
  obtenerFactura, 
  actualizarFactura, 
  eliminarFactura,
  cancelarFactura,
  enviarFacturaPorEmail,
  obtenerXML,
  obtenerPDF,
  obtenertodasLasFacturas
};
