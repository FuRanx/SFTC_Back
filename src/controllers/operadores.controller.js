const operadoresService = require('../services/operadores.service');

exports.listarOperadores = async (req, res) => {
  try {
    const id_empresa = req.params.id_empresa || req.user.id_empresa;
    const result = await operadoresService.listarOperadores(id_empresa);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtenerOperador = async (req, res) => {
  try {
    const result = await operadoresService.obtenerOperador(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

exports.crearOperador = async (req, res) => {
  try {
    const result = await operadoresService.crearOperador(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.actualizarOperador = async (req, res) => {
  try {
    const result = await operadoresService.actualizarOperador(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.eliminarOperador = async (req, res) => {
  try {
    const result = await operadoresService.eliminarOperador(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

