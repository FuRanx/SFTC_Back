exports.requireRole = (role) => {
  return (req, res, next) => {
    const user = req.user;
    if (user.rol === 'superadmin') return next(); // acceso total
    if (user.rol !== role) return res.status(403).json({ mensaje: 'Acceso denegado' });
    next();
  };
};

exports.requireSameCompanyOrSuperAdmin = () => {
  return (req, res, next) => {
    const user = req.user;
    const id_empresa = parseInt(req.params.id_empresa || req.body.id_empresa);
    
    console.log('=== requireSameCompanyOrSuperAdmin ===');
    console.log('User from token:', JSON.stringify(user, null, 2));
    console.log('id_empresa from params/body:', id_empresa);
    console.log('user.id_empresa:', user.id_empresa);
    console.log('Comparison:', user.id_empresa, '===', id_empresa, '?', user.id_empresa === id_empresa);
    
    if (user.rol === 'superadmin') {
      console.log('Superadmin access granted');
      return next();
    }
    
    if (!user.id_empresa || user.id_empresa !== id_empresa) {
      console.error('Access denied: user.id_empresa:', user.id_empresa, '!== id_empresa:', id_empresa);
      return res.status(403).json({ mensaje: 'No autorizado para esta empresa' });
    }
    
    console.log('Access granted');
    next();
  };
};
