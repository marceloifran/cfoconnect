// src/lib/parsers/galiciaParser.js

export async function parseGaliciaPDF(file) {
  // 1. Leer el PDF como ArrayBuffer
  // 2. Extraer texto plano
  // 3. Detectar sección de movimientos
  // 4. Parsear línea por línea agrupando movimientos multilínea
  // 5. Normalizar montos y fechas
  // 6. Extraer header con datos de cuenta
  // 7. Validar coherencia: saldo_final = saldo_inicial + Σcréditos - Σdébitos
  // 8. Retornar { header, movimientos, validacion }

  return {
    banco: 'galicia',
    cuenta_numero: '',
    cuenta_tipo: 'cta_cte_pesos',
    periodo_desde: '',
    periodo_hasta: '',
    saldo_inicial: 0,
    saldo_final: 0,
    total_creditos: 0,
    total_debitos: 0,
    movimientos: [],
    validacion: {
      saldos_cuadran: true,
      diferencia: 0,
      movimientos_extraidos: 0
    }
  }
}
