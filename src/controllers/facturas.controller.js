const facturasService = require('../services/facturas.service');

exports.crearFactura = async (req, res) => {
  try {
    const result = await facturasService.crearFactura(req.user, req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.listarFacturasEmpresa = async (req, res) => {
  try {
    // Si es superadmin y no hay id_empresa en params, pasar null para obtener todas las facturas
    // Si no es superadmin, usar id_empresa del usuario
    let id_empresa = req.params.id_empresa;
    if (!id_empresa && req.user.rol === 'superadmin') {
      id_empresa = null; // Superadmin puede ver todas las facturas
    } else if (!id_empresa) {
      id_empresa = req.user.id_empresa;
    }
    const result = await facturasService.listarFacturasEmpresa(id_empresa);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtenerFactura = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await facturasService.obtenerFactura(id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

exports.actualizarFactura = async (req, res) => {
  try {
    const result = await facturasService.actualizarFactura(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.eliminarFactura = async (req, res) => {
  try {
    const result = await facturasService.eliminarFactura(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

exports.descargarXML = async (req, res) => {
  try {
    const id = req.params.id;
    const xmlContent = await facturasService.obtenerXML(id);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="factura_${id}.xml"`);
    res.send(xmlContent);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

exports.descargarPDF = async (req, res) => {
  try {
    const id = req.params.id;
    const pdfData = await facturasService.obtenerPDF(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfData.filename}"`);
    res.send(pdfData.content);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

// Validar factura con SAT (sandbox simulado)
exports.validarConSAT = async (req, res) => {
  try {
    const satValidationService = require('../services/sat-validation.service');
    const { facturaData, ambiente = 'sandbox' } = req.body;
    const resultado = await satValidationService.validarFacturaCompleta(facturaData, ambiente);
    res.json(resultado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Cancelar factura CFDI
exports.cancelarFactura = async (req, res) => {
  try {
    const { motivo, folio_sustitucion } = req.body;
    const result = await facturasService.cancelarFactura(req.params.id, motivo, folio_sustitucion);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Enviar factura por email al cliente
exports.enviarFacturaEmail = async (req, res) => {
  try {
    const { email_cliente, enviar_automatico } = req.body;
    const result = await facturasService.enviarFacturaPorEmail(req.params.id, email_cliente, enviar_automatico);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
