// src/lib/conciliacion.js

export async function cerrarExtracto(extractoId, supabase) {
  // 1. Validar que no hay pendientes
  const { count } = await supabase
    .from('conciliacion_movimientos')
    .select('id', { count: 'exact' })
    .eq('extracto_id', extractoId)
    .eq('validado', false)
    .neq('confianza', 'alta')

  if (count > 0) throw new Error(`Quedan ${count} movimientos pendientes de validación`)

  // 2. Validar que el saldo cuadra
  const { data: extracto } = await supabase
    .from('conciliacion_extractos')
    .select('saldo_inicial, saldo_final, total_creditos, total_debitos, empresa_id')
    .eq('id', extractoId)
    .single()

  const saldoCalculado = extracto.saldo_inicial + extracto.total_creditos - extracto.total_debitos
  const diferencia = Math.abs(saldoCalculado - extracto.saldo_final)
  if (diferencia > 1) {
    throw new Error('El saldo no cuadra. Revisar movimientos.')
  }

  // 3. Construir el EERR de gestión
  await construirEERR(extractoId, supabase)

  // 4. Actualizar estado del extracto
  await supabase
    .from('conciliacion_extractos')
    .update({ estado: 'cerrado', updated_at: new Date().toISOString() })
    .eq('id', extractoId)

  // 5. Fake notification
}

async function construirEERR(extractoId, supabase) {
  // Agrupar movimientos por familia funcional
  const { data: movimientos } = await supabase
    .from('conciliacion_movimientos')
    .select('cuenta_familia, cuenta_nombre, debito, credito')
    .eq('extracto_id', extractoId)

  const eerr = {
    ingresos_operativos: 0,
    costos_directos: 0,
    gastos_operativos: 0,
    resultado_financiero: 0,
    cargas_tributarias: 0,
    cargas_bancarias: 0
  }

  const FAMILIA_MAP = {
    'Ingresos operativos': 'ingresos_operativos',
    'Pagos a proveedores': 'costos_directos',
    'Estructura': 'gastos_operativos',
    'Movimientos financieros': 'resultado_financiero',
    'Cargas tributarias': 'cargas_tributarias',
    'Cargas bancarias': 'cargas_bancarias'
  }

  for (const mov of movimientos) {
    const campo = FAMILIA_MAP[mov.cuenta_familia]
    if (campo) {
      eerr[campo] += (mov.credito || 0) - (mov.debito || 0)
    }
  }

  // Guardar en periodos_financieros logic goes here
}
