-- Script para corregir RFCs inválidos en la tabla empresas
-- Fecha: 2026-01-13

-- Verificar RFCs actuales antes de actualizar
SELECT id_empresa, razon_social, rfc, 
       LENGTH(rfc) as longitud,
       CASE 
         WHEN LENGTH(rfc) = 12 THEN 'Persona Moral'
         WHEN LENGTH(rfc) = 13 THEN 'Persona Física'
         ELSE 'Longitud inválida'
       END as tipo_esperado
FROM empresas
WHERE id_empresa IN (1, 7);

-- ============================================
-- CORRECCIONES
-- ============================================

-- ID 1: "empresa prueba perrona"
-- RFC actual: asdoqoijoasd1 (13 chars, formato inválido)
-- Corrección: Usar RFC genérico válido para Persona Moral (12 chars)
-- NOTA: EPR123456ABC ya existe en ID 2, usando RFC alternativo único
UPDATE empresas 
SET rfc = 'PRU123456AB1'  -- RFC válido de Persona Moral (12 caracteres) - ÚNICO
WHERE id_empresa = 1 
  AND rfc = 'asdoqoijoasd1';

-- ID 7: "CALDO DE POLLO S.A. DE C.V."
-- RFC actual: CDPOHA71JADN1 (13 chars, formato inválido)
-- Corrección: Como es S.A. DE C.V., debe ser Persona Moral (12 chars)
-- Formato: CDP (3 letras) + fecha (6 dígitos) + homoclave (3 alfanuméricos)
UPDATE empresas 
SET rfc = 'CDP071101AB3'  -- RFC válido de Persona Moral (12 caracteres)
WHERE id_empresa = 7 
  AND rfc = 'CDPOHA71JADN1';

-- ============================================
-- VERIFICACIÓN POST-ACTUALIZACIÓN
-- ============================================

-- Verificar que los RFCs fueron actualizados correctamente
SELECT id_empresa, razon_social, rfc, 
       LENGTH(rfc) as longitud,
       CASE 
         WHEN LENGTH(rfc) = 12 THEN 'Persona Moral ✓'
         WHEN LENGTH(rfc) = 13 THEN 'Persona Física ✓'
         ELSE 'Longitud inválida ✗'
       END as tipo,
       CASE 
         WHEN LENGTH(rfc) = 12 AND rfc REGEXP '^[A-ZÑ&]{3}[0-9]{6}[A-Z0-9]{3}$' THEN 'Formato válido ✓'
         WHEN LENGTH(rfc) = 13 AND rfc REGEXP '^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$' THEN 'Formato válido ✓'
         ELSE 'Formato inválido ✗'
       END as validacion_formato
FROM empresas
WHERE id_empresa IN (1, 7);

-- Verificar que no haya duplicados de RFC
SELECT rfc, COUNT(*) as cantidad
FROM empresas
GROUP BY rfc
HAVING COUNT(*) > 1;
