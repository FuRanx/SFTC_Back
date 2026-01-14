const productosService = require('../services/productos.service');

exports.listarProductos = async (req, res) => {
  try {
    // Si es superadmin y no hay id_empresa en params, pasar null para obtener todos los productos
    // Si no es superadmin, usar id_empresa del usuario
    let id_empresa = req.params.id_empresa;
    if (!id_empresa && req.user.rol === 'superadmin') {
      id_empresa = null; // Superadmin puede ver todos los productos
    } else if (!id_empresa) {
      id_empresa = req.user.id_empresa;
    }
    const result = await productosService.listarProductos(id_empresa);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtenerProducto = async (req, res) => {
  try {
    const result = await productosService.obtenerProducto(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

exports.crearProducto = async (req, res) => {
  try {
    const result = await productosService.crearProducto(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.actualizarProducto = async (req, res) => {
  try {
    const result = await productosService.actualizarProducto(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.eliminarProducto = async (req, res) => {
  try {
    const result = await productosService.eliminarProducto(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

