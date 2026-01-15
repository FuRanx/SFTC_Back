const express = require('express');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Rutas
const authRoutes = require('./routes/auth.routes');
const solicitudesRoutes = require('./routes/solicitudes.routes');
const empresasRoutes = require('./routes/empresas.routes');
const documentosRoutes = require('./routes/documentos.routes');
const facturasRoutes = require('./routes/facturas.routes');
const validacionesRoutes = require('./routes/validaciones.routes');
const clientesRoutes = require('./routes/clientes.routes');
const productosRoutes = require('./routes/productos.routes');
const operadoresRoutes = require('./routes/operadores.routes');
const vehiculosRoutes = require('./routes/vehiculos.routes');
const rutasRoutes = require('./routes/rutas.routes');
const cartasPorteRoutes = require('./routes/cartas-porte.routes');

// Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/empresas', empresasRoutes);
app.use('/api/documentos', documentosRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/validaciones', validacionesRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/operadores', operadoresRoutes);
app.use('/api/vehiculos', vehiculosRoutes);
app.use('/api/rutas', rutasRoutes);
app.use('/api/cartas-porte', cartasPorteRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor funcionando correctamente' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
