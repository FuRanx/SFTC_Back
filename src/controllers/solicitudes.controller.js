const solicitudesService = require('../services/solicitudes.service');

exports.crearSolicitud = async (req, res) => {
  try {
    const result = await solicitudesService.crearSolicitud(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.listarSolicitudes = async (req, res) => {
  try {
    const result = await solicitudesService.listarSolicitudes();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.aprobarSolicitud = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await solicitudesService.aprobarSolicitud(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.rechazarSolicitud = async (req, res) => {
  try {
    const id = req.params.id;
    const { motivo } = req.body;
    const result = await solicitudesService.rechazarSolicitud(id, motivo);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
