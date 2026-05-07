// ===========================================================================
// NEXXO — Motor de Conciliación con Aprendizaje
// Adaptado al schema real: conciliacion_extractos / conciliacion_movimientos
//
// Ubicación destino: src/lib/conciliacion/motorMatching.js
// ===========================================================================

import { supabase } from '../supabase'

// ---------------------------------------------------------------------------
// Constantes y umbrales
// ---------------------------------------------------------------------------
export const UMBRAL_AUTO       = 0.85   // ≥ → estado 'auto'
export const UMBRAL_SUGERENCIA = 0.65   // ≥ → estado 'sugerido'
                                          // <  → estado 'pendiente'

// Mapeo numérico → categórico (para llenar la columna `confianza` text legacy)
function scoreAConfianzaCat(score) {
  if (score >= UMBRAL_AUTO) return 'alta'
  if (score >= UMBRAL_SUGERENCIA) return 'media'
  return 'baja'
}

// Helper: convierte (debito, credito) → (monto, signo)
function debitoCreditoASigno(debito, credito) {
  const deb = parseFloat(debito || 0)
  const cre = parseFloat(credito || 0)
  if (deb > 0) return { monto: deb, signo: 'D' }
  if (cre > 0) return { monto: cre, signo: 'C' }
  return { monto: 0, signo: null }
}

// ---------------------------------------------------------------------------
// 1) NORMALIZACIÓN — esqueletizar el concepto bancario
// ---------------------------------------------------------------------------
/**
 * Toma un concepto bancario crudo y devuelve una versión "normalizada":
 * - mayúsculas
 * - sin números (CUITs, VEPs, IDs)
 * - sin nombres propios capitalizados (Ramon Russo → *)
 * - sin fechas y montos
 */
export function esqueletizar(descripcionRaw) {
  if (!descripcionRaw) return ''

  // 1) Detectar nombres propios (palabras Capitalize seguidas) ANTES de pasar a UPPERCASE
  const rawClean = String(descripcionRaw).replace(/\s+/g, ' ').trim()
  const tokens = rawClean.split(' ')
  const isNombreToken = (tok) => /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(tok)

  let outRaw = []
  let i = 0
  while (i < tokens.length) {
    if (
      isNombreToken(tokens[i]) &&
      i + 1 < tokens.length &&
      isNombreToken(tokens[i + 1])
    ) {
      while (i < tokens.length && isNombreToken(tokens[i])) i++
      outRaw.push('*')
    } else {
      outRaw.push(tokens[i])
      i++
    }
  }
  let s = outRaw.join(' ').toUpperCase()

  // 2) Reemplazar fechas dd/mm/aa o dd-mm-aa
  s = s.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, '*')

  // 3) Reemplazar números largos (cuits, vep, ids) → *
  s = s.replace(/\b\d{6,}\b/g, '*')

  // 4) Reemplazar montos
  s = s.replace(/\b\$?[\d.,]+\b/g, ' ')

  // 5) Colapsar espacios y asteriscos
  s = s.replace(/\s+/g, ' ').replace(/(\*\s*)+/g, '* ').trim()
  return s
}

// ---------------------------------------------------------------------------
// 2) EVALUADOR de reglas individuales
// ---------------------------------------------------------------------------
export function evaluarRegla(regla, movimiento) {
  // Filtros previos
  if (regla.signo_esperado && regla.signo_esperado !== movimiento.signo) {
    return false
  }
  if (regla.monto_min != null && movimiento.monto < parseFloat(regla.monto_min)) {
    return false
  }
  if (regla.monto_max != null && movimiento.monto > parseFloat(regla.monto_max)) {
    return false
  }
  if (
    regla.banco &&
    regla.banco !== '*' &&
    movimiento.banco &&
    regla.banco.toLowerCase() !== movimiento.banco.toLowerCase()
  ) {
    return false
  }

  const desc = (movimiento.descripcion_raw || '').toUpperCase()

  switch (regla.tipo_match) {
    case 'exact':
      return desc.trim() === regla.patron.toUpperCase().trim()

    case 'regex':
      try {
        const r = new RegExp(regla.patron, 'i')
        return r.test(movimiento.descripcion_raw || '')
      } catch (e) {
        console.warn('Regex inválida en regla', regla.id, e.message)
        return false
      }

    case 'contains_all': {
      const kws = regla.patron.split('|').map(k => k.toUpperCase().trim())
      return kws.every(k => desc.includes(k))
    }

    case 'contains_any':
    case 'keywords':
    default: {
      const kws = regla.patron.split('|').map(k => k.toUpperCase().trim())
      return kws.some(k => desc.includes(k))
    }
  }
}

// ---------------------------------------------------------------------------
// 3) NIVEL 3 — Similitud por historial (Jaccard sobre tokens)
// ---------------------------------------------------------------------------
function tokenSet(str) {
  if (!str) return new Set()
  return new Set(
    String(str)
      .toUpperCase()
      .replace(/[^A-ZÁÉÍÓÚÑ\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2)
  )
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const union = a.size + b.size - inter
  return inter / union
}

export async function buscarPorHistorial({ empresaId, descripcionRaw, signo, monto }) {
  const tokens = [...tokenSet(descripcionRaw)].slice(0, 5)
  if (tokens.length === 0) return null

  const queryTokens = tokens.join(' | ')
  const { data: candidatos, error } = await supabase
    .from('historial_conciliaciones')
    .select('id, descripcion_norm, descripcion_raw, cuenta_id, monto, signo')
    .eq('empresa_id', empresaId)
    .eq('signo', signo)
    .textSearch('descripcion_norm', queryTokens, { type: 'websearch', config: 'spanish' })
    .limit(50)

  if (error || !candidatos || candidatos.length === 0) return null

  const setQ = tokenSet(descripcionRaw)
  let mejor = { score: 0, cuenta_id: null, hist_id: null }
  for (const c of candidatos) {
    const setC = tokenSet(c.descripcion_raw)
    const sim = jaccard(setQ, setC)
    const ratioMonto = Math.min(monto, c.monto) / Math.max(monto, c.monto || 1)
    const bonus = ratioMonto > 0.8 ? 0.05 : 0
    const score = Math.min(0.99, sim + bonus)
    if (score > mejor.score) mejor = { score, cuenta_id: c.cuenta_id, hist_id: c.id }
  }
  if (mejor.score >= 0.55) return mejor
  return null
}

// ---------------------------------------------------------------------------
// 4) NIVEL 4 — Fallback Claude API
// ---------------------------------------------------------------------------
export async function clasificarConClaude({ empresaId, movimiento, planCuentas }) {
  if (!import.meta.env.VITE_ANTHROPIC_API_KEY) return null

  const lista = planCuentas
    .map(c => `${c.codigo}: ${c.nombre} (${c.familia})`)
    .join('\n')

  const prompt = `Sos un contador especializado en conciliación bancaria de PyMEs argentinas.
Te paso un movimiento bancario y un plan de cuentas. Devolvé SOLO un JSON con la cuenta más apropiada.

PLAN DE CUENTAS (codigo: nombre - familia):
${lista}

MOVIMIENTO:
- Descripción: "${movimiento.descripcion_raw}"
- Monto: $${movimiento.monto.toLocaleString('es-AR')}
- Signo: ${movimiento.signo === 'D' ? 'Débito (egreso)' : 'Crédito (ingreso)'}
- Banco: ${movimiento.banco || 'desconocido'}

Respondé EXACTAMENTE con este JSON (sin texto extra):
{"codigo":"XXX-NNN","confianza":0.85,"justificacion":"breve"}

Si no estás seguro (confianza < 0.65) devolvé:
{"codigo":null,"confianza":0,"justificacion":"texto"}`

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    const txt = data.content?.[0]?.text?.trim() || ''
    const json = JSON.parse(txt)
    if (!json.codigo || json.confianza < UMBRAL_SUGERENCIA) return null

    const cuenta = planCuentas.find(c => c.codigo === json.codigo)
    if (!cuenta) return null
    return {
      cuenta_id: cuenta.id,
      score: Math.min(0.95, json.confianza),
      justificacion: json.justificacion,
    }
  } catch (e) {
    console.warn('Claude fallback falló:', e.message)
    return null
  }
}

// ---------------------------------------------------------------------------
// 5) MOTOR PRINCIPAL — clasificar un movimiento aplicando la cascada
// ---------------------------------------------------------------------------
export async function clasificarMovimiento(ctx, mov) {
  const { empresaId, reglasEmpresa, reglasGlobales, planCuentas, usarLLM = true } = ctx

  const resolverCuenta = (regla) => {
    if (regla.cuenta_destino_id) return regla.cuenta_destino_id
    if (regla.cuenta_global_id) {
      const cta = planCuentas.find(c => c.cuenta_global_id === regla.cuenta_global_id)
      return cta?.id || null
    }
    return null
  }

  // ---- NIVEL 1: reglas de empresa ----
  const ordenEmp = [...reglasEmpresa].sort(
    (a, b) => (a.prioridad || 100) - (b.prioridad || 100)
  )
  for (const r of ordenEmp) {
    if (!r.activo) continue
    if (evaluarRegla(r, mov)) {
      const cuenta_id = resolverCuenta(r)
      if (!cuenta_id) continue
      const score = parseFloat(r.confianza)
      const estado = score >= UMBRAL_AUTO ? 'auto' : 'sugerido'
      return {
        cuenta_id,
        score,
        fuente_match: 'regla_empresa',
        regla_id: r.id,
        estado,
      }
    }
  }

  // ---- NIVEL 2: reglas globales ----
  const ordenGlb = [...reglasGlobales].sort(
    (a, b) => (a.prioridad || 100) - (b.prioridad || 100)
  )
  for (const r of ordenGlb) {
    if (!r.activo) continue
    if (evaluarRegla(r, mov)) {
      const cuenta_id = resolverCuenta(r)
      if (!cuenta_id) continue
      const score = parseFloat(r.confianza)
      const estado = score >= UMBRAL_AUTO ? 'auto' : 'sugerido'
      return {
        cuenta_id,
        score,
        fuente_match: 'regla_global',
        regla_id: r.id,
        estado,
      }
    }
  }

  // ---- NIVEL 3: similitud por historial ----
  const hist = await buscarPorHistorial({
    empresaId,
    descripcionRaw: mov.descripcion_raw,
    signo: mov.signo,
    monto: mov.monto,
  })
  if (hist && hist.score >= UMBRAL_SUGERENCIA) {
    const estado = hist.score >= UMBRAL_AUTO ? 'auto' : 'sugerido'
    return {
      cuenta_id: hist.cuenta_id,
      score: hist.score,
      fuente_match: 'similitud_historia',
      regla_id: null,
      estado,
    }
  }

  // ---- NIVEL 4: Claude ----
  if (usarLLM) {
    const llm = await clasificarConClaude({ empresaId, movimiento: mov, planCuentas })
    if (llm && llm.score >= UMBRAL_SUGERENCIA) {
      const estado = llm.score >= UMBRAL_AUTO ? 'auto' : 'sugerido'
      return {
        cuenta_id: llm.cuenta_id,
        score: llm.score,
        fuente_match: 'llm',
        regla_id: null,
        estado,
      }
    }
  }

  // ---- PENDIENTE ----
  return {
    cuenta_id: null,
    score: 0,
    fuente_match: null,
    regla_id: null,
    estado: 'pendiente',
  }
}

// ---------------------------------------------------------------------------
// 6) Carga inicial de contexto
// ---------------------------------------------------------------------------
export async function cargarContextoConciliacion(empresaId) {
  // 1) Plan de cuentas de la empresa con familia y mapeo a global
  const { data: ctas, error: e1 } = await supabase
    .from('cuentas_contables')
    .select(`
      id, codigo, nombre, cuenta_global_id, activo,
      familia:familias_conciliacion!inner(codigo, nombre)
    `)
    .eq('empresa_id', empresaId)
    .eq('activo', true)
  if (e1) throw e1

  const planCuentas = (ctas || []).map(c => ({
    id: c.id,
    codigo: c.codigo,
    nombre: c.nombre,
    familia: c.familia?.codigo || '',
    cuenta_global_id: c.cuenta_global_id,
  }))

  // 2) Reglas empresa
  const { data: rEmp, error: e2 } = await supabase
    .from('reglas_conciliacion')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
  if (e2) throw e2

  // 3) Reglas globales
  const { data: rGlob, error: e3 } = await supabase
    .from('reglas_conciliacion')
    .select('*')
    .is('empresa_id', null)
    .eq('activo', true)
  if (e3) throw e3

  return {
    empresaId,
    planCuentas,
    reglasEmpresa: rEmp || [],
    reglasGlobales: rGlob || [],
  }
}

// ---------------------------------------------------------------------------
// 7) Aplicar a un lote (procesa todos los pendientes de un extracto)
// ---------------------------------------------------------------------------
/**
 * Toma todos los movimientos del extracto en estado 'pendiente'
 * y les aplica el motor de cascada.
 *
 * @param {string} extractoId - ID de conciliacion_extractos
 * @param {object} options - { usarLLM: bool }
 * @returns {object} { auto, sug, pend, total }
 */
export async function clasificarExtracto(extractoId, { usarLLM = true } = {}) {
  // Traer el extracto con la empresa
  const { data: ext, error: eC } = await supabase
    .from('conciliacion_extractos')
    .select('id, empresa_id, banco')
    .eq('id', extractoId)
    .single()
  if (eC) throw eC

  const ctx = await cargarContextoConciliacion(ext.empresa_id)
  ctx.usarLLM = usarLLM

  // Movimientos pendientes
  const { data: movs, error: eM } = await supabase
    .from('conciliacion_movimientos')
    .select('id, descripcion_raw, debito, credito')
    .eq('extracto_id', extractoId)
    .eq('estado', 'pendiente')
  if (eM) throw eM

  let auto = 0, sug = 0, pend = 0

  for (const m of movs || []) {
    const { monto, signo } = debitoCreditoASigno(m.debito, m.credito)
    if (!signo) {
      pend++
      continue
    }

    const movInput = {
      descripcion_raw: m.descripcion_raw,
      monto,
      signo,
      banco: ext.banco,
    }

    const r = await clasificarMovimiento(ctx, movInput)

    // Buscar el código y nombre de la cuenta para denormalizar
    let cuentaCodigo = null, cuentaFamilia = null
    if (r.cuenta_id) {
      const cta = ctx.planCuentas.find(c => c.id === r.cuenta_id)
      if (cta) {
        cuentaCodigo = `${cta.codigo} ${cta.nombre}`
        cuentaFamilia = cta.familia
      }
    }

    // Update individual (en producción se podría batchear)
    await supabase
      .from('conciliacion_movimientos')
      .update({
        cuenta_id: r.cuenta_id,
        regla_id: r.regla_id,
        score: r.score,
        estado: r.estado,
        cuenta_nombre: cuentaCodigo,
        cuenta_familia: cuentaFamilia,
        confianza: scoreAConfianzaCat(r.score),
        metodo_clasificacion: r.fuente_match,
        descripcion_normalizada: esqueletizar(m.descripcion_raw),
      })
      .eq('id', m.id)

    if (r.estado === 'auto') auto++
    else if (r.estado === 'sugerido') sug++
    else pend++
  }

  return { auto, sug, pend, total: (movs || []).length }
}

// ---------------------------------------------------------------------------
// 8) APRENDIZAJE — al validar/rechazar
// ---------------------------------------------------------------------------
export async function registrarValidacion({
  movimientoId,
  cuentaIdFinal,
  cuentaIdSugerida,
  reglaId,
  fuenteMatch,
  userId,
}) {
  const acertoRegla = reglaId && cuentaIdFinal === cuentaIdSugerida

  // 1) Update movimiento → 'validado'
  const { data: mov, error: eM } = await supabase
    .from('conciliacion_movimientos')
    .update({
      cuenta_id: cuentaIdFinal,
      estado: 'validado',
      validado: true,
      validado_por: userId,
      validado_at: new Date().toISOString(),
    })
    .eq('id', movimientoId)
    .select('*, extracto:conciliacion_extractos(empresa_id)')
    .single()
  if (eM) throw eM

  const empresaId = mov.extracto?.empresa_id
  const { monto, signo } = debitoCreditoASigno(mov.debito, mov.credito)

  // 2) Si había regla, sumar acierto/fallo
  if (reglaId) {
    if (acertoRegla) {
      await supabase.rpc('rpc_regla_inc_acierto', { p_regla: reglaId })
    } else {
      await supabase.rpc('rpc_regla_inc_fallo', { p_regla: reglaId })
    }
  } else if (fuenteMatch && fuenteMatch !== 'manual' && cuentaIdFinal) {
    // venía de similitud o LLM y se confirmó → considerar crear regla candidata
    await crearReglaCandidata({
      empresaId,
      descripcionRaw: mov.descripcion_raw,
      signo,
      cuentaId: cuentaIdFinal,
      userId,
    })
  } else if (!fuenteMatch && cuentaIdFinal) {
    // era pendiente puro y se cargó manual → crear regla candidata
    await crearReglaCandidata({
      empresaId,
      descripcionRaw: mov.descripcion_raw,
      signo,
      cuentaId: cuentaIdFinal,
      userId,
    })
  }

  // 3) Insertar en historial (ground-truth)
  if (empresaId && cuentaIdFinal) {
    await supabase.from('historial_conciliaciones').insert({
      empresa_id: empresaId,
      movimiento_id: mov.id,
      descripcion_raw: mov.descripcion_raw,
      descripcion_norm: esqueletizar(mov.descripcion_raw),
      monto,
      signo,
      cuenta_id: cuentaIdFinal,
      fuente_match: fuenteMatch || 'manual',
      regla_id: reglaId,
      score: mov.score,
      validado_by: userId,
    })
  }

  return mov
}

/**
 * Crea una regla candidata a partir de una conciliación manual.
 * Si ya existe regla con mismo patrón normalizado, refuerza confianza.
 */
async function crearReglaCandidata({ empresaId, descripcionRaw, signo, cuentaId, userId }) {
  if (!empresaId || !cuentaId) return

  const norm = esqueletizar(descripcionRaw)
  if (!norm || norm.length < 4) return

  const tokens = norm
    .split(' ')
    .filter(t => t.length > 2 && t !== '*')
    .slice(0, 4)
  if (tokens.length === 0) return

  const patron = tokens.join('|')

  const { data: existe } = await supabase
    .from('reglas_conciliacion')
    .select('id, confianza, hits')
    .eq('empresa_id', empresaId)
    .eq('cuenta_destino_id', cuentaId)
    .eq('patron', patron)
    .maybeSingle()

  if (existe) {
    await supabase
      .from('reglas_conciliacion')
      .update({
        confianza: Math.min(0.97, parseFloat(existe.confianza) + 0.05),
        hits: (existe.hits || 0) + 1,
      })
      .eq('id', existe.id)
  } else {
    await supabase.from('reglas_conciliacion').insert({
      empresa_id: empresaId,
      tipo_match: 'keywords',
      patron,
      signo_esperado: signo,
      cuenta_destino_id: cuentaId,
      confianza: 0.6,
      prioridad: 50,
      fuente: 'aprendida',
      created_by: userId,
    })
  }
}

// ---------------------------------------------------------------------------
// 9) HELPERS para la UI
// ---------------------------------------------------------------------------

/**
 * Resume el estado actual de un extracto (cuántos auto/sug/pend/validados).
 */
export async function resumenExtracto(extractoId) {
  const { data, error } = await supabase
    .from('conciliacion_movimientos')
    .select('estado')
    .eq('extracto_id', extractoId)
  if (error) throw error

  const counts = { pendiente: 0, sugerido: 0, auto: 0, validado: 0, atipico: 0, total: 0 }
  for (const m of data || []) {
    counts[m.estado || 'pendiente'] = (counts[m.estado || 'pendiente'] || 0) + 1
    counts.total++
  }
  counts.pct_completado = counts.total
    ? Math.round(((counts.auto + counts.validado) / counts.total) * 100)
    : 0
  return counts
}

/**
 * Valida en lote todos los movimientos en estado 'auto' de un extracto.
 * Útil para el botón "Aprobar todos los AUTO".
 */
export async function validarTodosAuto(extractoId, userId) {
  const { data: movs, error } = await supabase
    .from('conciliacion_movimientos')
    .select('id, cuenta_id, regla_id, metodo_clasificacion')
    .eq('extracto_id', extractoId)
    .eq('estado', 'auto')
  if (error) throw error

  let validados = 0
  for (const m of movs || []) {
    await registrarValidacion({
      movimientoId: m.id,
      cuentaIdFinal: m.cuenta_id,
      cuentaIdSugerida: m.cuenta_id,
      reglaId: m.regla_id,
      fuenteMatch: m.metodo_clasificacion,
      userId,
    })
    validados++
  }
  return { validados }
}
