const empresasService = require('../services/empresas.service');

exports.listarEmpresas = async (req, res) => {
  try {
    const result = await empresasService.listarEmpresas(req.user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtenerEmpresa = async (req, res) => {
  try {
    const result = await empresasService.obtenerEmpresa(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

exports.actualizarEmpresa = async (req, res) => {
  try {
    const result = await empresasService.actualizarEmpresa(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.registrarEmpresa = async (req, res) => {
  try {
    console.log('Registrando empresa, body:', req.body);
    const result = await empresasService.registrarEmpresa(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.registrarEmpresaPublico = async (req, res) => {
  try {
    // Validar campos requeridos
    const { razon_social, rfc } = req.body;
    if (!razon_social || !rfc) {
      return res.status(400).json({ error: 'Razón social y RFC son requeridos' });
    }
    
    // Verificar si el RFC ya existe
    const pool = require('../config/db');
    const [existing] = await pool.query('SELECT id_empresa FROM empresas WHERE rfc = ?', [rfc]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'El RFC ya está registrado' });
    }
    
    const result = await empresasService.registrarEmpresa(req.body);
    res.status(201).json({ 
      ...result, 
      message: 'Empresa registrada exitosamente. Estará pendiente de aprobación.' 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Completar registro de empresa (para usuario admin existente)
exports.completarRegistroEmpresa = async (req, res) => {
  try {
    console.log('=== COMPLETAR REGISTRO EMPRESA CONTROLLER ===');
    console.log('User from token:', JSON.stringify(req.user, null, 2));
    console.log('Body recibido:', JSON.stringify(req.body, null, 2));
    
    const { razon_social, rfc } = req.body;
    if (!razon_social || !rfc) {
      return res.status(400).json({ error: 'Razón social y RFC son requeridos' });
    }
    
    // Verificar que req.user existe y tiene id_usuario
    if (!req.user) {
      console.error('Error: req.user es undefined o null');
      return res.status(401).json({ error: 'Usuario no autenticado correctamente' });
    }
    
    if (!req.user.id_usuario) {
      console.error('Error: req.user no tiene id_usuario. req.user completo:', JSON.stringify(req.user, null, 2));
      // Intentar con 'id' como alternativa (por si el token usa 'id' en lugar de 'id_usuario')
      if (req.user.id) {
        console.log('Intentando con req.user.id:', req.user.id);
        const result = await empresasService.completarRegistroEmpresa(req.user.id, req.body);
        return res.status(201).json(result);
      }
      return res.status(401).json({ error: 'Usuario no autenticado correctamente: id_usuario no encontrado en token' });
    }
    
    console.log('Usando id_usuario del token:', req.user.id_usuario);
    const result = await empresasService.completarRegistroEmpresa(req.user.id_usuario, req.body);
    res.status(201).json(result);
  } catch (err) {
    console.error('Error en completarRegistroEmpresa controller:', err);
    console.error('Stack trace:', err.stack);
    res.status(400).json({ error: err.message });
  }
};