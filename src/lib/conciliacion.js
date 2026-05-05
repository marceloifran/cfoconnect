import { calcularTotalesFamilia } from './categoriasConciliacion'

export async function cerrarExtracto(extractoId, supabase) {
  // 1. Validar que no hay pendientes
  const { data: movimientos } = await supabase
    .from('conciliacion_movimientos')
    .select('*')
    .eq('extracto_id', extractoId)

  const pendientes = movimientos.filter(m => !m.validado && m.confianza !== 'alta')
  if (pendientes.length > 0) {
    throw new Error(`Quedan ${pendientes.length} movimientos pendientes de validación`)
  }

  // 2. Validar que el saldo cuadra
  const { data: extracto } = await supabase
    .from('conciliacion_extractos')
    .select('saldo_inicial, saldo_final, empresa_id')
    .eq('id', extractoId)
    .single()

  const creditos = movimientos.reduce((acc, m) => acc + (m.credito || 0), 0)
  const debitos = movimientos.reduce((acc, m) => acc + (m.debito || 0), 0)
  
  const saldoCalculado = extracto.saldo_inicial + creditos - debitos
  const diferencia = Math.abs(saldoCalculado - extracto.saldo_final)
  
  if (diferencia > 1) {
    throw new Error(`El saldo no cuadra. Diferencia de $${diferencia}`)
  }

  // 3. Calcular totales por familia
  const totalesFamilia = calcularTotalesFamilia(movimientos)

  // 4. Actualizar estado del extracto
  await supabase
    .from('conciliacion_extractos')
    .update({ 
      estado: 'cerrado', 
      total_creditos: creditos,
      total_debitos: debitos,
      updated_at: new Date().toISOString() 
    })
    .eq('id', extractoId)

  // 5. Guardar en periodos_financieros (mock for now, we can insert or update)
  // We'll skip the actual periodos_financieros insert for this module as it might not exist yet,
  // but we can log it or create a placeholder if the table exists.
}
