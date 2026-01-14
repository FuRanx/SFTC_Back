const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    console.error('Error: No se encontró header Authorization');
    return res.status(401).json({ mensaje: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.error('Error: Token no encontrado en header Authorization');
    return res.status(401).json({ mensaje: 'Token requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('Error verificando token:', err);
      return res.status(403).json({ mensaje: 'Token inválido' });
    }
    
    console.log('Token decodificado:', decoded);
    req.user = decoded;
    next();
  });
};
