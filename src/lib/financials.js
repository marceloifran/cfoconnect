/**
 * Cálculos financieros centralizados.
 * Todas las fórmulas del Pilar 1 viven acá.
 * Los componentes solo muestran — nunca calculan.
 */

export function calcRatios(fin) {
  if (!fin) return null

  const {
    ventas_netas = 0,
    costo_ventas = 0,
    gastos_comerciales = 0,
    gastos_admin = 0,
    gastos_personal = 0,
    amortizaciones = 0,
    resultado_financiero = 0,
    activo_corriente = 0,
    pasivo_corriente = 0,
    stock = 0,
    deuda_total = 0,
    patrimonio_neto = 0,
    intereses_pagados = 0,
    dias_cobro = 0,
    dias_stock = 0,
    dias_pago = 0,
  } = fin

  const utilidad_bruta = ventas_netas - costo_ventas
  const ebitda = utilidad_bruta - gastos_comerciales - gastos_admin - gastos_personal
  const ebit = ebitda - amortizaciones
  const resultado_neto = ebit + resultado_financiero

  const margen_bruto = ventas_netas ? utilidad_bruta / ventas_netas : 0
  const margen_ebitda = ventas_netas ? ebitda / ventas_netas : 0
  const margen_neto = ventas_netas ? resultado_neto / ventas_netas : 0

  const liquidez_corriente = pasivo_corriente ? activo_corriente / pasivo_corriente : 0
  const liquidez_acida = pasivo_corriente ? (activo_corriente - stock) / pasivo_corriente : 0
  const capital_trabajo = activo_corriente - pasivo_corriente

  const leverage = patrimonio_neto ? deuda_total / patrimonio_neto : 0
  const cobertura_intereses = intereses_pagados ? ebitda / intereses_pagados : 0
  const deuda_ebitda = ebitda ? deuda_total / ebitda : 0
  const costo_financiero_real = deuda_total ? intereses_pagados / deuda_total : 0

  const cce = dias_cobro + dias_stock - dias_pago

  return {
    // P&L
    utilidad_bruta,
    ebitda,
    ebit,
    resultado_neto,
    // Márgenes
    margen_bruto,
    margen_ebitda,
    margen_neto,
    // Liquidez
    liquidez_corriente,
    liquidez_acida,
    capital_trabajo,
    // Deuda
    leverage,
    cobertura_intereses,
    deuda_ebitda,
    costo_financiero_real,
    // Ciclo
    cce,
  }
}

export function calcSemaforo(ratios) {
  if (!ratios) return {}

  return {
    rentabilidad: semRentabilidad(ratios.margen_ebitda),
    liquidez: semLiquidez(ratios.liquidez_corriente),
    endeudamiento: semLeverage(ratios.leverage),
    ciclo_caja: semCCE(ratios.cce),
    cobertura: semCobertura(ratios.cobertura_intereses),
  }
}

function semRentabilidad(m) {
  if (m >= 0.15) return { color: 'green', label: 'Saludable', desc: `Margen EBITDA ${pct(m)}` }
  if (m >= 0.08) return { color: 'amber', label: 'Precaución', desc: `Margen EBITDA ${pct(m)}` }
  return { color: 'red', label: 'Crítico', desc: `Margen EBITDA ${pct(m)} — bajo umbral` }
}
function semLiquidez(l) {
  if (l >= 1.5) return { color: 'green', label: 'Saludable', desc: `Liquidez ${l.toFixed(2)}x` }
  if (l >= 1.0) return { color: 'amber', label: 'Ajustada', desc: `Liquidez ${l.toFixed(2)}x` }
  return { color: 'red', label: 'Riesgo alto', desc: `Liquidez ${l.toFixed(2)}x — insuficiente` }
}
function semLeverage(lev) {
  if (lev < 1.5) return { color: 'green', label: 'Conservador', desc: `Leverage ${lev.toFixed(2)}x` }
  if (lev < 3.0) return { color: 'amber', label: 'Razonable', desc: `Leverage ${lev.toFixed(2)}x` }
  return { color: 'red', label: 'Elevado', desc: `Leverage ${lev.toFixed(2)}x — precaución` }
}
function semCCE(cce) {
  if (cce < 30) return { color: 'green', label: 'Eficiente', desc: `CCE ${cce} días` }
  if (cce < 60) return { color: 'amber', label: 'Moderado', desc: `CCE ${cce} días` }
  return { color: 'red', label: 'Largo', desc: `CCE ${cce} días — necesita financiamiento` }
}
function semCobertura(c) {
  if (!c || c === Infinity) return { color: 'gray', label: 'Sin datos', desc: 'Sin deuda financiera' }
  if (c >= 3) return { color: 'green', label: 'Holgada', desc: `Cobertura ${c.toFixed(1)}x` }
  if (c >= 1.5) return { color: 'amber', label: 'Ajustada', desc: `Cobertura ${c.toFixed(1)}x` }
  return { color: 'red', label: 'Insuficiente', desc: `Cobertura ${c.toFixed(1)}x` }
}

// ── Formateo ─────────────────────────────────────────────────────────────────
export const pct = (n, dec = 1) =>
  n == null ? '—' : `${(n * 100).toFixed(dec)}%`

export const ars = (n) => {
  if (n == null) return '—'
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(n) >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString('es-AR')}`
}

export const ratio = (n, dec = 2, suffix = 'x') =>
  n == null ? '—' : `${n.toFixed(dec)}${suffix}`

export const days = (n) =>
  n == null ? '—' : `${Math.round(n)} días`
