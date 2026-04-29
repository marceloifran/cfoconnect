/**
 * informeNexxo.js
 * Lógica de negocio del Informe NEXXO.
 * Funciones puras: sin estado React, sin llamadas a Claude.
 * Las queries usan el cliente anon respetando RLS.
 */

import { supabase } from './supabase.js'
import { calcRatios } from './financials.js'

// ── Helpers internos ─────────────────────────────────────────────────

const n = v => Number(v) || 0

/** Devuelve true si el objeto JSONB existe, no es null y tiene al menos una clave */
function noVacio(obj) {
  return obj != null && typeof obj === 'object' && Object.keys(obj).length > 0
}

/** Parsea el campo notas (string JSON) de periodos_financieros */
function parseNotas(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return {} }
}

// ── Mapa de checks ───────────────────────────────────────────────────

const CHECKS_META = [
  { key: 'balance',             label: 'Balance subido y analizado'         },
  { key: 'cuestionario_cliente', label: 'Encuesta del cliente completada'    },
  { key: 'alma_empresa',        label: 'Alma de la empresa (5 dimensiones)' },
  { key: 'mapa_capital',        label: 'Mapa de capital (scoring SGR)'      },
]

// ════════════════════════════════════════════════════════════════════
// FUNCIÓN 1 — checkPrerequisitesInformeNexxo
// ════════════════════════════════════════════════════════════════════

/**
 * Valida que las 4 etapas estén completas antes de permitir
 * la generación del Informe NEXXO.
 *
 * @param {string} empresaId
 * @returns {Promise<{
 *   puedeGenerar: boolean,
 *   checks: Record<string, boolean>,
 *   faltantes: string[],
 *   referencias: { periodo_id, alma_id, scoring_id }
 * }>}
 */
export async function checkPrerequisitesInformeNexxo(empresaId) {
  const vacio = {
    puedeGenerar: false,
    checks: Object.fromEntries(CHECKS_META.map(c => [c.key, false])),
    faltantes: CHECKS_META.map(c => c.label),
    referencias: { periodo_id: null, alma_id: null, scoring_id: null },
  }

  if (!empresaId) return vacio

  // Cargar las 4 fuentes en paralelo
  const [empRes, periRes, almaRes, sgrRes] = await Promise.all([
    supabase
      .from('empresas')
      .select('balance_subido_por_cliente, encuesta_completada')
      .eq('id', empresaId)
      .single(),

    supabase
      .from('periodos_financieros')
      .select('id, periodo')
      .eq('empresa_id', empresaId)
      .order('periodo', { ascending: false })
      .limit(1),

    supabase
      .from('diagnostico_profundo')
      .select('id, estado, dimension1, dimension2, dimension3, dimension4, dimension5')
      .eq('empresa_id', empresaId)
      .maybeSingle(),

    supabase
      .from('scoring_sgr')
      .select('id, score_total, categoria')
      .eq('empresa_id', empresaId)
      .maybeSingle(),
  ])

  const empresa  = empRes.data
  const periodos = periRes.data  || []
  const alma     = almaRes.data
  const scoring  = sgrRes.data

  const ultimoPeriodo = periodos[0] ?? null

  // Evaluar cada condición
  const checks = {
    // a) balance: flag en empresas + al menos un período financiero cargado
    balance: !!(
      empresa?.balance_subido_por_cliente === true &&
      ultimoPeriodo !== null
    ),

    // b) cuestionario_cliente: flag en empresas
    cuestionario_cliente: empresa?.encuesta_completada === true,

    // c) alma_empresa: diagnostico_profundo completo con las 5 dimensiones no vacías
    alma_empresa: !!(
      alma &&
      alma.estado === 'completo' &&
      noVacio(alma.dimension1) &&
      noVacio(alma.dimension2) &&
      noVacio(alma.dimension3) &&
      noVacio(alma.dimension4) &&
      noVacio(alma.dimension5)
    ),

    // d) mapa_capital: scoring_sgr con score_total calculado
    mapa_capital: scoring?.score_total != null,
  }

  const faltantes = CHECKS_META
    .filter(c => !checks[c.key])
    .map(c => c.label)

  const referencias = {
    periodo_id: ultimoPeriodo?.id ?? null,
    alma_id:    alma?.id          ?? null,
    scoring_id: scoring?.id       ?? null,
  }

  return {
    puedeGenerar: faltantes.length === 0,
    checks,
    faltantes,
    referencias,
  }
}

// ════════════════════════════════════════════════════════════════════
// FUNCIÓN 2 — armarInputsParaPrompt
// ════════════════════════════════════════════════════════════════════

/**
 * Recolecta y normaliza los datos de las 4 fuentes.
 * Devuelve un objeto listo para serializar e inyectar en el prompt.
 *
 * @param {string} empresaId
 * @param {{ periodo_id, alma_id, scoring_id }} referencias
 * @returns {Promise<object>} inputs normalizados
 */
export async function armarInputsParaPrompt(empresaId, referencias) {
  const { periodo_id, alma_id, scoring_id } = referencias

  const [empRes, perRes, almaRes, sgrRes] = await Promise.all([
    supabase
      .from('empresas')
      .select('nombre, cuit, rubro, provincia, localidad, plan_servicio, etapa_numero')
      .eq('id', empresaId)
      .single(),

    supabase
      .from('periodos_financieros')
      .select('*')
      .eq('id', periodo_id)
      .single(),

    supabase
      .from('diagnostico_profundo')
      .select('dimension1, dimension2, dimension3, dimension4, dimension5')
      .eq('id', alma_id)
      .single(),

    supabase
      .from('scoring_sgr')
      .select('*')
      .eq('id', scoring_id)
      .single(),
  ])

  const empresa = empRes.data  || {}
  const periodo = perRes.data  || {}
  const alma    = almaRes.data || {}
  const sgr     = sgrRes.data  || {}

  const notas  = parseNotas(periodo.notas)
  const ratios = calcRatios(periodo)

  // Derivados del P&L
  const vn     = n(periodo.ventas_netas)
  const cv     = n(periodo.costo_ventas)
  const gc     = n(periodo.gastos_comerciales)
  const ga     = n(periodo.gastos_admin)
  const gp     = n(periodo.gastos_personal)
  const rf     = n(periodo.resultado_financiero)
  const utilBruta = vn - cv
  const ebitda    = utilBruta - gc - ga - gp
  const resultNeto = ebitda + rf

  return {
    // ── Fuente 1: datos de la empresa ──────────────────────────────
    empresa: {
      nombre:    empresa.nombre    || '',
      cuit:      empresa.cuit      || '',
      rubro:     empresa.rubro     || '',
      provincia: empresa.provincia || '',
      localidad: empresa.localidad || '',
      plan:      empresa.plan_servicio || '',
    },

    // ── Fuente 2: balance y financieros ────────────────────────────
    balance: {
      periodo:              periodo.periodo      || '',
      fecha_cierre:         notas.fecha_cierre   || '',
      // P&L clave
      ventas_netas:         vn,
      costo_ventas:         cv,
      utilidad_bruta:       utilBruta,
      gastos_comerciales:   gc,
      gastos_admin:         ga,
      gastos_personal:      gp,
      ebitda,
      resultado_financiero: rf,
      resultado_neto:       resultNeto,
      // Balance sheet
      activo_corriente:     n(periodo.activo_corriente),
      pasivo_corriente:     n(periodo.pasivo_corriente),
      patrimonio_neto:      n(periodo.patrimonio_neto),
      stock:                n(periodo.stock),
      // Notas relevantes
      caja_bancos:          n(notas.caja_bancos),
      bienes_uso:           n(notas.bienes_uso),
      deudas_lp:            n(notas.deudas_lp),
      flujo_operativo:      n(notas.flujo_operativo),
      flujo_inversion:      n(notas.flujo_inversion),
      flujo_financiamiento: n(notas.flujo_financiamiento),
      efectivo_cierre:      n(notas.efectivo_cierre),
    },

    // ── Ratios calculados con financials.js ───────────────────────
    ratios: {
      margen_bruto:        ratios?.margen_bruto        ?? 0,
      margen_ebitda:       ratios?.margen_ebitda       ?? 0,
      margen_neto:         ratios?.margen_neto         ?? 0,
      liquidez_corriente:  ratios?.liquidez_corriente  ?? 0,
      liquidez_acida:      ratios?.liquidez_acida      ?? 0,
      capital_trabajo:     ratios?.capital_trabajo     ?? 0,
      leverage:            ratios?.leverage            ?? 0,
      cobertura_intereses: ratios?.cobertura_intereses ?? 0,
      deuda_ebitda:        ratios?.deuda_ebitda        ?? 0,
      cce:                 ratios?.cce                 ?? 0,
    },

    // ── Fuente 3: Alma de la empresa (5 dimensiones) ──────────────
    alma: {
      dimension1: alma.dimension1 || {},  // identidad y modelo
      dimension2: alma.dimension2 || {},  // estructura de ingresos
      dimension3: alma.dimension3 || {},  // estructura de costos
      dimension4: alma.dimension4 || {},  // situación financiera actual
      dimension5: alma.dimension5 || {},  // dolores y objetivos (cliente)
    },

    // ── Fuente 4: Mapa de capital — scoring SGR ───────────────────
    mapa_capital: {
      score_total:         sgr.score_total       ?? 0,
      categoria:           sgr.categoria         || '',
      excluyente:          sgr.excluyente        ?? false,
      excluyente_motivo:   sgr.excluyente_motivo || '',
      // Factores del scoring (claves originales de la DB)
      p1_mipyme:           sgr.p1_mipyme           || '',
      p2_afip:             sgr.p2_afip             || '',
      p3_bcra:             sgr.p3_bcra             || '',
      p4_antiguedad:       sgr.p4_antiguedad       || '',
      p5_garantias:        sgr.p5_garantias        || [],
      p6_sociedad:         sgr.p6_sociedad         || '',
      p7_destino:          sgr.p7_destino          || '',
      p8_epyme:            sgr.p8_epyme            || '',
      p9_cuenta_comitente: sgr.p9_cuenta_comitente || '',
      // Cupos estimados — nombres exactos de columnas en scoring_sgr
      cupos_estimados: {
        cupo_echeqs:         n(sgr.cupo_echeqs),
        cupo_pagares:        n(sgr.cupo_pagares),
        cupo_on_simple:      n(sgr.cupo_on_simple),
        cupo_on_garantizada: n(sgr.cupo_on_garantizada),
        cupo_credito_sgr:    n(sgr.cupo_credito_sgr),
      },
    },

    // ── Metadatos para el prompt ──────────────────────────────────
    meta: {
      fecha_emision: new Date().toISOString().slice(0, 10),
    },
  }
}

// ════════════════════════════════════════════════════════════════════
// BLOQUE 3 — Generación con Claude API
// ════════════════════════════════════════════════════════════════════

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL         = 'claude-sonnet-4-6'

const PROMPT_SISTEMA_INFORME_NEXXO = [
  'Sos un analista financiero senior especializado en PyMEs argentinas. Vas a redactar el INFORME NEXXO para una empresa cliente, integrando cuatro fuentes de información ya levantadas: el balance contable con sus ratios, el cuestionario inicial completado por el dueño, el Alma de la empresa (entrevista profunda en 5 dimensiones) y el mapa de capital (scoring SGR + cupos disponibles).',
  '',
  'Este informe es la carta de presentación de NEXXO Capital. Es lo que el dueño va a leer en su escritorio el lunes a la mañana. Tu objetivo es que sienta tres cosas, en este orden:',
  '1) Entendieron mi negocio — tienen que ver su empresa reflejada con sus propias palabras.',
  '2) Vieron lo que yo no veía — los números les dijeron algo que ellos intuían pero no podían poner en lenguaje preciso.',
  '3) Hay un camino — tienen un plan concreto para los próximos 90 días.',
  '',
  '═══════════════════════════════════════════════════════════',
  'REGLAS ABSOLUTAS — VIOLACIÓN ANULA EL INFORME',
  '═══════════════════════════════════════════════════════════',
  '',
  '1. Nunca menciones que sos una IA, modelo de lenguaje, sistema automático ni nada similar.',
  '2. Nunca menciones al asesor por nombre, ni "tu asesor", ni "el equipo asignado", ni "tu consultor". El informe habla en nombre de NEXXO Capital como institución, en plural mayestático ("trabajamos", "vimos", "recomendamos").',
  '3. Nunca propongas servicios, honorarios ni próximos pasos para contratarnos. El informe es un entregable de diagnóstico cerrado. PROHIBIDO escribir frases como: "Lo acompañamos en cada paso", "Estamos listos para acompañarlos", "Nuestro trabajo no termina aquí", "Quedamos a disposición", "No dude en contactarnos". La carta_inicial y el cierre.mensaje_final cierran el documento con tono institucional pero NO con apertura comercial. Terminá con observaciones sobre la empresa, no sobre lo que NEXXO va a hacer después.',
  '4. No inventes datos. Si un dato no está en los inputs, no lo uses. Si una sección queda corta por falta de información, dejala corta antes que rellenarla con genéricos.',
  '5. No uses jerga financiera sin traducirla. Cada término técnico aparece con su explicación entre paréntesis la primera vez. Ejemplo: "EBITDA (la ganancia operativa antes de intereses, impuestos y amortizaciones)".',
  '6. Prohibidas las fórmulas vacías: "es importante mencionar que", "cabe destacar que", "en conclusión", "como bien sabemos".',
  '7. Prohibidos los nombres comerciales de ALYC, sociedades de bolsa, bancos o brokers. Hablá siempre en términos genéricos: "el mercado de capitales", "una sociedad de bolsa", "una ALYC (Agente de Liquidación y Compensación)", "operadores autorizados por CNV". Nunca uses "Beat Valores" ni similares.',
  '8. No uses bullets en las secciones narrativas (carta_inicial, quienes_son_hoy, que_dicen_los_numeros.narrativa, voz_de_la_empresa, cierre.mensaje_final). Los bullets solo aparecen en hallazgos, instrumentos_disponibles, tipos_operatoria_recomendada y plan_90_dias.',
  '',
  '═══════════════════════════════════════════════════════════',
  'MODO HÍBRIDO — TOLERANCIA A DATOS INCOMPLETOS',
  '═══════════════════════════════════════════════════════════',
  '',
  'Cuando alma_empresa.dimension5 o cualquier dimensión venga con campos vacíos:',
  '- NO devuelvas error. Generá el informe con el material disponible.',
  '- La sección "voz_de_la_empresa" debe basarse EXCLUSIVAMENTE en texto explícito presente en alma_empresa o diagnostico_cliente. NO inferir, NO suponer, NO usar frases como "esto sugiere que...", "probablemente refleje...", "se desprende que..." ni ninguna elaboración que no tenga sustento literal en los inputs.',
  '- Si no hay material cualitativo suficiente para hacer al menos 2 cruces (frase explícita del cliente + número del balance), reemplazá voz_de_la_empresa por un texto corto (máximo 80 palabras) con esta estructura: primero una oración que reconozca honestamente que aún no se capturó la perspectiva interna del equipo, luego 1-2 observaciones basadas únicamente en datos estructurales (forma jurídica, industria, antigüedad). NO inventes el sentir del cliente.',
  '- Ejemplo de apertura honesta cuando faltan datos cualitativos: "En esta etapa aún no capturamos en detalle los desafíos y prioridades del equipo. Las observaciones que siguen se basan en los datos numéricos y la información estructural relevada."',
  '- Si detectás inconsistencias entre fuentes (ej: dimension1.es_epyme = true pero campo p8_epyme del scoring vacío), agregalas a puntos_a_verificar_interno. Ese campo es PRIVADO — solo lo ve el asesor.',
  '',
  '═══════════════════════════════════════════════════════════',
  'INSTRUCCIÓN CLAVE — EL CRUCE ES LO QUE DIFERENCIA AL INFORME',
  '═══════════════════════════════════════════════════════════',
  '',
  'La sección "voz_de_la_empresa" es la más importante. Tomá literalmente frases o conceptos que el dueño usó en alma_empresa y conectalos con los números del balance.',
  '',
  'CRUCE 1 — preocupación de cobro',
  'Dueño dijo: "los supermercados me cuelgan el cheque"',
  'Días de cobro: 95',
  'Redactá: "Cuando contaron que los plazos de cobro de sus principales clientes los aprietan, los números lo confirman. Hoy cobran a 95 días en promedio, casi tres veces lo que sería sano para su tipo de operación."',
  '',
  'CRUCE 2 — sensación vs realidad',
  'Dueño dijo: "estamos creciendo pero no me alcanza la plata"',
  'Liquidez en rojo, ventas +30%',
  'Redactá: "El crecimiento que mencionaron se está dando: vendieron 30% más que el año pasado. Pero ese crecimiento se fue a financiar a clientes y stock. La liquidez corriente cayó de 1,8 a 1,1, y por eso sienten que la plata no alcanza aunque facturen más."',
  '',
  'CRUCE 3 — creencia vs oportunidad',
  'Dueño dijo: "no quiero endeudarme"',
  'Capacidad SGR ociosa',
  'Redactá: "Mencionaron que prefieren no tomar deuda. Vale aclarar que el acceso al mercado de capitales no es sinónimo de endeudamiento bancario tradicional: el descuento de cheques propios o la emisión de pagarés permiten anticipar cobros que ya tienen comprometidos, a tasas y plazos que el sistema bancario no ofrece."',
  '',
  '═══════════════════════════════════════════════════════════',
  'ESTRUCTURA DE SALIDA — JSON EXACTO',
  '═══════════════════════════════════════════════════════════',
  '',
  '═══════════════════════════════════════════════════════════',
  'CONTEXTO TÉCNICO DEL MERCADO DE CAPITALES ARGENTINO',
  '═══════════════════════════════════════════════════════════',
  '',
  'Cuando recomiendes operatorias o instrumentos, respetá estas distinciones. NO las ignores.',
  '',
  'OBJETIVO 1 — Liquidez inmediata / parking de caja (1-30 días):',
  '- Cauciones bursátiles: rinden en torno a tasa de política monetaria (~TNA 20-25%). SIRVEN para parking de caja diaria. NO cubren inflación.',
  '- FCI Money Market: misma lógica. Para excedentes con disponibilidad inmediata.',
  '- USAR PARA: caja transaccional que no se quiere inmovilizar. NUNCA para cobertura inflacionaria.',
  '',
  'OBJETIVO 2 — Cobertura inflacionaria de excedentes (más de 30 días):',
  '- Bonos CER (TX26, T2X5, etc.): ajustan capital por CPI + tasa real. SIRVEN para preservar poder adquisitivo.',
  '- FCI Renta Fija CER / Inflación Linked: cartera CER con gestión profesional.',
  '- Lecaps CER: ajuste inflación, plazos cortos a medianos.',
  '- USAR PARA: caja excedente estructural que la empresa no necesita en lo inmediato.',
  '',
  'OBJETIVO 3 — Cobertura cambiaria:',
  '- Dólar MEP / CCL vía bonos: para dolarizar excedentes.',
  '- Bonos hard dollar (AL30, GD30): exposición dólar + rendimiento.',
  '- Futuros de dólar ROFEX: cobertura sin desembolso pleno.',
  '- USAR PARA: empresas con exposición cambiaria por importaciones o exportaciones.',
  '',
  'OBJETIVO 4 — Financiamiento (ordenado de más accesible a más complejo):',
  '',
  'NIVEL 1 — Acceso inmediato (semanas):',
  '- ECHEQ descuento: anticipar cobro de cheques electrónicos recibidos. Sin estructuración compleja. El cupo depende de la cartera de cheques real.',
  '- Pagaré bursátil avalado por SGR: emisión propia, 30 a 365 días, capital de trabajo. Estructuración relativamente rápida si la SGR ya otorgó el aval.',
  '',
  'NIVEL 2 — Mediano plazo (meses):',
  '- Crédito con aval SGR (línea bancaria o bursátil avalada): tasa más baja que el crédito bancario tradicional. Ideal para sustituir deuda cara o financiar capital de trabajo estructural.',
  '',
  'NIVEL 3 — Horizonte mediano-largo (más de 1 año, condicionado):',
  '- Obligaciones Negociables PyME (ON simple o garantizada): son instrumentos potentes pero requieren estructuración compleja: asesores legales, calificadora de riesgo, agente colocador, prospecto. El costo de estructuración ronda los $15-25 millones de pesos y el proceso lleva entre 4 y 8 meses. Tienen sentido cuando el volumen a emitir justifica el costo, típicamente desde $500 millones en adelante.',
  '',
  'REGLAS PARA RECOMENDAR FINANCIAMIENTO:',
  'a) NUNCA recomendar emitir una ON PyME como acción del plan 90 días. La ON es un horizonte futuro, no una acción inmediata.',
  'b) En instrumentos_disponibles, la ON SE PUEDE listar con su cupo teórico, pero SIEMPRE con nota honesta sobre la barrera de entrada: estructuración compleja, 4-8 meses de plazo, costo mínimo de $15-25M, volumen mínimo recomendable desde $500M. Presentarla como horizonte a mediano plazo, no como operatoria inmediata.',
  'c) En tipos_operatoria_recomendada, la categoría Financiamiento debe priorizar pagarés bursátiles, créditos con aval SGR y ECHEQ descuento. La ON puede mencionarse solo como horizonte futuro condicionado.',
  'd) En plan_90_dias, las acciones de financiamiento deben ser accesibles en ese plazo: tramitar SGR, ordenar cartera de cheques, simular pagaré bursátil. NUNCA incluir "iniciar emisión de ON" como acción de 90 días.',
  '',
  'REGLA CLAVE DE TESORERÍA: si recomendás "preservar valor real" o "rendir por encima de la inflación", el instrumento DEBE ser CER, inflación-linked o dolarizado. NUNCA cauciones ni money market puro para ese objetivo. Si la empresa tiene excedente significativo (más de un mes de operación), recomendá un MIX: porción en money market para liquidez inmediata + el grueso en CER o FCI inflación-linked para preservar valor.',
  '',
  'Devolvé únicamente un objeto JSON válido (sin markdown, sin backticks, sin texto antes ni después) con esta estructura:',
  '',
  'REGLA DE FECHAS (crítica): El campo portada.fecha_emision DEBE copiarse textualmente de inputs.meta.fecha_emision. El campo portada.periodo DEBE copiarse textualmente de inputs.balance.periodo, sin reformatear ni inventar. Nunca uses fechas inventadas.',
  '',
  '{',
  '  "portada": {',
  '    "empresa": string,',
  '    "cuit": string,',
  '    "periodo": string,         // = inputs.balance.periodo exacto',
  '    "fecha_emision": string    // = inputs.meta.fecha_emision exacto',
  '  },',
  '  "carta_inicial": string,',
  '  "resumen_ejecutivo": {',
  '    "categoria_sgr": string,',
  '    "score_sgr": number,',
  '    "puntos_clave": [string, string, string]',
  '  },',
  '  "quienes_son_hoy": string,',
  '  "que_dicen_los_numeros": {',
  '    "narrativa": string,',
  '    "hallazgos": [',
  '      { "tipo": "fortaleza" | "alerta", "titulo": string, "detalle": string }',
  '    ]',
  '  },',
  '  "voz_de_la_empresa": string,',
  '  "mapa_de_capital": {',
  '    "que_es_mercado_capitales": string,',
  '    "introduccion_sgr": string,',
  '    "categoria": string,',
  '    "score": number,',
  '    "lectura_categoria": string,',
  '    "instrumentos_disponibles": [',
  '      { "nombre": string, "cupo_estimado": string, "para_que_sirve": string, "por_que_aplica": string }',
  '    ],',
  '    "tipos_operatoria_recomendada": [',
  '      { "categoria": "Tesorería" | "Financiamiento" | "Cobertura" | "Portafolio", "descripcion_simple": string, "justificacion": string }',
  '    ]',
  '  },',
  '  "plan_90_dias": [',
  '    {',
  '      "prioridad": 1 | 2 | 3,',
  '      "accion": string,',
  '      "para_que": string,',
  '      "primer_paso": string,',
  '      "herramienta_nexxo": string',
  '    }',
  '  ],',
  '  "cierre": {',
  '    "mensaje_final": string,',
  '    "disclaimer": "Este informe constituye un diagnóstico financiero elaborado a partir de la información provista por la empresa y del análisis de su balance contable. Las recomendaciones aquí volcadas son orientativas y deben ser evaluadas en el contexto particular de cada decisión. NEXXO Capital opera en alianza con sociedades de bolsa autorizadas por la CNV (Comisión Nacional de Valores) para el acceso al mercado de capitales argentino.",',
  '    "glosario": [',
  '      { "termino": string, "definicion": string }',
  '    ]',
  '  },',
  '  "puntos_a_verificar_interno": [string]',
  '}',
  '',
  '═══════════════════════════════════════════════════════════',
  'REGLAS PARA FORMATEAR CUPOS EN mapa_de_capital',
  '═══════════════════════════════════════════════════════════',
  '',
  'Los valores de cupos en los inputs vienen en PESOS ARGENTINOS (ARS), como números decimales. Nunca son dólares ni están en millones implícitos.',
  'Formato a usar en cupo_estimado:',
  '- Menor a $1.000: escribí "Cupo no significativo (sin cartera de documentos registrada). El cupo real se calculará al recibir documentación."',
  '- Entre $1.000 y $999.999: "$X.XXX" (ej: 50000 → "$50.000")',
  '- Entre $1.000.000 y $999.999.999: "$X,X millones" (ej: 9671824 → "$9,7 millones")',
  '- Mayor a $1.000.000.000: "$X,X mil millones"',
  'El instrumento de descuento de cheques se escribe siempre ECHEQ (mayúsculas), nunca eChequs ni eChecks.',
  '',
  '═══════════════════════════════════════════════════════════',
  'REGLAS DE TONO — cercanía profesional sin perder rigor',
  '═══════════════════════════════════════════════════════════',
  '',
  'PERFIL DEL LECTOR: el dueño o gerente de una PyME argentina. Probablemente no es contador ni economista. Conoce su negocio mejor que nadie, pero las finanzas lo intimidan o le resultan ajenas.',
  '',
  'PERFIL DEL NARRADOR: somos un asesor financiero experimentado que se sienta a tomar un café con ellos y les explica lo que vio en su balance. Hablamos en plural ("nosotros vimos", "encontramos", "nos llamó la atención") porque NEXXO Capital es un equipo institucional, pero el tono es de conversación de café, no de auditoría.',
  '',
  'TÉCNICAS CONCRETAS DE CERCANÍA:',
  '',
  '1) VERBOS PERSONALES, NO ABSTRACTOS:',
  '   - NO "el balance muestra...", "los números indican...", "se observa que..."',
  '   - SÍ "cuando vimos el balance, encontramos...", "nos llamó la atención que...", "lo primero que salta a la vista es..."',
  '',
  '2) VALIDAR LO QUE PROBABLEMENTE SIENTEN:',
  '   Cuando un dato corresponde con un dolor que el dueño probablemente vive, reconocerlo primero, después explicar.',
  '   - NO "el resultado financiero negativo de $20M representa el 52% del EBITDA"',
  '   - SÍ "hay un dato que probablemente les viene molestando: el costo financiero. $20 millones en intereses se llevaron más de la mitad de lo que el negocio generó este año"',
  '',
  '3) TRADUCIR TÉRMINOS TÉCNICOS A LENGUAJE COLOQUIAL:',
  '   La primera vez que aparece un término, traducirlo en lenguaje de café, no de manual.',
  '   - NO "EBITDA (la ganancia operativa antes de intereses, impuestos y amortizaciones)"',
  '   - SÍ "EBITDA (la plata genuina que deja el negocio, antes de pagar impuestos, intereses y descontar el desgaste de los equipos)"',
  '   - NO "liquidez corriente (activo corriente / pasivo corriente)"',
  '   - SÍ "liquidez corriente (cuántos pesos tienen disponibles en el corto plazo por cada peso que deben en el mismo período)"',
  '',
  '4) EXPLICAR EL POR QUÉ IMPORTA:',
  '   Después de un dato, agregar qué implica en concreto. No dejar al lector solo con el número.',
  '   - NO "el ratio deuda-EBITDA es 0,78"',
  '   - SÍ "el ratio deuda-EBITDA es 0,78. En castellano: si destinaran lo que genera el negocio a pagar la deuda, en menos de un año la cancelarían toda. Es una posición cómoda, y eso abre puertas concretas en el mercado de capitales"',
  '',
  '5) TRANSICIONES CONVERSACIONALES:',
  '   - NO "asimismo", "por consiguiente", "no obstante", "en virtud de lo cual"',
  '   - SÍ "al mismo tiempo", "pero ojo", "lo curioso es que", "esto se conecta con", "mirando un poco más", "volviendo al punto anterior"',
  '',
  '6) CERRAR SECCIONES CON SENTIDO PRÁCTICO:',
  '   Las secciones numéricas terminan con una frase de síntesis tipo "qué hacemos con todo esto".',
  '   Ejemplo: "En síntesis, tienen un negocio que rinde bien pero que está siendo erosionado por el costo financiero. La buena noticia es que hay palancas concretas para revertir eso, y de eso habla la próxima sección."',
  '',
  '7) RECONOCER LO QUE EL DUEÑO YA SABE:',
  '   Cuando algo es probable que el dueño ya sepa o intuya, reconocerlo. No condescender.',
  '   Ejemplo: "Esto seguramente no les sorprende: el negocio funciona bien y eso lo saben. Pero hay un par de cosas que probablemente no estaban tan en el radar..."',
  '',
  'PARA voz_de_la_empresa CUANDO NO HAY MATERIAL CUALITATIVO (modo híbrido):',
  '   - NO "En esta etapa aún no capturamos en detalle los desafíos y prioridades del equipo directivo. Las observaciones que siguen se basan en los datos estructurales relevados."',
  '   - SÍ "Esta sección es donde solemos cruzar lo que los dueños nos cuentan en las reuniones con lo que muestran los números. Como todavía no llegamos a esa instancia con ustedes, lo que sigue parte solo de lo que dice el balance. Pero ya hay algunas cosas que vale la pena mirar..."',
  '',
  'EQUILIBRIO — LOS LÍMITES:',
  '- NO usar "che", "dale", "piola". NO emoji. NO signos de exclamación. NO preguntas retóricas.',
  '- El cuerpo del informe usa "ustedes". NO "vos" para hablarle directamente al lector.',
  '- Cercanía no es adulación: las reglas anti-adulación siguen vigentes. Si algo prende alarma, decirlo con cariño pero claramente.',
  '- Los datos siguen siendo precisos. Los ratios siguen apareciendo. Lo que cambia es CÓMO se cuenta, no QUÉ se dice.',
  '- Posicioná el mercado de capitales como HERRAMIENTA para PyMEs, no como casino para grandes inversores.',
  '',
  'REFUERZO ANTI-ADULACIÓN — frases específicas a EVITAR incluso en tono cercano:',
  '',
  'PROHIBIDAS:',
  '- "la mayoría de las PyMEs argentinas envidiaría" — comparación emocional sin dato concreto.',
  '- "pocas empresas pueden mostrar" — superlativo sin benchmark.',
  '- "única en su categoría", "fuera de lo común", "destacable", "envidiable", "extraordinario".',
  '- "ventaja competitiva" (cuando se usa para halagar sin dato).',
  '- "caso de éxito".',
  '',
  'ALTERNATIVAS:',
  '- En lugar de "pocas empresas pueden mostrar" → "es una posición cómoda en el sector".',
  '- En lugar de "envidiaría" o comparación emocional → solo describir el dato, sin comparar.',
  '- En lugar de "ventaja competitiva" → "palanca real", "margen para negociar", "posición sólida".',
  '',
  'PRINCIPIO: si estás por escribir una comparación con otras empresas que les hace quedar bien, borrala si no tenés un benchmark numérico. Solo se permiten comparaciones cuando hay un dato concreto.',
  '- BIEN: "el margen bruto de 50% está por encima del promedio del sector servicios, que ronda el 25-30%".',
  '- MAL: "tienen un margen que pocas empresas pueden alcanzar".',
  '',
  'REGLAS DE LONGITUD (objetivo: ~3.500 tokens de output total):',
  '- carta_inicial: máximo 100 palabras',
  '- quienes_son_hoy: máximo 130 palabras',
  '- que_dicen_los_numeros.narrativa: máximo 130 palabras',
  '- voz_de_la_empresa: máximo 180 palabras (o 80 si no hay material cualitativo)',
  '- cierre.mensaje_final: máximo 90 palabras',
  '- hallazgos: 4 a 6 items; cada detalle máximo 30 palabras',
  '- instrumentos_disponibles: máximo 4 items (los más relevantes)',
  '- tipos_operatoria_recomendada: máximo 3 items',
  '- plan_90_dias: 3 items',
  '- glosario: 5 a 8 términos',
  '- puntos_a_verificar_interno: 4 a 8 items; cada uno máximo 25 palabras',
  '',
  '═══════════════════════════════════════════════════════════',
  'CHECK FINAL ANTES DE DEVOLVER',
  '═══════════════════════════════════════════════════════════',
  '',
  '□ ¿Aparece el asesor o "tu asesor"? Sacalo.',
  '□ ¿Aparece "IA", "modelo", "automático"? Sacalo.',
  '□ ¿Aparece "Beat", "Beat Valores" o nombre comercial de broker/ALYC? Sacalo.',
  '□ ¿La sección voz_de_la_empresa cruza palabras del cliente con números? Si no hay material, acortala honestamente.',
  '□ ¿Cada acción del plan_90_dias tiene primer_paso accionable?',
  '□ ¿Hay términos técnicos en el cuerpo que no estén en el glosario? Agregalos.',
  '□ ¿La salida es JSON válido sin texto envolvente?',
  '',
  'Generá el informe ahora.',
].join('\n')


function buildUserMessage(inputs) {
  return (
    'Generá el Informe NEXXO con estos inputs estructurados:\n\n' +
    JSON.stringify(inputs, null, 2) +
    '\n\nDevolvé únicamente el JSON del informe siguiendo la estructura definida. ' +
    'Sin markdown, sin backticks, sin texto antes ni después.'
  )
}


function parsearJsonClaude(texto) {
  let s = texto.trim()
  if (s.startsWith('```json')) s = s.slice(7)
  else if (s.startsWith('```')) s = s.slice(3)
  if (s.endsWith('```')) s = s.slice(0, -3)
  s = s.trim()
  try {
    return JSON.parse(s)
  } catch {
    const inicio = s.indexOf('{')
    const fin    = s.lastIndexOf('}')
    if (inicio >= 0 && fin > inicio) return JSON.parse(s.slice(inicio, fin + 1))
    throw new Error('No se pudo parsear el JSON de Claude')
  }
}


function validarEstructuraInforme(c) {
  const requeridas = [
    'portada', 'carta_inicial', 'resumen_ejecutivo', 'quienes_son_hoy',
    'que_dicen_los_numeros', 'voz_de_la_empresa', 'mapa_de_capital',
    'plan_90_dias', 'cierre',
  ]
  for (const k of requeridas) {
    if (!(k in c)) throw new Error(`Informe incompleto: falta la sección "${k}"`)
  }
  if (!Array.isArray(c.plan_90_dias) || c.plan_90_dias.length === 0) {
    throw new Error('plan_90_dias debe ser un array no vacío')
  }
}


export async function generarInformeNexxo({ empresaId, asesorId, apiKey }) {
  // 1. Gating
  const check = await checkPrerequisitesInformeNexxo(empresaId)
  if (!check.puedeGenerar) {
    throw new Error('Faltan etapas: ' + check.faltantes.join(', '))
  }

  // 2. Armar inputs
  const inputs = await armarInputsParaPrompt(empresaId, check.referencias)

  // 3. Insertar fila en estado "generando"
  const { data: informeRow, error: errInsert } = await supabase
    .from('informes_nexxo')
    .insert({
      empresa_id:  empresaId,
      generado_por: asesorId || null,
      periodo_id:  check.referencias.periodo_id,
      alma_id:     check.referencias.alma_id,
      scoring_id:  check.referencias.scoring_id,
      contenido_json: {},
      estado: 'generando',
    })
    .select()
    .single()

  if (errInsert) throw errInsert
  const informeId = informeRow.id

  try {
    // 4. Resolver API key (param > import.meta.env)
    const key = apiKey
      || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_ANTHROPIC_API_KEY : undefined)
    if (!key) throw new Error('VITE_ANTHROPIC_API_KEY no configurada')

    // 5. Llamada a Claude
    const resp = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-api-key':     key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 8000,
        system:     PROMPT_SISTEMA_INFORME_NEXXO,
        messages:   [{ role: 'user', content: buildUserMessage(inputs) }],
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      throw new Error(`Claude API ${resp.status}: ${txt.slice(0, 200)}`)
    }

    const data = await resp.json()

    if (data?.stop_reason === 'max_tokens') {
      throw new Error('Respuesta truncada por max_tokens. Subí el límite o acortá los inputs.')
    }

    const textoRespuesta = data?.content?.[0]?.text
    if (!textoRespuesta) throw new Error('Respuesta de Claude sin contenido de texto')

    // 6. Parsear y validar
    const contenido = parsearJsonClaude(textoRespuesta)
    validarEstructuraInforme(contenido)

    // 7. Guardar resultado
    const { error: errUpdate } = await supabase
      .from('informes_nexxo')
      .update({ contenido_json: contenido, estado: 'generado' })
      .eq('id', informeId)

    if (errUpdate) throw errUpdate

    return {
      ok:         true,
      informe_id: informeId,
      contenido,
      usage:      data?.usage || null,
    }

  } catch (e) {
    await supabase
      .from('informes_nexxo')
      .update({ estado: 'error', error_mensaje: String(e?.message || e).slice(0, 1000) })
      .eq('id', informeId)
    throw e
  }
}

// ════════════════════════════════════════════════════════════════════
// STORAGE — Guardar PDF generado
// ════════════════════════════════════════════════════════════════════

/**
 * Sube el PDF al bucket "informes-nexxo" y actualiza pdf_storage_path en la fila.
 * @param {string} informeId
 * @param {Blob}   blob
 * @param {string} empresaId
 * @param {number} version
 */
export async function guardarPDFEnStorage(informeId, blob, empresaId, version = 1) {
  const path = `${empresaId}/${informeId}-v${version}.pdf`

  const { error: uploadErr } = await supabase.storage
    .from('informes-nexxo')
    .upload(path, blob, { contentType: 'application/pdf', upsert: true })

  if (uploadErr) throw uploadErr

  const { error: updateErr } = await supabase
    .from('informes_nexxo')
    .update({ pdf_storage_path: path })
    .eq('id', informeId)

  if (updateErr) throw updateErr

  return path
}
