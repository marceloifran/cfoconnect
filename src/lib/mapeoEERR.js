const MAPEO_RUBROS = {
  // Ingresos
  'ventas': 'ingresos_operativos',
  'ventas netas': 'ingresos_operativos',
  'ingresos por servicios': 'ingresos_operativos',
  'ingresos operativos': 'ingresos_operativos',

  // Costos
  'costo de ventas': 'costos_directos',
  'costo de mercaderías': 'costos_directos',
  'cmv': 'costos_directos',
  'costo de producción': 'costos_directos',

  // Gastos operativos
  'gastos de administración': 'gastos_operativos',
  'gastos generales': 'gastos_operativos',
  'gastos de comercialización': 'gastos_operativos',
  'sueldos y cargas sociales': 'gastos_operativos',
  'honorarios': 'gastos_operativos',
  'alquileres': 'gastos_operativos',

  // Resultado financiero
  'resultado financiero': 'resultado_financiero',
  'intereses ganados': 'resultado_financiero',
  'diferencia de cambio': 'resultado_financiero',
  'comisiones bancarias': 'cargas_bancarias',

  // Tributario
  'impuesto a las ganancias': 'cargas_tributarias',
  'ingresos brutos': 'cargas_tributarias',
  'impuestos y tasas': 'cargas_tributarias',
}

export function mapearRubro(rubroOriginal) {
  const clave = rubroOriginal.toLowerCase().trim()
  // Búsqueda exacta
  if (MAPEO_RUBROS[clave]) return MAPEO_RUBROS[clave]
  // Búsqueda parcial (si contiene la palabra clave)
  for (const [patron, familia] of Object.entries(MAPEO_RUBROS)) {
    if (clave.includes(patron)) return familia
  }
  // Sin mapeo -> queda como 'sin_clasificar' para revisión manual
  return 'sin_clasificar'
}
