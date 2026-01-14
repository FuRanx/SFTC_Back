const documentosService = require('../services/documentos.service');

exports.subirDocumento = async (req, res) => {
  try {
    const result = await documentosService.subirDocumento(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.listarDocumentosEmpresa = async (req, res) => {
  try {
    const id_empresa = req.params.id_empresa;
    const result = await documentosService.listarDocumentosEmpresa(id_empresa);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.validarDocumento = async (req, res) => {
  try {
    const id = req.params.id;
    const { validado, observaciones } = req.body;
    const result = await documentosService.validarDocumento(id, validado, observaciones);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.subirDocumentoPublico = async (req, res) => {
  try {
    // Validar que se proporcione id_empresa
    const { id_empresa } = req.body;
    if (!id_empresa) {
      return res.status(400).json({ error: 'id_empresa es requerido' });
    }
    
    // Verificar que la empresa existe
    const pool = require('../config/db');
    const [empresa] = await pool.query('SELECT id_empresa FROM empresas WHERE id_empresa = ?', [id_empresa]);
    if (empresa.length === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }
    
    const result = await documentosService.subirDocumento(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};