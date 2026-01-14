const vehiculosService = require('../services/vehiculos.service');

exports.listarVehiculos = async (req, res) => {
  try {
    const id_empresa = req.params.id_empresa || req.user.id_empresa;
    const result = await vehiculosService.listarVehiculos(id_empresa);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtenerVehiculo = async (req, res) => {
  try {
    const result = await vehiculosService.obtenerVehiculo(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

exports.crearVehiculo = async (req, res) => {
  try {
    const result = await vehiculosService.crearVehiculo(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.actualizarVehiculo = async (req, res) => {
  try {
    const result = await vehiculosService.actualizarVehiculo(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.eliminarVehiculo = async (req, res) => {
  try {
    const result = await vehiculosService.eliminarVehiculo(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

