const fetch = require('node-fetch');
require('dotenv').config();

const FACTURAMA_API_URL = 'https://apisandbox.facturama.mx'; // Sandbox URL

// Codificar credenciales en Base64
const getAuthHeader = () => {
    if (!process.env.FACTURAMA_USER || !process.env.FACTURAMA_PASSWORD) {
        throw new Error('Credenciales de Facturama no configuradas en .env');
    }
    return 'Basic ' + Buffer.from(`${process.env.FACTURAMA_USER}:${process.env.FACTURAMA_PASSWORD}`).toString('base64');
};

/**
 * Crea un CFDI en Facturama
 * @param {Object} invoiceData Datos de la factura en formato Facturama
 */
async function createInvoice(invoiceData) {
    const response = await fetch(`${FACTURAMA_API_URL}/2/cfdis`, {
        method: 'POST',
        headers: {
            'Authorization': getAuthHeader(),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(invoiceData)
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('Error Facturama:', JSON.stringify(data, null, 2));
        throw new Error(data.Message || JSON.stringify(data));
    }

    return data;
}

/**
 * Descarga el XML de una factura por ID
 * @param {string} id ID de la factura en Facturama
 * @returns {Promise<string>} Contenido del XML
 */
async function downloadXML(id) {
    const response = await fetch(`${FACTURAMA_API_URL}/cfdi/xml/issued/${id}`, {
        method: 'GET',
        headers: {
            'Authorization': getAuthHeader()
        }
    });

    if (!response.ok) {
        throw new Error('Error descargando XML de Facturama');
    }
    
    // Facturama devuelve un JSON con el contenido en base64 o el XML directo dependiendo del endpoint
    // El endpoint /cfdi/xml/issued/{id} devuelve un JSON: { "Content": "base64...", "Id": "..." }
    const data = await response.json();
    return Buffer.from(data.Content, 'base64').toString('utf8');
}

/**
 * Descarga el PDF de una factura por ID
 * @param {string} id ID de la factura en Facturama
 * @returns {Promise<Buffer>} Buffer del PDF
 */
async function downloadPDF(id) {
    const response = await fetch(`${FACTURAMA_API_URL}/cfdi/pdf/issued/${id}`, {
        method: 'GET',
        headers: {
            'Authorization': getAuthHeader()
        }
    });

    if (!response.ok) {
        throw new Error('Error descargando PDF de Facturama');
    }

    const data = await response.json();
    return Buffer.from(data.Content, 'base64');
}

module.exports = {
    createInvoice,
    downloadXML,
    downloadPDF
};
