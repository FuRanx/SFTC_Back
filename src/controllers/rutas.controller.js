const rutasService = require('../services/rutas.service');

exports.listarRutas = async (req, res) => {
  try {
    const id_empresa = req.params.id_empresa || req.user.id_empresa;
    const result = await rutasService.listarRutas(id_empresa);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtenerRuta = async (req, res) => {
  try {
    const result = await rutasService.obtenerRuta(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

exports.crearRuta = async (req, res) => {
  try {
    const result = await rutasService.crearRuta(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.actualizarRuta = async (req, res) => {
  try {
    const result = await rutasService.actualizarRuta(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.eliminarRuta = async (req, res) => {
  try {
    const result = await rutasService.eliminarRuta(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

