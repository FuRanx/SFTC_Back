/**
 * Servicio de validación SAT (simulado para ambiente de pruebas)
 * En producción, esto se conectaría al sandbox real del SAT
 */

// Catálogos SAT básicos (versión simplificada para simulación)
// RFC válido: Persona Física (13 chars): 4 letras + 6 dígitos + 3 alfanuméricos
// RFC válido: Persona Moral (12 chars): 3 letras + 6 dígitos + 3 alfanuméricos
// También acepta RFC genéricos como XAXX010101000
const CATALOGO_RFC_VALIDOS = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const CATALOGO_CLAVES_PRODUCTO_SAT = [
  '01010101', '84111506', '84111704', // Servicios en general
  '50202200', '50202301', // Servicios de transporte
  '78101700', // Servicios de transporte terrestre
  '78101704', // Servicios de transporte de carga
];

const CATALOGO_CLAVES_UNIDAD_SAT = [
  'H87', // Pieza
  'MTR', // Metro
  'KGM', // Kilogramo
  'LTR', // Litro
  'MTK', // Metro cuadrado
  'MTQ', // Metro cúbico
  'XPK', // Paquete
  'XTR', // Tonelada de registro
];

const CATALOGO_REGIMENES_FISCALES = [
  '601', '603', '605', '606', '608', '610', '611', '612', '614', '615',
  '616', '620', '621', '622', '623', '624', '625', '626', '628', '629',
  '630', '615', '616'
];

const CATALOGO_USOS_CFDI = [
  'G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08',
  'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10',
  'P01', 'S01', 'CP01', 'CN01'
];

/**
 * Valida un RFC según las reglas del SAT
 */
function validarRFC(rfc) {
  const errores = [];
  const advertencias = [];
  
  if (!rfc || typeof rfc !== 'string') {
    errores.push({ campo: 'RFC', mensaje: 'El RFC es requerido', codigo: 'RFC_REQUERIDO' });
    return { valido: false, errores, advertencias };
  }
  
  // Limpiar el RFC: eliminar espacios, guiones y convertir a mayúsculas
  rfc = rfc.trim().replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
  
  // Validar longitud primero (debe ser 12 o 13 caracteres)
  if (rfc.length !== 12 && rfc.length !== 13) {
    errores.push({ 
      campo: 'RFC', 
      mensaje: `El RFC debe tener 12 caracteres (persona moral) o 13 caracteres (persona física). Longitud actual: ${rfc.length}`, 
      codigo: 'RFC_LONGITUD_INVALIDA' 
    });
    // Si la longitud es incorrecta, no continuar con otras validaciones
    return { 
      valido: false, 
      errores, 
      advertencias,
      rfc_validado: rfc
    };
  }
  
  // Validar formato básico según longitud
  // Persona Moral: 3 letras + 6 dígitos + 3 alfanuméricos (12 chars)
  // Persona Física: 4 letras + 6 dígitos + 3 alfanuméricos (13 chars)
  const esPersonaMoral = rfc.length === 12;
  const esPersonaFisica = rfc.length === 13;
  
  // Debug: Log para identificar problemas
  console.log(`[validarRFC] RFC recibido: "${rfc}", Longitud: ${rfc.length}, esPersonaMoral: ${esPersonaMoral}, esPersonaFisica: ${esPersonaFisica}`);
  
  if (esPersonaMoral) {
    // RFC de Persona Moral: 3 letras + 6 dígitos + 3 alfanuméricos
    const regexMoral = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/;
    const pasaValidacion = regexMoral.test(rfc);
    console.log(`[validarRFC] Persona Moral - Regex test: ${pasaValidacion} para RFC: "${rfc}"`);
    if (!pasaValidacion) {
      errores.push({ 
        campo: 'RFC', 
        mensaje: `El RFC de persona moral no cumple con el formato válido. Debe tener 3 letras, 6 dígitos y 3 alfanuméricos (ejemplo: NME850101AA3). RFC recibido: "${rfc}"`, 
        codigo: 'RFC_FORMATO_INVALIDO' 
      });
    }
  } else if (esPersonaFisica) {
    // RFC de Persona Física: 4 letras + 6 dígitos + 3 alfanuméricos
    const regexFisica = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/;
    const pasaValidacion = regexFisica.test(rfc);
    console.log(`[validarRFC] Persona Física - Regex test: ${pasaValidacion} para RFC: "${rfc}"`);
    if (!pasaValidacion) {
      errores.push({ 
        campo: 'RFC', 
        mensaje: `El RFC de persona física no cumple con el formato válido. Debe tener 4 letras, 6 dígitos y 3 alfanuméricos (ejemplo: XAXX010101000). RFC recibido: "${rfc}"`, 
        codigo: 'RFC_FORMATO_INVALIDO' 
      });
    }
  } else {
    // Caso que no debería ocurrir, pero por seguridad
    errores.push({ 
      campo: 'RFC', 
      mensaje: `Longitud de RFC inválida: ${rfc.length} caracteres. Debe ser 12 (persona moral) o 13 (persona física). RFC recibido: "${rfc}"`, 
      codigo: 'RFC_LONGITUD_INVALIDA' 
    });
  }
  
  // Validar fecha en RFC (para personas físicas y morales)
  if (rfc.length >= 10 && errores.length === 0) {
    // La fecha está en las posiciones 4-9 (después de las letras iniciales)
    const inicioFecha = esPersonaMoral ? 3 : 4;
    const fecha = rfc.substring(inicioFecha, inicioFecha + 6);
    const anio = parseInt(fecha.substring(0, 2));
    const mes = parseInt(fecha.substring(2, 4));
    const dia = parseInt(fecha.substring(4, 6));
    
    if (mes < 1 || mes > 12) {
      advertencias.push({ 
        campo: 'RFC', 
        mensaje: `El mes en el RFC parece inválido: ${mes}`, 
        codigo: 'RFC_MES_INVALIDO' 
      });
    }
    
    if (dia < 1 || dia > 31) {
      advertencias.push({ 
        campo: 'RFC', 
        mensaje: `El día en el RFC parece inválido: ${dia}`, 
        codigo: 'RFC_DIA_INVALIDO' 
      });
    }
  }
  
  return { 
    valido: errores.length === 0, 
    errores, 
    advertencias,
    rfc_validado: rfc,
    tipo: esPersonaMoral ? 'moral' : esPersonaFisica ? 'fisica' : 'desconocido'
  };
}

/**
 * Determina si un RFC es de Persona Física o Persona Moral
 * @param {string} rfc - RFC a analizar
 * @returns {Object} - { tipo: 'moral' | 'fisica' | 'invalido', longitud: number, descripcion: string }
 */
function determinarTipoRFC(rfc) {
  if (!rfc || typeof rfc !== 'string') {
    return { tipo: 'invalido', longitud: 0, descripcion: 'RFC no válido o vacío' };
  }
  
  // Limpiar el RFC
  const rfcLimpio = rfc.trim().replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
  const longitud = rfcLimpio.length;
  
  if (longitud === 12) {
    return {
      tipo: 'moral',
      longitud: 12,
      descripcion: 'Persona Moral (Empresa)',
      formato: '3 letras + 6 dígitos + 3 alfanuméricos',
      ejemplo: 'NME850101AA3'
    };
  } else if (longitud === 13) {
    return {
      tipo: 'fisica',
      longitud: 13,
      descripcion: 'Persona Física (Individual)',
      formato: '4 letras + 6 dígitos + 3 alfanuméricos',
      ejemplo: 'XAXX010101000'
    };
  } else {
    return {
      tipo: 'invalido',
      longitud: longitud,
      descripcion: `RFC inválido: debe tener 12 o 13 caracteres, tiene ${longitud}`
    };
  }
}

/**
 * Valida una clave de producto/servicio SAT
 */
function validarClaveProductoSAT(clave) {
  if (!clave) {
    return { 
      valido: false, 
      errores: [{ campo: 'ClaveSAT', mensaje: 'La clave de producto SAT es requerida', codigo: 'CLAVE_SAT_REQUERIDA' }],
      advertencias: []
    };
  }
  
  // Validar formato (8 dígitos)
  if (!/^\d{8}$/.test(clave)) {
    return { 
      valido: false, 
      errores: [{ campo: 'ClaveSAT', mensaje: 'La clave SAT debe tener 8 dígitos', codigo: 'CLAVE_SAT_FORMATO_INVALIDO' }],
      advertencias: []
    };
  }
  
  // Verificar si está en catálogo (simulado)
  const enCatalogo = CATALOGO_CLAVES_PRODUCTO_SAT.includes(clave);
  if (!enCatalogo) {
    return { 
      valido: true, // Permitir claves no conocidas pero advertir
      errores: [],
      advertencias: [{ campo: 'ClaveSAT', mensaje: `La clave ${clave} no está en el catálogo básico. Verifique que sea correcta.`, codigo: 'CLAVE_SAT_NO_CATALOGO' }]
    };
  }
  
  return { valido: true, errores: [], advertencias: [] };
}

/**
 * Valida una clave de unidad SAT
 */
function validarClaveUnidadSAT(clave) {
  if (!clave) {
    return { 
      valido: false, 
      errores: [{ campo: 'UnidadSAT', mensaje: 'La clave de unidad SAT es requerida', codigo: 'UNIDAD_SAT_REQUERIDA' }],
      advertencias: []
    };
  }
  
  // Validar formato (3 caracteres)
  if (!/^[A-Z0-9]{3,4}$/.test(clave)) {
    return { 
      valido: false, 
      errores: [{ campo: 'UnidadSAT', mensaje: 'La clave de unidad SAT debe tener 3-4 caracteres alfanuméricos', codigo: 'UNIDAD_SAT_FORMATO_INVALIDO' }],
      advertencias: []
    };
  }
  
  const enCatalogo = CATALOGO_CLAVES_UNIDAD_SAT.includes(clave);
  if (!enCatalogo) {
    return { 
      valido: true,
      errores: [],
      advertencias: [{ campo: 'UnidadSAT', mensaje: `La unidad ${clave} no está en el catálogo básico. Verifique que sea correcta.`, codigo: 'UNIDAD_SAT_NO_CATALOGO' }]
    };
  }
  
  return { valido: true, errores: [], advertencias: [] };
}

/**
 * Valida un régimen fiscal
 */
function validarRegimenFiscal(regimen) {
  if (!regimen) {
    return { 
      valido: false, 
      errores: [{ campo: 'RegimenFiscal', mensaje: 'El régimen fiscal es requerido', codigo: 'REGIMEN_REQUERIDO' }],
      advertencias: []
    };
  }
  
  if (!CATALOGO_REGIMENES_FISCALES.includes(regimen)) {
    return { 
      valido: false, 
      errores: [{ campo: 'RegimenFiscal', mensaje: `El régimen fiscal ${regimen} no es válido según el catálogo SAT`, codigo: 'REGIMEN_INVALIDO' }],
      advertencias: []
    };
  }
  
  return { valido: true, errores: [], advertencias: [] };
}

/**
 * Valida un uso de CFDI
 */
function validarUsoCFDI(uso) {
  if (!uso) {
    return { 
      valido: false, 
      errores: [{ campo: 'UsoCFDI', mensaje: 'El uso de CFDI es requerido', codigo: 'USO_CFDI_REQUERIDO' }],
      advertencias: []
    };
  }
  
  if (!CATALOGO_USOS_CFDI.includes(uso)) {
    return { 
      valido: false, 
      errores: [{ campo: 'UsoCFDI', mensaje: `El uso de CFDI ${uso} no es válido según el catálogo SAT`, codigo: 'USO_CFDI_INVALIDO' }],
      advertencias: []
    };
  }
  
  return { valido: true, errores: [], advertencias: [] };
}

/**
 * Valida un código postal mexicano
 */
function validarCodigoPostal(cp) {
  if (!cp) {
    return { 
      valido: false, 
      errores: [{ campo: 'CodigoPostal', mensaje: 'El código postal es requerido', codigo: 'CP_REQUERIDO' }],
      advertencias: []
    };
  }
  
  // Validar formato (5 dígitos)
  if (!/^\d{5}$/.test(cp)) {
    return { 
      valido: false, 
      errores: [{ campo: 'CodigoPostal', mensaje: 'El código postal debe tener 5 dígitos', codigo: 'CP_FORMATO_INVALIDO' }],
      advertencias: []
    };
  }
  
  // Validar rango (01000-99999)
  const cpNum = parseInt(cp);
  if (cpNum < 1000 || cpNum > 99999) {
    return { 
      valido: false, 
      errores: [{ campo: 'CodigoPostal', mensaje: 'El código postal está fuera del rango válido', codigo: 'CP_RANGO_INVALIDO' }],
      advertencias: []
    };
  }
  
  return { valido: true, errores: [], advertencias: [] };
}

/**
 * Valida una factura completa según las reglas del SAT
 * @param {Object} facturaData - Datos de la factura
 * @param {string} ambiente - 'sandbox' o 'produccion' (solo para simulación)
 */
async function validarFacturaCompleta(facturaData, ambiente = 'sandbox') {
  const resultado = {
    valida: true,
    ambiente: ambiente,
    fecha_validacion: new Date().toISOString(),
    errores: [],
    advertencias: [],
    detalles: {
      emisor: { valido: false, errores: [], advertencias: [] },
      receptor: { valido: false, errores: [], advertencias: [] },
      conceptos: [],
      carta_porte: { valido: true, errores: [], advertencias: [] }
    }
  };
  
  // 1. Validar Emisor
  if (facturaData.rfc_emisor) {
    const validacionRFC = validarRFC(facturaData.rfc_emisor);
    resultado.detalles.emisor = validacionRFC;
    if (!validacionRFC.valido) {
      // Agregar prefijo "Emisor." a los errores del RFC del emisor para claridad
      resultado.errores.push(...validacionRFC.errores.map(e => ({ ...e, campo: `Emisor.${e.campo}` })));
      resultado.valida = false;
    }
    if (validacionRFC.advertencias.length > 0) {
      resultado.advertencias.push(...validacionRFC.advertencias.map(a => ({ ...a, campo: `Emisor.${a.campo}` })));
    }
  } else {
    resultado.errores.push({ campo: 'Emisor.RFC', mensaje: 'El RFC del emisor es requerido', codigo: 'RFC_EMISOR_REQUERIDO' });
    resultado.valida = false;
  }
  
  // 2. Validar Receptor (Cliente)
  if (facturaData.rfc_cliente) {
    const validacionRFC = validarRFC(facturaData.rfc_cliente);
    resultado.detalles.receptor = validacionRFC;
    if (!validacionRFC.valido) {
      resultado.errores.push(...validacionRFC.errores.map(e => ({ ...e, campo: `Receptor.${e.campo}` })));
      resultado.valida = false;
    }
    if (validacionRFC.advertencias.length > 0) {
      resultado.advertencias.push(...validacionRFC.advertencias.map(a => ({ ...a, campo: `Receptor.${a.campo}` })));
    }
  } else {
    resultado.errores.push({ campo: 'Receptor.RFC', mensaje: 'El RFC del receptor es requerido', codigo: 'RFC_RECEPTOR_REQUERIDO' });
    resultado.valida = false;
  }
  
  // Validar régimen fiscal del receptor
  if (facturaData.regimen_fiscal_cliente) {
    const validacionRegimen = validarRegimenFiscal(facturaData.regimen_fiscal_cliente);
    if (!validacionRegimen.valido) {
      resultado.errores.push(...validacionRegimen.errores.map(e => ({ ...e, campo: `Receptor.${e.campo}` })));
      resultado.valida = false;
    }
  } else {
    resultado.errores.push({ campo: 'Receptor.RegimenFiscal', mensaje: 'El régimen fiscal del receptor es requerido', codigo: 'REGIMEN_RECEPTOR_REQUERIDO' });
    resultado.valida = false;
  }
  
  // Validar uso de CFDI
  if (facturaData.uso_cfdi_cliente) {
    const validacionUso = validarUsoCFDI(facturaData.uso_cfdi_cliente);
    if (!validacionUso.valido) {
      resultado.errores.push(...validacionUso.errores.map(e => ({ ...e, campo: `Receptor.${e.campo}` })));
      resultado.valida = false;
    }
  } else {
    resultado.errores.push({ campo: 'Receptor.UsoCFDI', mensaje: 'El uso de CFDI es requerido', codigo: 'USO_CFDI_RECEPTOR_REQUERIDO' });
    resultado.valida = false;
  }
  
  // Validar código postal
  if (facturaData.cp_cliente) {
    const validacionCP = validarCodigoPostal(facturaData.cp_cliente);
    if (!validacionCP.valido) {
      resultado.errores.push(...validacionCP.errores.map(e => ({ ...e, campo: `Receptor.${e.campo}` })));
      resultado.valida = false;
    }
  } else {
    resultado.errores.push({ campo: 'Receptor.CodigoPostal', mensaje: 'El código postal del receptor es requerido', codigo: 'CP_RECEPTOR_REQUERIDO' });
    resultado.valida = false;
  }
  
  // 3. Validar Conceptos
  if (!facturaData.conceptos || facturaData.conceptos.length === 0) {
    resultado.errores.push({ campo: 'Conceptos', mensaje: 'La factura debe tener al menos un concepto', codigo: 'CONCEPTOS_REQUERIDOS' });
    resultado.valida = false;
  } else {
    facturaData.conceptos.forEach((concepto, index) => {
      const validacionConcepto = {
        indice: index + 1,
        descripcion: concepto.descripcion || `Concepto ${index + 1}`,
        valido: true,
        errores: [],
        advertencias: []
      };
      
      // Validar descripción
      if (!concepto.descripcion || concepto.descripcion.trim().length === 0) {
        validacionConcepto.errores.push({ campo: 'Descripcion', mensaje: 'La descripción del concepto es requerida', codigo: 'DESCRIPCION_REQUERIDA' });
        validacionConcepto.valido = false;
        resultado.valida = false;
      }
      
      // Validar cantidad
      if (!concepto.cantidad || concepto.cantidad <= 0) {
        validacionConcepto.errores.push({ campo: 'Cantidad', mensaje: 'La cantidad debe ser mayor a 0', codigo: 'CANTIDAD_INVALIDA' });
        validacionConcepto.valido = false;
        resultado.valida = false;
      }
      
      // Validar precio unitario
      if (!concepto.precio_unitario || concepto.precio_unitario <= 0) {
        validacionConcepto.errores.push({ campo: 'PrecioUnitario', mensaje: 'El precio unitario debe ser mayor a 0', codigo: 'PRECIO_INVALIDO' });
        validacionConcepto.valido = false;
        resultado.valida = false;
      }
      
      // Validar clave SAT
      if (concepto.clave_sat) {
        const validacionClave = validarClaveProductoSAT(concepto.clave_sat);
        if (!validacionClave.valido) {
          validacionConcepto.errores.push(...validacionClave.errores);
          validacionConcepto.valido = false;
          resultado.valida = false;
        }
        if (validacionClave.advertencias.length > 0) {
          validacionConcepto.advertencias.push(...validacionClave.advertencias);
          resultado.advertencias.push(...validacionClave.advertencias.map(a => ({ ...a, campo: `Concepto[${index}].${a.campo}` })));
        }
      } else {
        validacionConcepto.advertencias.push({ campo: 'ClaveSAT', mensaje: 'La clave SAT no fue proporcionada, se usará una genérica', codigo: 'CLAVE_SAT_NO_PROVIDA' });
        resultado.advertencias.push({ campo: `Concepto[${index}].ClaveSAT`, mensaje: 'Se usará clave SAT genérica 01010101', codigo: 'CLAVE_SAT_DEFAULT' });
      }
      
      // Validar unidad SAT
      if (concepto.unidad_sat) {
        const validacionUnidad = validarClaveUnidadSAT(concepto.unidad_sat);
        if (!validacionUnidad.valido) {
          validacionConcepto.errores.push(...validacionUnidad.errores);
          validacionConcepto.valido = false;
          resultado.valida = false;
        }
        if (validacionUnidad.advertencias.length > 0) {
          validacionConcepto.advertencias.push(...validacionUnidad.advertencias);
          resultado.advertencias.push(...validacionUnidad.advertencias.map(a => ({ ...a, campo: `Concepto[${index}].${a.campo}` })));
        }
      } else {
        validacionConcepto.advertencias.push({ campo: 'UnidadSAT', mensaje: 'La unidad SAT no fue proporcionada, se usará H87 (Pieza)', codigo: 'UNIDAD_SAT_NO_PROVIDA' });
        resultado.advertencias.push({ campo: `Concepto[${index}].UnidadSAT`, mensaje: 'Se usará unidad SAT genérica H87', codigo: 'UNIDAD_SAT_DEFAULT' });
      }
      
      resultado.detalles.conceptos.push(validacionConcepto);
      
      if (!validacionConcepto.valido) {
        resultado.errores.push(...validacionConcepto.errores.map(e => ({ ...e, campo: `Concepto[${index}].${e.campo}` })));
      }
    });
  }
  
  // 4. Validar Carta Porte (si aplica)
  if (facturaData.tipo_transporte === 'autotransporte' || facturaData.operador_id) {
    if (!facturaData.operador_id) {
      resultado.detalles.carta_porte.errores.push({ campo: 'Operador', mensaje: 'Se requiere un operador para Carta Porte', codigo: 'OPERADOR_REQUERIDO' });
      resultado.detalles.carta_porte.valido = false;
    }
    
    if (!facturaData.vehiculo_id) {
      resultado.detalles.carta_porte.errores.push({ campo: 'Vehiculo', mensaje: 'Se requiere un vehículo para Carta Porte', codigo: 'VEHICULO_REQUERIDO' });
      resultado.detalles.carta_porte.valido = false;
    }
    
    if (!facturaData.ubicaciones || facturaData.ubicaciones.length < 2) {
      resultado.detalles.carta_porte.advertencias.push({ campo: 'Ubicaciones', mensaje: 'Se recomienda tener al menos origen y destino para Carta Porte', codigo: 'UBICACIONES_INCOMPLETAS' });
    }
    
    if (resultado.detalles.carta_porte.errores.length > 0) {
      resultado.errores.push(...resultado.detalles.carta_porte.errores);
      resultado.valida = false;
    }
    if (resultado.detalles.carta_porte.advertencias.length > 0) {
      resultado.advertencias.push(...resultado.detalles.carta_porte.advertencias);
    }
  }
  
  // 5. Validar totales
  if (!facturaData.subtotal || facturaData.subtotal <= 0) {
    resultado.errores.push({ campo: 'Subtotal', mensaje: 'El subtotal debe ser mayor a 0', codigo: 'SUBTOTAL_INVALIDO' });
    resultado.valida = false;
  }
  
  if (!facturaData.total || facturaData.total <= 0) {
    resultado.errores.push({ campo: 'Total', mensaje: 'El total debe ser mayor a 0', codigo: 'TOTAL_INVALIDO' });
    resultado.valida = false;
  }
  
  return resultado;
}

module.exports = {
  validarFacturaCompleta,
  validarRFC,
  determinarTipoRFC,
  validarClaveProductoSAT,
  validarClaveUnidadSAT,
  validarRegimenFiscal,
  validarUsoCFDI,
  validarCodigoPostal
};
