const nodemailer = require('nodemailer');

// Configuración del transporter mejorada para la nube
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  family: 4,               // <--- ESTA LINEA ES LA CLAVE
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000
});

/**
 * Envía un correo electrónico
 * @param {string} to - Destinatario
 * @param {string} subject - Asunto
 * @param {string} html - Contenido HTML
 * @param {Array} attachments - Archivos adjuntos [{filename, content, contentType}]
 */
async function sendEmail(to, subject, html, attachments = []) {
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
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Correo enviado: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error enviando correo:', error);
    // No lanzamos el error para no interrumpir flujos principales si el correo falla,
    // pero podrías querer manejarlo diferente según el caso.
    return null;
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
  try {
    await transporter.verify();
    console.log('Servidor SMTP listo para enviar correos');
    return true;
  } catch (error) {
    console.error('Error de conexión SMTP:', error);
    return false;
  }
}

module.exports = {
  sendEmail,
  enviarFacturaPorEmail,
  enviarCorreoVerificacion,
  verifyConnection
};
