const cartasPorteService = require('../services/cartas-porte.service');

exports.listar = async (req, res) => {
  try {
    let id_empresa = req.params.id_empresa || req.user.id_empresa;
    
    // Si es superadmin y no hay id_empresa en params, permitir ver todas
    if (!id_empresa && req.user.rol === 'superadmin') {
      id_empresa = null;
    }
    
    // Si es transportista, filtrar por su id_usuario además de empresa
    const id_usuario = req.user.rol === 'transportista' ? req.user.id_usuario : null;
    
    const result = await cartasPorteService.listarCartasPorte(id_empresa, id_usuario);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtener = async (req, res) => {
  try {
    const result = await cartasPorteService.obtenerCartaPorte(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

exports.crear = async (req, res) => {
  try {
    const result = await cartasPorteService.crearCartaPorte(req.user, req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.actualizar = async (req, res) => {
  try {
    const result = await cartasPorteService.actualizarCartaPorte(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.eliminar = async (req, res) => {
  try {
    const result = await cartasPorteService.eliminarCartaPorte(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};
