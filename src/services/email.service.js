const nodemailer = require('nodemailer');

/**
 * Valida la configuración SMTP y muestra advertencias si falta algo
 */
function validateSmtpConfig() {
  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn('⚠️  Advertencia: Faltan variables de entorno SMTP:', missing.join(', '));
    console.warn('   El servicio de correo no funcionará correctamente.');
    return false;
  }
  
  const config = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || '587',
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER
  };
  
  console.log('📧 Configuración SMTP:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    // No mostramos la contraseña por seguridad
    pass: process.env.SMTP_PASS ? '***configurada***' : 'NO CONFIGURADA'
  });
  
  return true;
}

// Validar configuración al cargar el módulo
const isConfigured = validateSmtpConfig();

// Crear transporter solo si está configurado
let transporter = null;

if (isConfigured) {
  // Detectar proveedor SMTP común para configuraciones optimizadas
  const host = (process.env.SMTP_HOST || '').toLowerCase();
  let port = parseInt(process.env.SMTP_PORT || '587', 10);
  let secure = process.env.SMTP_SECURE === 'true';
  
  // Configuraciones automáticas para proveedores comunes
  if (host.includes('gmail')) {
    port = 587;
    secure = false;
    console.log('📧 Detectado Gmail SMTP, usando puerto 587 con STARTTLS');
  } else if (host.includes('outlook') || host.includes('office365') || host.includes('hotmail')) {
    port = 587;
    secure = false;
    console.log('📧 Detectado Outlook/Office365 SMTP, usando puerto 587 con STARTTLS');
  } else if (host.includes('sendgrid')) {
    port = 587;
    secure = false;
    console.log('📧 Detectado SendGrid SMTP, usando puerto 587');
  } else if (host.includes('mailgun')) {
    port = 587;
    secure = false;
    console.log('📧 Detectado Mailgun SMTP, usando puerto 587');
  }
  
  // Procesar contraseña: eliminar espacios (común en contraseñas de aplicación de Google)
  const smtpPass = (process.env.SMTP_PASS || '').trim().replace(/\s+/g, '');
  
  // Configuración específica para Gmail
  const isGmail = host.includes('gmail');
  let transporterConfig;
  
  if (isGmail) {
    // Para Gmail, usar configuración optimizada
    transporterConfig = {
      service: 'gmail', // Usar servicio Gmail de nodemailer (no necesita host/port)
      auth: {
        user: process.env.SMTP_USER,
        pass: smtpPass,
      },
      connectionTimeout: 60000,
      greetingTimeout: 60000,
      socketTimeout: 60000,
      tls: {
        rejectUnauthorized: false,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 14,
    };
    console.log('📧 Configuración Gmail: Usando servicio optimizado para Gmail');
  } else {
    // Para otros proveedores SMTP
    transporterConfig = {
      host: process.env.SMTP_HOST,
      port: port,
      secure: secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: smtpPass,
      },
      connectionTimeout: 60000,
      greetingTimeout: 60000,
      socketTimeout: 60000,
      tls: {
        rejectUnauthorized: false,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 14,
    };
  }
  
  transporter = nodemailer.createTransport(transporterConfig);
  
  // Verificar conexión al iniciar (solo en desarrollo o si está configurado)
  if (process.env.NODE_ENV !== 'production' || process.env.VERIFY_SMTP_ON_START === 'true') {
    transporter.verify()
      .then(() => {
        console.log('✅ Servidor SMTP verificado correctamente');
      })
      .catch((error) => {
        console.error('❌ Error verificando servidor SMTP:', error.message);
        console.error('   Esto puede ser normal si el servidor está en otra red o requiere autenticación.');
      });
  }
} else {
  console.warn('⚠️  Transporter SMTP no creado debido a configuración faltante');
}

/**
 * Envía un correo electrónico
 * @param {string} to - Destinatario
 * @param {string} subject - Asunto
 * @param {string} html - Contenido HTML
 * @param {Array} attachments - Archivos adjuntos [{filename, content, contentType}]
 * @returns {Object} {success: boolean, info: Object|null, error: Error|null}
 */
async function sendEmail(to, subject, html, attachments = []) {
  // Verificar si el transporter está configurado
  if (!transporter) {
    const error = new Error('Servidor SMTP no configurado. Verifica las variables de entorno SMTP_HOST, SMTP_USER, SMTP_PASS.');
    console.error('❌', error.message);
    return { success: false, info: null, error };
  }
  
  try {
    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'S.F.T.C.'}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    };
    
    // Agregar adjuntos si existen
    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map(att => ({
        filename: att.filename,
        content: att.content, // Puede ser Buffer, Stream, o string
        contentType: att.contentType || undefined
      }));
    }
    
    const smtpInfo = transporter.options.service 
      ? `Servicio: ${transporter.options.service}` 
      : `SMTP: ${process.env.SMTP_HOST}:${transporter.options.port || 'N/A'}`;
    console.log(`📤 Intentando enviar correo a: ${to} (${smtpInfo})`);
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Correo enviado exitosamente a:', to, 'MessageId:', info.messageId);
    return { success: true, info, error: null };
  } catch (error) {
    console.error('❌ Error enviando correo a', to, ':', error.message);
    
    // Mensajes de error más descriptivos según el tipo de error
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      console.error('   ⚠️  Timeout/Reinicio de conexión al servidor SMTP.');
      console.error('   Posibles causas:');
      console.error('   1. El servidor SMTP no es accesible desde Railway');
      console.error('   2. El puerto está bloqueado por firewall');
      console.error('   3. Las credenciales son incorrectas');
      console.error('   4. El servidor SMTP requiere IP whitelist (verifica en tu proveedor)');
      console.error(`   Configuración actual: ${process.env.SMTP_HOST}:${transporter.options.port}`);
    } else if (error.code === 'EAUTH') {
      console.error('   ⚠️  Error de autenticación SMTP.');
      console.error('   Verifica que SMTP_USER y SMTP_PASS sean correctos.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   ⚠️  Conexión rechazada por el servidor SMTP.');
      console.error('   Verifica que SMTP_HOST y SMTP_PORT sean correctos.');
    }
    
    return { success: false, info: null, error };
  }
}

/**
 * Envía una factura por email al cliente
 * @param {string} emailCliente - Email del cliente
 * @param {Object} datosFactura - Datos de la factura {folio, cliente, total, fecha}
 * @param {Buffer} pdfBuffer - Buffer del PDF
 * @param {string|Buffer} xmlContent - Contenido del XML
 */
async function enviarFacturaPorEmail(emailCliente, datosFactura, pdfBuffer, xmlContent) {
  const { folio, cliente, total, fecha } = datosFactura;
  
  const subject = `Factura Electrónica ${folio || 'N/A'} - ${process.env.SMTP_FROM_NAME || 'S.F.T.C.'}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .factura-info { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .factura-info p { margin: 5px 0; }
        .attachment-note { background-color: #e3f2fd; padding: 10px; border-radius: 5px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Factura Electrónica</h1>
        </div>
        <div class="content">
          <p>Estimado/a <strong>${cliente || 'Cliente'}</strong>,</p>
          
          <p>Le enviamos su factura electrónica en formato PDF y XML (CFDI 4.0) según los requisitos del SAT.</p>
          
          <div class="factura-info">
            <p><strong>Folio:</strong> ${folio || 'N/A'}</p>
            <p><strong>Fecha de Emisión:</strong> ${fecha || new Date().toLocaleDateString('es-MX')}</p>
            <p><strong>Total:</strong> $${(total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</p>
          </div>
          
          <div class="attachment-note">
            <strong>📎 Archivos adjuntos:</strong>
            <ul>
              <li>Factura_${folio || 'N/A'}.pdf - Factura en formato PDF</li>
              <li>Factura_${folio || 'N/A'}.xml - Factura en formato XML (CFDI)</li>
            </ul>
          </div>
          
          <p><strong>Importante:</strong></p>
          <ul>
            <li>Conserve estos archivos para sus registros contables y fiscales.</li>
            <li>El XML es el documento oficial reconocido por el SAT.</li>
            <li>Puede verificar la factura en el portal del SAT: <a href="https://verificacfdi.facturaelectronica.sat.gob.mx">verificacfdi.facturaelectronica.sat.gob.mx</a></li>
          </ul>
          
          <p>Si tiene alguna pregunta, no dude en contactarnos.</p>
          
          <p>Atentamente,<br><strong>${process.env.SMTP_FROM_NAME || 'S.F.T.C.'}</strong></p>
        </div>
        <div class="footer">
          <p>Este es un correo automático, por favor no responder a este mensaje.</p>
          <p>© ${new Date().getFullYear()} ${process.env.SMTP_FROM_NAME || 'S.F.T.C.'} - Sistema de Facturación para Transporte de Carga</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const attachments = [
    {
      filename: `Factura_${folio || 'N/A'}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    },
    {
      filename: `Factura_${folio || 'N/A'}.xml`,
      content: typeof xmlContent === 'string' ? Buffer.from(xmlContent, 'utf8') : xmlContent,
      contentType: 'application/xml'
    }
  ];
  
  return await sendEmail(emailCliente, subject, html, attachments);
}

/**
 * Envía correo de verificación de cuenta
 * @param {string} to - Email del destinatario
 * @param {string} nombre - Nombre del usuario
 * @param {string} token - Token de verificación
 * @returns {Object} {success: boolean, info: Object|null, error: Error|null}
 */
async function enviarCorreoVerificacion(to, nombre, token) {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
  const verificationLink = `${baseUrl}/verificar-correo?token=${token}`;
  
  const subject = 'Verifica tu cuenta - S.F.T.C.';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 30px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .button:hover { background-color: #6d28d9; }
        .token-info { background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Bienvenido a S.F.T.C.</h1>
        </div>
        <div class="content">
          <p>Estimado/a <strong>${nombre}</strong>,</p>
          
          <p>Gracias por registrarte como administrador de empresa. Para activar tu cuenta, por favor verifica tu correo electrónico haciendo clic en el siguiente botón:</p>
          
          <div style="text-align: center;">
            <a href="${verificationLink}" class="button">Verificar mi cuenta</a>
          </div>
          
          <p>O copia y pega el siguiente enlace en tu navegador:</p>
          <div class="token-info">
            <p style="word-break: break-all; margin: 0;">${verificationLink}</p>
          </div>
          
          <p><strong>Importante:</strong></p>
          <ul>
            <li>Este enlace expirará en 24 horas.</li>
            <li>Si no solicitaste este registro, puedes ignorar este correo.</li>
            <li>Una vez verificado, podrás iniciar sesión y completar el registro de tu empresa.</li>
          </ul>
          
          <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
          
          <p>Atentamente,<br><strong>${process.env.SMTP_FROM_NAME || 'S.F.T.C.'}</strong></p>
        </div>
        <div class="footer">
          <p>Este es un correo automático, por favor no responder a este mensaje.</p>
          <p>© ${new Date().getFullYear()} ${process.env.SMTP_FROM_NAME || 'S.F.T.C.'} - Sistema de Facturación para Transporte de Carga</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail(to, subject, html);
}

/**
 * Verifica la conexión SMTP
 */
async function verifyConnection() {
  if (!transporter) {
    console.error('❌ No se puede verificar: Transporter SMTP no está configurado');
    return false;
  }
  
  try {
    console.log(`🔍 Verificando conexión SMTP a ${process.env.SMTP_HOST}:${transporter.options.port}...`);
    await transporter.verify();
    console.log('✅ Servidor SMTP listo para enviar correos');
    return true;
  } catch (error) {
    console.error('❌ Error de conexión SMTP:', error.message);
    if (error.code === 'ETIMEDOUT') {
      console.error('   Timeout al conectar. Verifica:');
      console.error('   - Que el servidor SMTP sea accesible desde Railway');
      console.error('   - Que el puerto no esté bloqueado');
      console.error('   - Que Railway tenga permisos para conectarse');
    }
    return false;
  }
}

module.exports = {
  sendEmail,
  enviarFacturaPorEmail,
  enviarCorreoVerificacion,
  verifyConnection
};
