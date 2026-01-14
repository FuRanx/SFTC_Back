const fetch = require('node-fetch');
const FormData = require('form-data');

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT = process.env.APPWRITE_PROJECT;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || process.env.APPWRITE_KEY;
// Bucket para documentos (logos, CSF, etc.) - mismo que usa el frontend
const APPWRITE_BUCKET_DOCUMENTOS = process.env.APPWRITE_BUCKET_ID || process.env.APPWRITE_BUCKET || process.env.APPWRITE_BUCKET_DOCUMENTOS;
// Bucket para facturas (XML/PDF) - puede ser el mismo o diferente
const APPWRITE_BUCKET_FACTURAS = process.env.APPWRITE_BUCKET_FACTURAS || APPWRITE_BUCKET_DOCUMENTOS;

function ensureConfigured(bucketRequerido = null) {
  // Verificar configuración básica
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT || !APPWRITE_API_KEY) {
    console.error('Configuración Appwrite faltante:', {
        endpoint: !!APPWRITE_ENDPOINT,
        project: !!APPWRITE_PROJECT,
        key: !!APPWRITE_API_KEY
    });
    throw new Error('Appwrite no está correctamente configurado en el backend (falta endpoint, project o API key)');
  }
  
  // Si se requiere un bucket específico, verificar que exista
  if (bucketRequerido && !bucketRequerido) {
    console.error('Bucket requerido no configurado:', bucketRequerido);
    throw new Error('Bucket de Appwrite no configurado');
  }
}

async function uploadFileFromBuffer(buffer, filename, contentType = 'application/octet-stream', bucketId = null) {
  const bucket = bucketId || APPWRITE_BUCKET_FACTURAS;
  ensureConfigured(bucket);

  if (!bucket) {
    throw new Error('Bucket no especificado para subir archivo');
  }

  const url = `${APPWRITE_ENDPOINT}/storage/buckets/${bucket}/files`;
  const form = new FormData();
  form.append('fileId', 'unique()');
  form.append('file', buffer, { filename, contentType });
  form.append('name', filename);

  const headers = {
    'X-Appwrite-Project': APPWRITE_PROJECT,
    'X-Appwrite-Key': APPWRITE_API_KEY,
    ...form.getHeaders()
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: form
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    let errorMsg = txt;
    try {
        const jsonError = JSON.parse(txt);
        if (jsonError.type === 'storage_file_type_unsupported') {
            errorMsg = `El bucket de Appwrite no permite archivos con esta extensión (${filename.split('.').pop()}). Ve a tu consola de Appwrite > Storage > Bucket > Configuración y agrega 'xml' y 'pdf' a las extensiones permitidas.`;
        } else if (jsonError.message) {
            errorMsg = jsonError.message;
        }
    } catch (e) {}
    throw new Error(errorMsg);
  }

  const json = await res.json();
  return json.$id || json.id;
}

async function downloadFileToBuffer(fileId, bucketId = null) {
  // Si no se especifica bucket, usar el bucket de documentos (donde están los logos)
  // Para facturas, se debe pasar explícitamente el bucket de facturas
  const bucket = bucketId || APPWRITE_BUCKET_DOCUMENTOS || APPWRITE_BUCKET_FACTURAS;
  
  if (!bucket) {
    throw new Error('Bucket ID no especificado para descargar archivo. Configure APPWRITE_BUCKET_ID o APPWRITE_BUCKET_FACTURAS en el .env');
  }
  
  ensureConfigured(bucket);

  const url = `${APPWRITE_ENDPOINT}/storage/buckets/${bucket}/files/${fileId}/download`;

  const headers = {
    'X-Appwrite-Project': APPWRITE_PROJECT,
    'X-Appwrite-Key': APPWRITE_API_KEY
  };

  const res = await fetch(url, {
    method: 'GET',
    headers
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`Error descargando archivo ${fileId} del bucket ${bucket}: ${txt}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = {
  uploadFileFromBuffer,
  downloadFileToBuffer
};

