// src/lib/clasificador.js

export async function clasificarMovimientos(movimientos, empresaId, supabase) {
  // 1. Cargar reglas globales
  const { data: reglas } = await supabase
    .from('conciliacion_reglas_globales')
    .select('*')
    .eq('activo', true)
    .order('prioridad', { ascending: false })

  // 2. Cargar memoria privada de la empresa
  const { data: memoriaPrivada } = await supabase
    .from('conciliacion_memoria_privada')
    .select('*')
    .eq('empresa_id', empresaId)

  // 3. Clasificar cada movimiento en cascada
  return movimientos.map(mov => clasificarMovimiento(mov, reglas || [], memoriaPrivada || []))
}

function clasificarMovimiento(mov, reglas, memoriaPrivada) {
  // CAPA A: Reglas predefinidas NEXXO
  const porRegla = aplicarReglas(mov, reglas)
  if (porRegla) return { ...mov, ...porRegla, confianza: 'alta', metodo_clasificacion: 'regla_nexxo' }

  // CAPA B: Memoria privada de la empresa (frecuencia >= 3 -> alta, 1-2 -> media)
  const porMemoriaPrivada = buscarEnMemoria(mov, memoriaPrivada)
  if (porMemoriaPrivada) {
    const confianza = porMemoriaPrivada.frecuencia_uso >= 3 ? 'alta' : 'media'
    return { ...mov, ...porMemoriaPrivada, confianza, metodo_clasificacion: 'memoria_privada' }
  }

  // Sin clasificación -> pendiente manual
  return { ...mov, confianza: 'baja', metodo_clasificacion: null }
}

function aplicarReglas(mov, reglas) {
  const desc = mov.descripcion_raw?.toUpperCase() || ''
  for (const regla of reglas) {
    let match = false
    if (regla.tipo_match === 'contiene')     match = desc.includes(regla.patron.toUpperCase())
    if (regla.tipo_match === 'comienza_con') match = desc.startsWith(regla.patron.toUpperCase())
    if (regla.tipo_match === 'exacto')       match = desc === regla.patron.toUpperCase()
    if (regla.tipo_match === 'regex')        match = new RegExp(regla.patron, 'i').test(desc)
    if (match) return { cuenta_nombre: regla.cuenta_nombre, cuenta_familia: regla.cuenta_familia }
  }
  return null
}

function buscarEnMemoria(mov, memoria) {
  // Buscar por CUIT primero (más específico)
  if (mov.contraparte_cuit) {
    const porCuit = memoria.find(m => m.identificador === mov.contraparte_cuit && m.tipo === 'cuit')
    if (porCuit) return porCuit
  }
  // Buscar por leyenda normalizada
  const desc = mov.descripcion_normalizada?.toLowerCase()
  if (desc) {
    const porLeyenda = memoria.find(m => desc.includes(m.identificador.toLowerCase()) && m.tipo === 'leyenda')
    if (porLeyenda) return porLeyenda
  }
  return null
}

export async function aprenderDeValidacion(movimiento, empresaId, usuarioId, supabase) {
  const identificadores = []

  // Aprender del CUIT si existe
  if (movimiento.contraparte_cuit) {
    identificadores.push({ tipo: 'cuit', identificador: movimiento.contraparte_cuit })
  }

  // Aprender de la descripción normalizada
  if (movimiento.descripcion_normalizada) {
    identificadores.push({ tipo: 'leyenda', identificador: movimiento.descripcion_normalizada })
  }

  for (const id of identificadores) {
    await supabase
      .from('conciliacion_memoria_privada')
      .upsert({
        empresa_id: empresaId,
        identificador: id.identificador,
        tipo: id.tipo,
        cuenta_nombre: movimiento.cuenta_nombre,
        cuenta_familia: movimiento.cuenta_familia,
        creado_por: usuarioId,
        ultima_actualizacion: new Date().toISOString()
      }, {
        onConflict: 'empresa_id,identificador',
        ignoreDuplicates: false
      })

    // Incrementar frecuencia via RPC (the sql is to be executed by user)
    await supabase.rpc('incrementar_frecuencia_privada', {
      p_empresa_id: empresaId,
      p_identificador: id.identificador
    })
  }
}
