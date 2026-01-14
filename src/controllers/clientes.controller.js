const clientesService = require('../services/clientes.service');
const { verificarAccesoEmpresa, obtenerIdEmpresaDeRegistro } = require('../middleware/companyAccess');

exports.listarClientes = async (req, res) => {
  try {
    // Si es superadmin y no hay id_empresa en params, pasar null para obtener todos los clientes
    // Si no es superadmin, usar id_empresa del usuario
    let id_empresa = req.params.id_empresa;
    if (!id_empresa && req.user.rol === 'superadmin') {
      id_empresa = null; // Superadmin puede ver todos los clientes
    } else if (!id_empresa) {
      id_empresa = req.user.id_empresa;
    }
    
    // Validar que el usuario solo pueda ver clientes de su empresa (a menos que sea superadmin)
    if (req.user.rol !== 'superadmin' && id_empresa && parseInt(id_empresa) !== req.user.id_empresa) {
      return res.status(403).json({ error: 'No autorizado para ver clientes de esta empresa' });
    }
    
    const result = await clientesService.listarClientes(id_empresa);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.obtenerCliente = async (req, res) => {
  try {
    const cliente = await clientesService.obtenerCliente(req.params.id);
    
    // Verificar acceso a la empresa del cliente
    const tieneAcceso = await verificarAccesoEmpresa(req.user, cliente.id_empresa);
    if (!tieneAcceso) {
      return res.status(403).json({ error: 'No autorizado para ver este cliente' });
    }
    
    res.json(cliente);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

exports.crearCliente = async (req, res) => {
  try {
    // Validar que el usuario solo pueda crear clientes para su empresa
    const id_empresa = req.body.id_empresa || req.user.id_empresa;
    if (req.user.rol !== 'superadmin' && id_empresa !== req.user.id_empresa) {
      return res.status(403).json({ error: 'No autorizado para crear clientes en esta empresa' });
    }
    req.body.id_empresa = id_empresa;
    
    const result = await clientesService.crearCliente(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.actualizarCliente = async (req, res) => {
  try {
    // Verificar acceso a la empresa del cliente
    const id_empresa = await obtenerIdEmpresaDeRegistro('clientes', 'id_cliente', req.params.id);
    if (!id_empresa) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    const tieneAcceso = await verificarAccesoEmpresa(req.user, id_empresa);
    if (!tieneAcceso) {
      return res.status(403).json({ error: 'No autorizado para actualizar este cliente' });
    }
    
    const result = await clientesService.actualizarCliente(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.eliminarCliente = async (req, res) => {
  try {
    // Verificar acceso a la empresa del cliente
    const id_empresa = await obtenerIdEmpresaDeRegistro('clientes', 'id_cliente', req.params.id);
    if (!id_empresa) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    const tieneAcceso = await verificarAccesoEmpresa(req.user, id_empresa);
    if (!tieneAcceso) {
      return res.status(403).json({ error: 'No autorizado para eliminar este cliente' });
    }
    
    const result = await clientesService.eliminarCliente(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

