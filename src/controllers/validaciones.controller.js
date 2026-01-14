const validacionesService = require('../services/validaciones.service');

exports.registrarValidacion = async (req, res) => {
  try {
    const result = await validacionesService.registrarValidacion(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.listarValidaciones = async (req, res) => {
  try {
    const result = await validacionesService.listarValidaciones();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
