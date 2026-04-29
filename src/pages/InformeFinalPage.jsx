import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'
import { calcRatios, ars, pct, ratio, days } from '@/lib/financials'
import { jsPDF } from 'jspdf'
import PageHeader from '@/components/shared/PageHeader'
import {
  CheckCircle, AlertTriangle, FileText, Download,
  Edit2, Save, RefreshCw, ExternalLink,
} from 'lucide-react'

// Cliente con service role para bypassear RLS al escribir datos del cliente
const _svcKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY
const _url    = import.meta.env.VITE_SUPABASE_URL
const adminDb = supabaseAdmin
  || (_svcKey ? createClient(_url, _svcKey, { auth: { persistSession: false } }) : null)
  || supabase

// ═══════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════

const SCORING_Q = [
  {
    key: 'p1_mipyme', label: 'Condición MiPyME',
    q: '¿Tiene Certificado MiPyME vigente?',
    opts: [
      { v:'Vigente',             l:'Sí, vigente',                         pts:10 },
      { v:'Califica no tramitó', l:'Califica pero no tramitó',             pts:5  },
      { v:'No califica',         l:'No califica',                          pts:0, ex:true },
    ],
  },
  {
    key: 'p2_afip', label: 'Situación AFIP',
    q: 'Situación impositiva frente a AFIP',
    opts: [
      { v:'Sin deuda',      l:'Sin deuda ni atrasos',             pts:15 },
      { v:'Plan al día',    l:'Plan de pago vigente y al día',     pts:10 },
      { v:'Deuda sin plan', l:'Deuda sin plan de pago',            pts:3  },
      { v:'Inhabilitada',   l:'Inhabilitada por AFIP',             pts:0, ex:true },
    ],
  },
  {
    key: 'p3_bcra', label: 'Historial BCRA',
    q: 'Situación en el sistema financiero (BCRA)',
    opts: [
      { v:'Sin antecedentes',    l:'Sin antecedentes negativos',               pts:15 },
      { v:'Situación 2',         l:'Situación 2 — riesgo bajo',                pts:10 },
      { v:'Rechazos +2 años',    l:'Rechazos de cheques hace más de 2 años',   pts:5  },
      { v:'Rechazos último año', l:'Rechazos en el último año',                pts:0, ex:true },
      { v:'Situación 3 o peor',  l:'Situación 3 o peor',                       pts:0, ex:true },
    ],
  },
  {
    key: 'p4_antiguedad', label: 'Antigüedad',
    q: 'Años de actividad de la empresa',
    opts: [
      { v:'Menos de 1 año', l:'Menos de 1 año', pts:0, ex:true },
      { v:'1 a 2 años',     l:'1 a 2 años',     pts:3  },
      { v:'2 a 5 años',     l:'2 a 5 años',     pts:5  },
      { v:'Más de 5 años',  l:'Más de 5 años',  pts:5  },
    ],
  },
  {
    key: 'p8_epyme', label: 'ePyME',
    q: '¿La empresa está inscripta como ePyME en AFIP?',
    opts: [
      { v:'Sí',            l:'Sí, inscripta en AFIP',       pts:5 },
      { v:'En trámite',    l:'Trámite en curso',             pts:2 },
      { v:'No',            l:'No',                           pts:0 },
    ],
  },
  {
    key: 'p9_cuenta_comitente', label: 'Cuenta comitente ALYC',
    q: '¿Tiene cuenta comitente abierta en una ALYC?',
    opts: [
      { v:'Sí',       l:'Sí, cuenta activa en su ALYC',   pts:5 },
      { v:'En trámite',l:'En trámite de apertura',         pts:2 },
      { v:'No',        l:'No',                              pts:0 },
    ],
  },
  {
    key: 'p6_sociedad', label: 'Situación societaria',
    q: 'Estado legal y societario de la empresa',
    opts: [
      { v:'Limpia',             l:'Sin conflictos societarios',  pts:0  },
      { v:'Conflictos menores', l:'Conflictos societarios menores', pts:-5 },
      { v:'Embargos vigentes',  l:'Embargos judiciales vigentes', pts:-10 },
    ],
  },
]

const P5_OPTS = [
  { v:'Inmueble libre de gravamen', l:'Inmueble libre de gravamen', pts:10 },
  { v:'Inmueble hipotecado',        l:'Inmueble hipotecado',        pts:6  },
  { v:'Maquinaria prendable',       l:'Maquinaria prendable',       pts:5  },
  { v:'Avales personales',          l:'Avales personales socios',   pts:3  },
  { v:'Sin garantías',              l:'Sin garantías reales',        pts:1  },
]

const P7_OPTS = ['Capital de trabajo','Activos fijos','Refinanciación de deuda','Expansión comercial','Exportación']

const EMPTY_ANSWERS = {
  p1_mipyme:'', p2_afip:'', p3_bcra:'', p4_antiguedad:'',
  p5_garantias:[], p6_sociedad:'', p7_destino:'',
  p8_epyme:'', p9_cuenta_comitente:'',
}

const FACTOR_ON = { AAA:4, AA:3, A:2.5, BBB:1.5, BB:1, 'Sin elegibilidad':0 }

const GLOSARIO_PDF = [
  { t:'Activo corriente',                 d:'Todo lo que tiene la empresa y puede convertirse en dinero en menos de un año: caja, cuentas por cobrar, stock.' },
  { t:'Pasivo corriente',                 d:'Deudas que vencen en menos de un año: proveedores, cuotas de préstamos, impuestos a pagar.' },
  { t:'EBITDA',                           d:'Ganancia operativa antes de intereses, impuestos, depreciaciones y amortizaciones.' },
  { t:'Liquidez',                         d:'Capacidad de la empresa para pagar sus compromisos de corto plazo con sus recursos disponibles.' },
  { t:'Leverage',                         d:'Nivel de deuda financiera en relación al patrimonio neto. Indica dependencia del financiamiento externo.' },
  { t:'Patrimonio neto',                  d:'Lo que pertenece a los dueños: total de activos menos total de deudas.' },
  { t:'Flujo de caja operativo',          d:'Dinero real generado o consumido por la actividad principal del negocio.' },
  { t:'Ciclo de conversión de efectivo',  d:'Días entre que la empresa paga a proveedores y cobra a sus clientes.' },
  { t:'Mercado de capitales',             d:'Sistema donde empresas obtienen financiamiento emitiendo bonos o negociando instrumentos sin intermediación bancaria.' },
  { t:'ON PyME',                          d:'Obligación Negociable PyME: bono emitido directamente por una PyME para obtener financiamiento de inversores.' },
  { t:'SGR',                              d:'Sociedad de Garantia Reciproca: entidad que avala a PyMEs para acceder a mejor financiamiento.' },
  { t:'ECHEQ',                            d:'Cheque electronico descontable en el mercado de capitales antes de su vencimiento.' },
]

const INFORME_SECCIONES = [
  { key:'perfil',     titulo:'PERFIL DE LA EMPRESA',                  next:['ANALISIS ECONOMICO','ANÁLISIS ECONÓMICO'] },
  { key:'economico',  titulo:'ANÁLISIS ECONÓMICO',                    next:['ANALISIS FINANCIERO','ANÁLISIS FINANCIERO'] },
  { key:'financiero', titulo:'ANÁLISIS FINANCIERO Y DE LIQUIDEZ',     next:['ANALISIS PATRIMONIAL','ANÁLISIS PATRIMONIAL'] },
  { key:'patrimonial',titulo:'ANÁLISIS PATRIMONIAL',                  next:['SEMAFORO','SEMÁFORO'] },
  { key:'semaforo',   titulo:'SEMÁFORO FINANCIERO',                   next:['POSICION','POSICIÓN'] },
  { key:'sgr',        titulo:'POSICIÓN SGR Y CUPOS ESTIMADOS',        next:['PRIORIDADES','LAS 3'] },
  { key:'prioridades',titulo:'LAS 3 PRIORIDADES DE ACCIÓN',           next:[] },
]

const SYSTEM_PROMPT = `Redactá un informe de diagnóstico financiero integral para una empresa PyME argentina. \
El informe es profesional, claro y accionable. No incluyas propuesta de servicios ni honorarios. \
No hagas referencia a quién preparó el informe ni a herramientas utilizadas. \
Usá términos técnicos pero siempre explicalos entre paréntesis la primera vez que aparecen. \
Estructurá el informe con estas secciones exactas en mayúscula: \
PERFIL DE LA EMPRESA, ANÁLISIS ECONÓMICO, ANÁLISIS FINANCIERO Y DE LIQUIDEZ, ANÁLISIS PATRIMONIAL, \
SEMÁFORO FINANCIERO, POSICIÓN SGR Y CUPOS ESTIMADOS, LAS 3 PRIORIDADES DE ACCIÓN. \
Cada sección 2 a 3 párrafos. Las prioridades deben ser concretas, ordenadas por urgencia e incluir \
una acción específica con plazo. Sin markdown, sin asteriscos, solo texto plano.`

// ═══════════════════════════════════════════════════════════════════
// FUNCIONES DE SCORING
// ═══════════════════════════════════════════════════════════════════

const n = v => Number(v) || 0

function calcScoreBalance(periodo) {
  const ratios = calcRatios(periodo)
  if (!ratios) return 0
  const me = ratios.margen_ebitda
  const lc = ratios.liquidez_corriente
  const lv = ratios.leverage

  let p1 = 0
  if (me >= 0.20) p1 = 25
  else if (me >= 0.12) p1 = 18
  else if (me >= 0.06) p1 = 10
  else if (me >= 0) p1 = 4

  let p2 = 0
  if (lc >= 1.5) p2 = 15
  else if (lc >= 1.2) p2 = 10
  else if (lc >= 1.0) p2 = 6
  else if (lc >= 0.8) p2 = 2

  let p3 = 0
  if (lv < 1.5) p3 = 10
  else if (lv < 2.5) p3 = 7
  else if (lv < 3.5) p3 = 3

  return p1 + p2 + p3
}

function calcScoreCuestionario(ans) {
  const excluyentes = []
  let score = 0

  SCORING_Q.forEach(q => {
    const opt = q.opts.find(o => o.v === ans[q.key])
    if (!opt) return
    if (opt.ex) excluyentes.push(`${q.label}: ${opt.l}`)
    score += opt.pts
  })

  // P5 garantías (capped at 10)
  const ptsP5 = Math.min((ans.p5_garantias || []).reduce((s, g) => s + (P5_OPTS.find(o => o.v === g)?.pts || 0), 0), 10)
  score += ptsP5

  return { score: Math.max(0, score), excluyentes }
}

function getCategoria(total) {
  if (total >= 85) return 'AAA'
  if (total >= 70) return 'AA'
  if (total >= 55) return 'A'
  if (total >= 40) return 'BBB'
  if (total >= 25) return 'BB'
  return 'Sin elegibilidad'
}

function calcCupos(total, ebitda, ventas, patrimonioNeto, esEpyme) {
  const score = total
  const v     = n(ventas)
  const e     = n(ebitda)
  const pn    = n(patrimonioNeto)
  return {
    cupo_echeqs:         esEpyme && v > 0 ? (v / 12) * 1.5 : 0,
    cupo_pagares:        esEpyme && v > 0 ? (v / 12) : 0,
    cupo_on_simple:      score >= 50 && pn > 0 ? pn * 0.3 : 0,
    cupo_on_garantizada: score >= 65 && e > 0 ? e * 1.5 : 0,
    cupo_credito_sgr:    score >= 65 && e > 0 ? e * 2 : 0,
  }
}

function buildMensaje(empresa, periodo, notas, sgr, ratios) {
  const vn    = n(periodo.ventas_netas)
  const ub    = vn - n(periodo.costo_ventas)
  const eb    = ub - n(periodo.gastos_comerciales) - n(periodo.gastos_admin) - n(periodo.gastos_personal)
  const rn    = eb + n(periodo.resultado_financiero)
  const actT  = n(periodo.activo_corriente) + n(notas.bienes_uso)
  const pasT  = n(periodo.pasivo_corriente) + n(notas.deudas_lp) + n(notas.otras_deudas_nc)
  const fmt   = v => `$${n(v).toLocaleString('es-AR')}`
  const pc2   = (v, b) => b ? `${(v / b * 100).toFixed(1)}%` : '0%'
  const rt    = k => ratios?.[k] != null && isFinite(ratios[k]) ? `${ratios[k].toFixed(2)}x` : '—'

  return `Empresa: ${empresa.nombre}
Rubro: ${empresa.rubro || 'no especificado'}
Período: ${periodo.periodo}
Fecha de cierre: ${notas.fecha_cierre || 'no especificada'}

SITUACIÓN PATRIMONIAL:
Activo corriente: Caja y bancos ${fmt(notas.caja_bancos)}, Inversiones ${fmt(notas.inversiones_corrientes)}, Créditos por ventas ${fmt(notas.creditos_ventas)}, Otros créditos ${fmt(notas.otros_creditos_cte)}, Stock ${fmt(periodo.stock)}. Total activo corriente ${fmt(periodo.activo_corriente)}.
Activo no corriente: Bienes de uso ${fmt(notas.bienes_uso)}. Total activo ${fmt(actT)}.
Pasivo corriente: Deudas comerciales ${fmt(notas.deudas_comerciales)}, Deudas financieras ${fmt(notas.deudas_financieras_cte)}, Cargas sociales ${fmt(notas.rem_cargas_sociales)}, Cargas fiscales ${fmt(notas.cargas_fiscales_cte)}. Total pasivo corriente ${fmt(periodo.pasivo_corriente)}.
Pasivo no corriente: ${fmt(n(notas.deudas_lp) + n(notas.otras_deudas_nc))}. Total pasivo ${fmt(pasT)}.
Patrimonio neto: ${fmt(periodo.patrimonio_neto)}.

RESULTADOS:
Ventas netas ${fmt(vn)}, Costo de ventas ${fmt(periodo.costo_ventas)}, Utilidad bruta ${fmt(ub)} (${pc2(ub,vn)}), Gastos comercialización ${fmt(periodo.gastos_comerciales)}, Gastos administración ${fmt(periodo.gastos_admin)}, Gastos personal ${fmt(periodo.gastos_personal)}, EBITDA ${fmt(eb)} (${pc2(eb,vn)}), Resultado financiero ${fmt(periodo.resultado_financiero)}, Otros ingresos ${fmt(notas.otros_ingresos)}, Impuesto ganancias ${fmt(notas.impuesto_ganancias)}, Resultado del ejercicio ${fmt(n(notas.resultado_ejercicio) || rn)}.

FLUJO:
Inicio ${fmt(notas.efectivo_inicio)}, Cierre ${fmt(notas.efectivo_cierre)}, Operativo ${fmt(notas.flujo_operativo)}, Inversión ${fmt(notas.flujo_inversion)}, Financiamiento ${fmt(notas.flujo_financiamiento)}.

RATIOS:
Margen bruto ${pc2(ub,vn)}, EBITDA ${pc2(eb,vn)}, Neto ${pc2(rn,vn)}, Liquidez corriente ${rt('liquidez_corriente')}, Liquidez ácida ${rt('liquidez_acida')}, Leverage ${rt('leverage')}, Deuda/EBITDA ${rt('deuda_ebitda')}, CCE ${Math.round(ratios?.cce||0)} días.

SCORING SGR — Score total: ${sgr.score_total}/100, Categoría: ${sgr.categoria}.
P1 MiPyME: ${sgr.p1_mipyme}, P2 AFIP: ${sgr.p2_afip}, P3 BCRA: ${sgr.p3_bcra}, P4 Antigüedad: ${sgr.p4_antiguedad}, P5 Garantías: ${(sgr.p5_garantias||[]).join(', ') || '—'}, P6 Sociedad: ${sgr.p6_sociedad}, P7 Destino: ${sgr.p7_destino}.
Cupos: ECHEQs ${fmt(sgr.cupo_echeqs)}, Pagarés ${fmt(sgr.cupo_pagares)}, ON simple ${fmt(sgr.cupo_on_simple)}, ON garantizada ${fmt(sgr.cupo_on_garantizada)}, Crédito SGR ${fmt(sgr.cupo_credito_sgr)}.`
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTES UI
// ═══════════════════════════════════════════════════════════════════

function Pill({ active, onClick, children, danger, highlight }) {
  let activeCls = 'bg-brand-600 text-white border-brand-600'
  if (danger)     activeCls = 'bg-red-600 text-white border-red-600'
  if (highlight)  activeCls = 'bg-blue-600 text-white border-blue-600'
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors
        ${active
          ? activeCls
          : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
      {children}
    </button>
  )
}

const HITO_KEYS = new Set(['p8_epyme', 'p9_cuenta_comitente'])

function PreguntaRow({ q, value, onChange }) {
  const esHito = HITO_KEYS.has(q.key)
  return (
    <div className={`pb-4 mb-4 border-b last:border-0 last:pb-0 last:mb-0
      ${esHito && value === 'Sí' ? 'border-blue-100 bg-blue-50 -mx-5 px-5 py-3 rounded-lg' : 'border-slate-100'}`}>
      <div className="flex items-start gap-2 mb-2.5">
        <span className={`flex-shrink-0 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold mt-0.5
          ${esHito && value === 'Sí' ? 'bg-blue-600' : 'bg-navy-800'}`}>
          {q.key.replace(/[a-z_]/g,'').replace('p','') || '?'}
        </span>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide
            ${esHito && value === 'Sí' ? 'text-blue-700' : 'text-slate-500'}`}>
            {q.label}
            {esHito && value === 'Sí' && (
              <span className="ml-2 inline-flex items-center gap-0.5">
                <CheckCircle size={11} className="text-blue-600" />
              </span>
            )}
          </p>
          <p className="text-sm font-medium text-navy-800">{q.q}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-7">
        {q.opts.map(opt => (
          <Pill
            key={opt.v}
            active={value === opt.v}
            onClick={() => onChange(opt.v)}
            danger={opt.ex && value === opt.v}
            highlight={esHito && opt.v === 'Sí' && value === 'Sí'}
          >
            {opt.l}
            <span className="ml-1.5 text-xs opacity-75">
              {opt.ex ? '🚫' : opt.pts > 0 ? `+${opt.pts}` : opt.pts < 0 ? `${opt.pts}` : ''}
            </span>
          </Pill>
        ))}
      </div>
    </div>
  )
}

function HitoChip({ label, sublabel, active, loading, onToggle }) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      title={active ? `Desactivar: ${label}` : `Activar: ${label}`}
      className="flex flex-col items-center gap-1.5 px-5 py-3.5 border-2 transition-all
                 cursor-pointer select-none disabled:opacity-60 flex-1"
      style={{
        borderRadius: 3,
        background:   active ? '#1D4ED8' : 'white',
        borderColor:  active ? '#1D4ED8' : '#E0DAD2',
        color:        active ? 'white'   : '#6B6B6B',
      }}>
      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        {label}
      </span>
      {active
        ? <CheckCircle size={18} strokeWidth={2.5} />
        : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid currentColor', opacity: 0.35 }} />
      }
      <span style={{ fontSize: 8.5, fontWeight: 500, color: active ? '#93C5FD' : '#A8A093' }}>
        {loading ? '...' : sublabel}
      </span>
    </button>
  )
}

function ScoreBadge({ score, size = 'md' }) {
  const cat = getCategoria(score)
  return (
    <div className={`inline-flex flex-col items-center bg-nexxo-off border border-nexxo-black px-4 py-2.5 ${size === 'lg' ? 'min-w-28' : ''}`}>
      <span className={`font-serif font-semibold text-nexxo-black ${size === 'lg' ? 'text-7xl leading-none' : 'text-xl'}`}>{score}</span>
      {size === 'lg' && (
        <div className="w-full bg-nexxo-light h-1.5 rounded-full mt-2 mb-1.5">
          <div className="bg-nexxo-black h-1.5 rounded-full transition-all" style={{ width: `${score}%` }} />
        </div>
      )}
      <span className={`font-bold uppercase tracking-wider text-nexxo-black ${size === 'lg' ? 'text-xs' : 'text-[9px]'}`}>{cat}</span>
      <span className="text-[9px] text-nexxo-gray">/ 100</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// GENERADOR PDF
// ═══════════════════════════════════════════════════════════════════

function generarPDF(informeTexto, empresa, periodo, notas, sgr, ratios) {
  const doc   = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  const W     = 210, ML = 20, TW = 170
  // ── Paleta Nexxo Capital ──────────────────────────────────────────
  const NX_BLACK  = [17, 20, 23]   // --nx-black
  const NX_TOPO   = [168, 160, 147] // --nx-topo
  const NX_GRAY   = [107, 107, 107] // --nx-gray
  const NX_OFF    = [245, 244, 241] // --nx-off
  const NX_LIGHT  = [237, 237, 237] // --nx-light
  const fecha = new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' })
  let y       = 0

  const ck = (n = 15) => { if (y + n > 278) { doc.addPage(); y = 20 } }

  function pageHeader() {
    // Fondo off-white fino
    doc.setFillColor(...NX_OFF); doc.rect(0, 0, W, 11, 'F')
    // NEXXO en negro
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...NX_BLACK)
    doc.text('NEXXO CAPITAL', ML, 7)
    // empresa en gris
    doc.setFont('helvetica','normal'); doc.setTextColor(...NX_GRAY)
    doc.text(empresa.nombre || '', W - ML, 7, { align:'right' })
    // Línea topo
    doc.setFillColor(...NX_TOPO); doc.rect(0, 9, W, 0.5, 'F')
  }

  function pageFooter(pageNum, total) {
    doc.setFillColor(...NX_LIGHT); doc.rect(0, 285, W, 0.5, 'F')
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...NX_GRAY)
    doc.text(`Página ${pageNum} de ${total}`, W/2, 291, { align:'center' })
    doc.text('Información confidencial', W-ML, 291, { align:'right' })
  }

  // ── PORTADA NEXXO ─────────────────────────────────────────────────
  // Fondo negro completo
  doc.setFillColor(...NX_BLACK); doc.rect(0, 0, W, 297, 'F')

  // Header negro con wordmark NEXXO CAPITAL
  doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(255,255,255)
  doc.text('NEXXO', ML, 22)
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...NX_TOPO)
  doc.text('CAPITAL', ML, 29)

  // Línea topo separadora
  doc.setFillColor(...NX_TOPO); doc.rect(0, 35, W, 0.8, 'F')

  // Título principal
  doc.setFont('helvetica','bold'); doc.setFontSize(32); doc.setTextColor(255,255,255)
  doc.text('DIAGNÓSTICO', ML, 70)
  doc.text('FINANCIERO', ML, 83)

  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(...NX_TOPO)
  doc.text('Informe de situación financiera integral', ML, 95)

  // Línea divisora topo
  doc.setFillColor(...NX_TOPO); doc.rect(ML, 103, TW, 0.4, 'F')

  // Empresa
  doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(255,255,255)
  const nomEmp = (empresa.nombre || 'Empresa').slice(0, 40)
  doc.text(nomEmp, ML, 118)

  // Datos
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...NX_TOPO)
  doc.text(`Período: ${periodo.periodo}`, ML, 130)
  if (notas.fecha_cierre) doc.text(`Cierre: ${notas.fecha_cierre}`, ML, 137)
  doc.text(`Fecha de emisión: ${fecha}`, ML, notas.fecha_cierre ? 144 : 137)

  // Tagline
  doc.setFontSize(8); doc.setTextColor(...NX_TOPO)
  doc.text('Orden financiero. Acceso a capital.', ML, 270)

  // Línea topo al pie
  doc.setFillColor(...NX_TOPO); doc.rect(0, 278, W, 0.8, 'F')
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...NX_GRAY)
  doc.text('NEXXO CAPITAL · Asesoria Financiera Integral', ML, 285)

  // ── PÁGINA 2: RESUMEN EJECUTIVO ───────────────────────────────────
  doc.addPage(); y = 20
  pageHeader(); y = 18

  doc.setFillColor(...NX_TOPO); doc.rect(ML, y, 3, 8, 'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(...NX_BLACK)
  doc.text('RESUMEN EJECUTIVO', ML + 7, y + 6); y += 16

  const vn   = n(periodo.ventas_netas)
  const ub   = vn - n(periodo.costo_ventas)
  const eb   = ub - n(periodo.gastos_comerciales) - n(periodo.gastos_admin) - n(periodo.gastos_personal)
  const lc   = ratios?.liquidez_corriente || 0
  const lv   = ratios?.leverage || 0

  const kpis = [
    { label:'Ventas netas',     valor: ars(vn),                        color: 'gray'  },
    { label:'EBITDA',           valor: `${ars(eb)} (${pct(eb/vn||0)})`, color: eb/vn>=0.12?'green':'amber' },
    { label:'Liquidez corriente', valor: `${lc.toFixed(2)}x`,           color: lc>=1.2?'green':lc>=1.0?'amber':'red' },
    { label:'Leverage',          valor: `${lv.toFixed(2)}x`,            color: lv<2.0?'green':lv<3.5?'amber':'red'   },
    { label:'Score SGR',         valor: `${sgr.score_total} pts`,        color: sgr.score_total>=55?'green':sgr.score_total>=40?'amber':'red' },
    { label:'Categoría SGR',     valor: sgr.categoria || '—',            color: ['AAA','AA','A'].includes(sgr.categoria)?'green':['BBB'].includes(sgr.categoria)?'amber':'red' },
  ]

  const C = { green:[10,138,122], amber:[217,119,6], red:[220,38,38], gray:[100,116,139] }
  const cW2 = TW / 2 - 3

  kpis.forEach(({ label, valor, color }, i) => {
    const row = Math.floor(i / 2), col = i % 2
    if (row > 0 && col === 0) y += 14
    const cx = ML + col * (cW2 + 6)
    if (col === 0) ck(16)
    doc.setFillColor(248,250,252); doc.setDrawColor(226,232,240)
    doc.roundedRect(cx, y, cW2, 12, 1.5, 1.5, 'FD')
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(100,116,139)
    doc.text(label, cx + 3, y + 4.5)
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...(C[color] || C.gray))
    doc.text(valor, cx + 3, y + 10.5)
  })
  y += 14

  if (sgr.excluyente) {
    y += 5; ck(14)
    doc.setFillColor(254,242,242); doc.setDrawColor(254,202,202)
    doc.roundedRect(ML, y, TW, 11, 1.5, 1.5, 'FD')
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(185,28,28)
    doc.text('⚠ EXCLUYENTE: ' + (sgr.excluyente_motivo || ''), ML + 3, y + 7)
    y += 15
  }

  // ── PÁGINAS DE INFORME ────────────────────────────────────────────
  const seccionActual = { key: null }

  function parseSec(texto, tituloRe, ...nextRes) {
    const re = new RegExp(tituloRe, 'i')
    const m  = texto.match(re)
    if (!m) return ''
    const start = m.index + m[0].length
    let end = texto.length
    for (const nr of nextRes) {
      const r2 = new RegExp(nr, 'i')
      const m2 = texto.slice(start).match(r2)
      if (m2 && start + m2.index < end) end = start + m2.index
    }
    return texto.slice(start, end).replace(/^:?\s*\n?/, '').trim()
  }

  const SECS_PDF = [
    { re:'PERFIL DE LA EMPRESA',              titulo:'PERFIL DE LA EMPRESA',              next:['ANALISIS ECONOM','ANÁLISIS ECONOM'] },
    { re:'AN[ÁA]LISIS ECON',                  titulo:'ANÁLISIS ECONÓMICO',                next:['ANALISIS FINANCIERO','ANÁLISIS FINANCIERO'] },
    { re:'AN[ÁA]LISIS FINANCIERO',            titulo:'ANÁLISIS FINANCIERO Y DE LIQUIDEZ', next:['ANALISIS PATRIMONIAL','ANÁLISIS PATRIMONIAL'] },
    { re:'AN[ÁA]LISIS PATRIMONIAL',           titulo:'ANÁLISIS PATRIMONIAL',              next:['SEMAFORO','SEMÁFORO'] },
    { re:'SEMÁFORO|SEMAFORO',                 titulo:'SEMÁFORO FINANCIERO',               next:['POSICION','POSICIÓN'] },
    { re:'POSICI[ÓO]N SGR',                   titulo:'POSICIÓN SGR Y CUPOS ESTIMADOS',    next:['PRIORIDADES','LAS 3'] },
    { re:'PRIORIDADES|LAS 3',                 titulo:'LAS 3 PRIORIDADES DE ACCIÓN',       next:[] },
  ]

  SECS_PDF.forEach(({ re, titulo, next }) => {
    const contenido = parseSec(informeTexto, re, ...next)
    if (!contenido) return

    doc.addPage(); y = 20
    pageHeader()

    ck(18)
    doc.setFillColor(...NX_TOPO); doc.rect(ML, y, 3, 8, 'F')
    doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(...NX_BLACK)
    doc.text(titulo, ML + 7, y + 5.5)
    doc.setDrawColor(...NX_TOPO); doc.line(ML + 7, y + 8.5, W - ML, y + 8.5)
    y += 14

    contenido.split(/\n{2,}/).filter(p => p.trim()).forEach(p => {
      const lines = doc.splitTextToSize(p.trim(), TW)
      ck(lines.length * 4 + 3)
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(30,41,59)
      doc.text(lines, ML, y)
      y += lines.length * 4 + 2
    })
  })

  // ── CUPOS SGR ────────────────────────────────────────────────────
  doc.addPage(); y = 20
  pageHeader()

  doc.setFillColor(...NX_TOPO); doc.rect(ML, y, 3, 8, 'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(...NX_BLACK)
  doc.text('POSICIÓN FRENTE AL SISTEMA SGR', ML + 7, y + 5.5)
  y += 14

  // Score grande
  doc.setFillColor(...NX_OFF); doc.setDrawColor(...NX_TOPO)
  doc.roundedRect(ML, y, 50, 22, 2, 2, 'FD')
  doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(100,116,139)
  doc.text('SCORE TOTAL', ML + 3, y + 5)
  doc.setFontSize(22); doc.setTextColor(...NX_TOPO)
  doc.text(String(sgr.score_total || 0), ML + 3, y + 16)
  doc.setFontSize(9); doc.setTextColor(...NX_BLACK)
  doc.text(`Categoría: ${sgr.categoria || '—'}`, ML + 55, y + 10)
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(100,116,139)
  doc.text(`Score balance: ${sgr.score_balance || 0} pts  |  Cuestionario: ${sgr.score_cuestionario || 0} pts`, ML + 55, y + 17)
  y += 28

  // Tabla cupos
  const COL_W = [48, 32, 25, 22, 22, 25]
  const COL_X = COL_W.reduce((a, w, i) => { a.push(i === 0 ? ML : a[i-1] + COL_W[i-1]); return a }, [])
  const RH    = 7

  doc.setFillColor(...NX_BLACK); doc.rect(ML, y, TW, RH, 'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(255,255,255)
  ;['Instrumento','Cupo estimado','Plazo','Condición','Tasa c/SGR','Tasa s/SGR'].forEach((h,i) => doc.text(h, COL_X[i]+2, y+5))
  y += RH

  const cuposRows = [
    { instr:'ECHEQs y Facturas FCES', cupo:sgr.cupo_echeqs,         plazo:'Hasta 365 días', condicion:'ePyME',        cSGR:'~75% TNA',  sSGR:'~100% TNA' },
    { instr:'Pagarés bursátiles',     cupo:sgr.cupo_pagares,        plazo:'30 – 180 días',  condicion:'ePyME',        cSGR:'~80% TNA',  sSGR:'~110% TNA' },
    { instr:'Línea con aval SGR',     cupo:sgr.cupo_on_simple,      plazo:'12 – 36 meses',  condicion:'Score ≥ 50',   cSGR:'~65% TNA',  sSGR:'N/A'       },
    { instr:'ON PyME',                cupo:sgr.cupo_on_garantizada, plazo:'24 – 60 meses',  condicion:'Score ≥ 65',   cSGR:'~60% TNA',  sSGR:'~120% TNA' },
    { instr:'Crédito ALYC',           cupo:sgr.cupo_credito_sgr,    plazo:'12 – 48 meses',  condicion:'Score ≥ 65',   cSGR:'~72% TNA',  sSGR:'~100% TNA' },
  ]

  cuposRows.forEach(({ instr, cupo, plazo, condicion, cSGR, sSGR }, idx) => {
    if (idx % 2 === 0) { doc.setFillColor(248,250,252) } else { doc.setFillColor(255,255,255) }
    doc.rect(ML, y, TW, RH, 'F')
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(30,41,59)
    doc.text(instr, COL_X[0]+2, y+5)
    doc.setFont('helvetica','bold'); doc.setTextColor(...NX_TOPO)
    doc.text(ars(n(cupo)), COL_X[1]+2, y+5)
    doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139)
    doc.text(plazo, COL_X[2]+2, y+5)
    doc.setTextColor(...NX_BLACK)
    doc.text(condicion, COL_X[3]+2, y+5)
    doc.setTextColor(...NX_TOPO)
    doc.text(cSGR, COL_X[4]+2, y+5)
    doc.setTextColor(100,116,139)
    doc.text(sSGR, COL_X[5]+2, y+5)
    doc.setDrawColor(226,232,240); doc.line(ML, y+RH, ML+TW, y+RH)
    y += RH
  })

  y += 6
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(100,116,139)
  const nota1 = doc.splitTextToSize('* Tasas de referencia de mercado. Consultar condiciones vigentes al momento de la operación.', TW)
  doc.text(nota1, ML, y)

  // ── GLOSARIO + DISCLAIMER ─────────────────────────────────────────
  doc.addPage(); y = 20
  pageHeader()

  doc.setFillColor(...NX_TOPO); doc.rect(ML, y, 3, 8, 'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(...NX_BLACK)
  doc.text('GLOSARIO DE TÉRMINOS FINANCIEROS', ML + 7, y + 5.5)
  y += 14

  GLOSARIO_PDF.forEach(({ t, d }) => {
    doc.setFontSize(8.5)
    const dl = doc.splitTextToSize(d, TW)
    ck(6 + dl.length * 3.8 + 4)
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(...NX_BLACK)
    doc.text(t + ':', ML, y); y += 4.5
    doc.setFont('helvetica','normal'); doc.setTextColor(71,85,105)
    doc.text(dl, ML, y); y += dl.length * 3.8 + 4
  })

  // Disclaimer
  y += 4; ck(35)
  doc.setDrawColor(226,232,240); doc.line(ML, y, W-ML, y); y += 6
  const disc = `Este informe tiene carácter diagnóstico e informativo. Los datos provienen de la información suministrada por la empresa. Las estimaciones de cupos y tasas son referencias de mercado y no constituyen una oferta de financiamiento. La información contenida es confidencial y de uso exclusivo de la empresa destinataria. NEXXO CAPITAL — ${fecha}`
  const dl2 = doc.splitTextToSize(disc, TW)
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(100,116,139)
  doc.text(dl2, ML, y)

  // ── FOOTERS ───────────────────────────────────────────────────────
  const total = doc.getNumberOfPages ? doc.getNumberOfPages() : doc.internal.getNumberOfPages()
  for (let i = 2; i <= total; i++) { doc.setPage(i); pageFooter(i - 1, total - 1) }

  const nom = (empresa.nombre || 'Empresa').replace(/[^\w\s]/g,'').trim().replace(/\s+/g,'-')
  const per = (periodo.periodo || 'periodo').replace(/[^\w-]/g,'-')
  doc.save(`NEXXO_CAPITAL_Diagnostico_${nom}.pdf`)
}

// ═══════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export default function InformeFinalPage() {
  const { empresaActiva } = useAuth()
  const empresaId = empresaActiva?.id || ''
  const [periodo,   setPeriodo]   = useState(null)
  const [notas,     setNotas]     = useState({})
  const [sgr,       setSgr]       = useState(null)
  const [answers,   setAnswers]   = useState(EMPTY_ANSWERS)
  const [cartera,   setCartera]   = useState('')
  const [garantias, setGarantias] = useState('')
  const [editSgr,   setEditSgr]   = useState(false)
  const [informe,   setInforme]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [generando, setGenerando] = useState(false)
  const [error,     setError]     = useState(null)
  const [diagData,  setDiagData]  = useState({ d1: {}, d4: {} })
  const [hitoSaving, setHitoSaving] = useState(null)


  // Cargar datos cuando cambia la empresa
  useEffect(() => {
    if (!empresaId) return
    setLoading(true); setPeriodo(null); setSgr(null)
    setInforme(''); setError(null); setEditSgr(false)

    Promise.all([
      supabase.from('periodos_financieros').select('*').eq('empresa_id', empresaId)
        .order('periodo', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('scoring_sgr').select('*').eq('empresa_id', empresaId).maybeSingle(),
      adminDb.from('diagnostico_profundo').select('dimension1, dimension4')
        .eq('empresa_id', empresaId).maybeSingle(),
    ]).then(([{ data: p }, { data: s }, { data: dp }]) => {
      const d1 = dp?.dimension1 || {}
      const d4 = dp?.dimension4 || {}
      setDiagData({ d1, d4 })

      if (p) {
        setPeriodo(p)
        try { setNotas(JSON.parse(p.notas || '{}')) } catch { setNotas({}) }
      }
      if (s) {
        setSgr(s)
        setAnswers({
          p1_mipyme:           s.p1_mipyme           || '',
          p2_afip:             s.p2_afip             || '',
          p3_bcra:             s.p3_bcra             || '',
          p4_antiguedad:       s.p4_antiguedad       || '',
          p5_garantias:        s.p5_garantias        || [],
          p6_sociedad:         s.p6_sociedad         || '',
          p7_destino:          s.p7_destino          || '',
          p8_epyme:            s.p8_epyme            || (d1?.es_epyme ? 'Sí' : ''),
          p9_cuenta_comitente: s.p9_cuenta_comitente || (d4?.tiene_cuenta_comitente ? 'Sí' : ''),
        })
        setCartera(s.cartera_echeqs ? String(s.cartera_echeqs) : '')
        setGarantias(s.valor_garantias ? String(s.valor_garantias) : '')
        if (s.informe_ia) setInforme(s.informe_ia)
      } else {
        setAnswers({
          ...EMPTY_ANSWERS,
          p8_epyme:            d1?.es_epyme               ? 'Sí' : '',
          p9_cuenta_comitente: d4?.tiene_cuenta_comitente ? 'Sí' : '',
        })
        setCartera(''); setGarantias('')
        setEditSgr(true)
      }
      setLoading(false)
    })
  }, [empresaId])

  const ratios   = useMemo(() => calcRatios(periodo), [periodo])
  const scoreB   = useMemo(() => periodo ? calcScoreBalance(periodo) : 0, [periodo])
  const ebitda   = useMemo(() => {
    if (!periodo) return 0
    const ub = n(periodo.ventas_netas) - n(periodo.costo_ventas)
    return ub - n(periodo.gastos_comerciales) - n(periodo.gastos_admin) - n(periodo.gastos_personal)
  }, [periodo])
  const ventas        = useMemo(() => n(periodo?.ventas_netas), [periodo])
  const patrimonioNeto = useMemo(() => n(periodo?.patrimonio_neto), [periodo])

  const { score: scoreQ, excluyentes } = useMemo(
    () => calcScoreCuestionario(answers),
    [answers]
  )
  const total     = Math.min(scoreB + scoreQ, 100)
  const categoria = getCategoria(total)
  const esEpyme   = answers.p8_epyme === 'Sí'
  const cupos     = useMemo(
    () => calcCupos(total, ebitda, ventas, patrimonioNeto, esEpyme),
    [total, ebitda, ventas, patrimonioNeto, esEpyme]
  )

  function setAns(k, v) { setAnswers(prev => ({ ...prev, [k]: v })) }
  function toggleP5(v) {
    setAnswers(prev => ({
      ...prev,
      p5_garantias: prev.p5_garantias.includes(v)
        ? prev.p5_garantias.filter(x => x !== v)
        : [...prev.p5_garantias, v],
    }))
  }

  // Hitos derivados del diagData (siempre actualizados)
  const hitoEpyme      = diagData.d1?.es_epyme === true
  const hitoCuentaAlyc = diagData.d4?.tiene_cuenta_comitente === true
  const hitoAvalSgr    = diagData.d4?.tiene_aval_sgr === true

  async function toggleHito(tipo) {
    if (!empresaId) return
    const d1New = { ...diagData.d1 }
    const d4New = { ...diagData.d4 }

    if (tipo === 'epyme') {
      d1New.es_epyme = !hitoEpyme
      setAns('p8_epyme', !hitoEpyme ? 'Sí' : 'No')
    } else if (tipo === 'cuenta_alyc') {
      d4New.tiene_cuenta_comitente = !hitoCuentaAlyc
      setAns('p9_cuenta_comitente', !hitoCuentaAlyc ? 'Sí' : 'No')
    } else if (tipo === 'aval_sgr') {
      d4New.tiene_aval_sgr = !hitoAvalSgr
    }

    setDiagData({ d1: d1New, d4: d4New })
    setHitoSaving(tipo)

    // Usar adminDb para bypassear RLS (asesor escribiendo en datos del cliente)
    const { error: dpErr } = await adminDb.from('diagnostico_profundo').upsert({
      empresa_id: empresaId,
      dimension1: d1New,
      dimension4: d4New,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'empresa_id' })

    if (dpErr) {
      console.error('[toggleHito] Error guardando diagnostico_profundo:', dpErr.message)
      setError(`Error al guardar hito: ${dpErr.message}`)
      setHitoSaving(null)
      return
    }

    // Calcular y actualizar etapa_numero en empresas (visible para el cliente)
    let etapa_numero = 1
    if (d4New.tiene_cuenta_comitente) etapa_numero = 2
    if (d4New.tiene_cuenta_comitente && d1New.es_epyme) etapa_numero = 3
    if (d4New.tiene_cuenta_comitente && d1New.es_epyme && d4New.tiene_aval_sgr) etapa_numero = 4

    const { error: empErr } = await adminDb.from('empresas')
      .update({ etapa_numero })
      .eq('id', empresaId)

    if (empErr) console.warn('[toggleHito] Error actualizando etapa_numero:', empErr.message)

    setHitoSaving(null)
  }

  async function handleGuardarSgr() {
    if (!empresaId || !periodo) return
    setSaving(true); setError(null)
    const payload = {
      empresa_id:         empresaId,
      ...answers,
      score_balance:      scoreB,
      score_cuestionario: scoreQ,
      score_total:        total,
      categoria,
      excluyente:         excluyentes.length > 0,
      excluyente_motivo:  excluyentes.join(' | '),
      cartera_echeqs:     n(cartera),
      valor_garantias:    n(garantias),
      ...cupos,
      updated_at:         new Date().toISOString(),
    }
    const { data, error: err } = await supabase.from('scoring_sgr')
      .upsert(payload, { onConflict: 'empresa_id' }).select().single()
    setSaving(false)
    if (err) { setError(`Error al guardar: ${err.message}`); return }
    setSgr(data)
    setEditSgr(false)
  }

  async function handleGenerar() {
    if (!sgr || !periodo) return
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) { setError('VITE_ANTHROPIC_API_KEY no definida en .env.local'); return }

    setGenerando(true); setError(null)
    const empresaLocal = empresaActiva || {}

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 5000,
          system: SYSTEM_PROMPT,
          messages: [{ role:'user', content: buildMensaje(empresaLocal, periodo, notas, sgr, ratios) }],
        }),
      })
      if (!resp.ok) { const t = await resp.text().catch(()=>''); throw new Error(`HTTP ${resp.status}: ${t.slice(0,100)}`) }
      const payload  = await resp.json()
      const texto    = payload.content?.[0]?.text?.trim() || ''
      setInforme(texto)
      // Guardar informe en scoring_sgr
      await supabase.from('scoring_sgr').update({ informe_ia: texto, updated_at: new Date().toISOString() })
        .eq('empresa_id', empresaId)
    } catch (e) {
      console.error('[InformeFinal]', e)
      setError(e.message)
    } finally {
      setGenerando(false)
    }
  }

  const empresa = empresaActiva || {}

  function handleDescargar() {
    try { generarPDF(informe, empresa, periodo, notas, sgr, ratios) }
    catch (e) { console.error(e); alert('Error al generar PDF: ' + e.message) }
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="Informe diagnóstico financiero"
        subtitle="Análisis integral con scoring SGR"
        actions={null}
      />

      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* ── Verificación de datos ─────────────────────────── */}
          {!loading && (
            <div className="card p-4">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  {periodo
                    ? <CheckCircle size={16} className="text-brand-500" />
                    : <AlertTriangle size={16} className="text-red-500" />}
                  <span className="text-sm font-medium text-navy-800">
                    Balance cargado
                  </span>
                  {periodo && <span className="text-xs text-slate-400">{periodo.periodo}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {sgr
                    ? <CheckCircle size={16} className="text-brand-500" />
                    : <div className="w-4 h-4 rounded-full border-2 border-slate-300" />}
                  <span className="text-sm font-medium text-navy-800">Scoring SGR</span>
                </div>
                {!periodo && (
                  <Link to="/balance" className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 font-medium ml-auto">
                    Ir a Análisis de balance <ExternalLink size={13} />
                  </Link>
                )}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-slate-400">Cargando datos...</p>
            </div>
          )}

          {!loading && !periodo && (
            <div className="card p-6 text-center">
              <AlertTriangle size={24} className="text-amber-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-navy-800 mb-1">Esta empresa no tiene balance cargado</p>
              <p className="text-xs text-slate-400 mb-4">Cargá los datos del balance antes de generar el informe.</p>
              <Link to="/balance" className="btn-primary inline-flex items-center gap-2 text-sm">
                Ir a Análisis de balance <ExternalLink size={14} />
              </Link>
            </div>
          )}

          {/* ── Hitos de ruta al mercado ─────────────────────── */}
          {!loading && (
            <div className="overflow-hidden" style={{ borderRadius: 3, border: '1px solid #E0DAD2' }}>
              {/* Header */}
              <div className="flex items-center gap-2 px-5 py-3" style={{ background: '#111417' }}>
                <div className="w-px h-3.5" style={{ background: 'linear-gradient(to bottom, #4F46E5, #A8A093)' }} />
                <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'white' }}>
                  Hitos de ruta al mercado
                </p>
                <span style={{ fontSize: 7.5, color: '#A8A093', marginLeft: 'auto' }}>
                  Hacé click para activar / desactivar
                </span>
              </div>
              <div className="flex gap-3 p-4" style={{ background: '#F5F4F1' }}>
                <HitoChip
                  label="ePyME"
                  sublabel={hitoEpyme ? 'Inscripta en AFIP' : 'Sin inscripción ePyME'}
                  active={hitoEpyme}
                  loading={hitoSaving === 'epyme'}
                  onToggle={() => toggleHito('epyme')}
                />
                <HitoChip
                  label="Cuenta ALYC"
                  sublabel={hitoCuentaAlyc ? 'Cuenta comitente activa' : 'Sin cuenta comitente'}
                  active={hitoCuentaAlyc}
                  loading={hitoSaving === 'cuenta_alyc'}
                  onToggle={() => toggleHito('cuenta_alyc')}
                />
                <HitoChip
                  label="Aval SGR"
                  sublabel={hitoAvalSgr ? 'Aval de SGR activo' : 'Sin aval SGR'}
                  active={hitoAvalSgr}
                  loading={hitoSaving === 'aval_sgr'}
                  onToggle={() => toggleHito('aval_sgr')}
                />
              </div>
            </div>
          )}

          {/* ── Scoring SGR ───────────────────────────────────── */}
          {!loading && periodo && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-navy-800">Scoring SGR</h3>
                  <p className="text-xs text-slate-400">9 factores de elegibilidad + indicadores del balance</p>
                </div>
                {sgr && !editSgr && (
                  <button onClick={() => setEditSgr(true)} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3">
                    <Edit2 size={12} /> Editar
                  </button>
                )}
              </div>

              {/* Score resumen cuando ya está guardado */}
              {sgr && !editSgr && (
                <div className="p-5">
                  {sgr.excluyente && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 mb-4">
                      <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-800">Condición excluyente detectada</p>
                        <p className="text-xs text-red-700 mt-0.5">{sgr.excluyente_motivo}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-6 flex-wrap">
                    <ScoreBadge score={sgr.score_total} size="lg" />
                    <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                      <div className="text-slate-400">Score balance <span className="font-semibold text-navy-800">{sgr.score_balance} / 50</span></div>
                      <div className="text-slate-400">Score cuestionario <span className="font-semibold text-navy-800">{sgr.score_cuestionario} / 50</span></div>
                      {SCORING_Q.map(q => (
                        <div key={q.key} className="text-slate-500">{q.label}: <span className="text-navy-700">{sgr[q.key] || '—'}</span></div>
                      ))}
                      <div className="text-slate-500">Garantías: <span className="text-navy-700">{(sgr.p5_garantias||[]).join(', ') || '—'}</span></div>
                      <div className="text-slate-500">Destino: <span className="text-navy-700">{sgr.p7_destino || '—'}</span></div>
                    </div>
                  </div>

                  {/* Cupos */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Cupos estimados</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {[
                        { l:'ECHEQs y FCES',     v:sgr.cupo_echeqs,         cond:'ePyME'      },
                        { l:'Pagarés bursátiles', v:sgr.cupo_pagares,        cond:'ePyME'      },
                        { l:'Línea SGR',          v:sgr.cupo_on_simple,      cond:'Score ≥ 50' },
                        { l:'ON PyME',            v:sgr.cupo_on_garantizada, cond:'Score ≥ 65' },
                        { l:'Crédito ALYC',       v:sgr.cupo_credito_sgr,    cond:'Score ≥ 65' },
                      ].map(({ l, v, cond }) => (
                        <div key={l} className="rounded-xl bg-brand-50 border border-brand-100 p-2.5 text-center">
                          <p className="text-xs text-slate-500 mb-0.5">{l}</p>
                          <p className="text-sm font-bold text-brand-800">{ars(n(v))}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">{cond}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Formulario de scoring */}
              {editSgr && (
                <div className="p-5">
                  {/* Score en tiempo real */}
                  <div className="flex items-center gap-4 mb-5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <ScoreBadge score={total} />
                    <div className="text-xs text-slate-500">
                      <p>Balance: <strong className="text-navy-800">{scoreB}</strong> / 50</p>
                      <p>Cuestionario: <strong className="text-navy-800">{scoreQ}</strong> / 50</p>
                    </div>
                    {excluyentes.length > 0 && (
                      <div className="flex-1 p-2 rounded-lg bg-red-50 border border-red-200">
                        <p className="text-xs font-semibold text-red-700">EXCLUYENTE:</p>
                        {excluyentes.map((e,i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
                      </div>
                    )}
                  </div>

                  {/* Preguntas del scoring */}
                  {SCORING_Q.map((q) => (
                    <PreguntaRow key={q.key}
                      q={q}
                      value={answers[q.key]}
                      onChange={v => setAns(q.key, v)} />
                  ))}

                  {/* P5 Garantías */}
                  <div className="pb-4 mb-4 border-b border-slate-100">
                    <div className="flex items-start gap-2 mb-2.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-navy-800 text-white text-xs flex items-center justify-center font-bold mt-0.5">5</span>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Garantías disponibles</p>
                        <p className="text-sm font-medium text-navy-800">¿Qué garantías puede ofrecer la empresa? (capped en 10 pts)</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-7">
                      {P5_OPTS.map(opt => (
                        <Pill key={opt.v} active={(answers.p5_garantias||[]).includes(opt.v)} onClick={() => toggleP5(opt.v)}>
                          {opt.l} <span className="ml-1.5 text-xs opacity-75">+{opt.pts}</span>
                        </Pill>
                      ))}
                    </div>
                  </div>

                  {/* P7 Destino */}
                  <div className="pb-4 mb-4 border-b border-slate-100">
                    <div className="flex items-start gap-2 mb-2.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-navy-800 text-white text-xs flex items-center justify-center font-bold mt-0.5">7</span>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Destino del financiamiento</p>
                        <p className="text-sm font-medium text-navy-800">¿Para qué necesita el financiamiento? (informativo)</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-7">
                      {P7_OPTS.map(v => (
                        <Pill key={v} active={answers.p7_destino === v} onClick={() => setAns('p7_destino', v)}>{v}</Pill>
                      ))}
                    </div>
                  </div>

                  {/* Campos editables para cupos */}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="label">Cartera de ECHEQs disponible ($)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
                        <input type="number" value={cartera} onChange={e => setCartera(e.target.value)} className="input pl-7" placeholder="0" />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Cupo ECHEQs = cartera × 90%: <strong>{ars(n(cartera)*0.9)}</strong></p>
                    </div>
                    <div>
                      <label className="label">Valor de garantías reales ($)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
                        <input type="number" value={garantias} onChange={e => setGarantias(e.target.value)} className="input pl-7" placeholder="0" />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Límite ON garantizada: <strong>{ars(n(garantias)*0.6)}</strong></p>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 mb-4">
                      <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <button onClick={handleGuardarSgr} disabled={saving}
                    className="btn-primary flex items-center gap-2 disabled:opacity-60">
                    <Save size={15} />
                    {saving ? 'Guardando...' : 'Calcular y guardar scoring'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Generación del informe ────────────────────────── */}
          {!loading && periodo && sgr && !editSgr && (
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-navy-800">Informe diagnóstico financiero</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {sgr.excluyente ? 'El scoring tiene condiciones excluyentes — el informe puede igual generarse' : 'Scoring completado — listo para generar'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {informe && (
                    <button onClick={handleDescargar} className="btn-secondary flex items-center gap-2 text-sm">
                      <Download size={14} /> Descargar PDF
                    </button>
                  )}
                  <button onClick={handleGenerar} disabled={generando}
                    className="btn-primary flex items-center gap-2 disabled:opacity-60">
                    {generando ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <><FileText size={15} />{informe ? 'Regenerar informe' : 'Generar informe diagnóstico'}</>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Informe generado ──────────────────────────────── */}
          {informe && (
            <div className="overflow-hidden shadow-nexxo-md">
              {/* ── Header NEXXO ── */}
              <div className="bg-nexxo-black px-10 py-8">
                {/* Isotipo + wordmark en blanco */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center leading-none">
                    <span className="text-2xl font-black text-white" style={{ lineHeight: 1 }}>›</span>
                    <span className="text-2xl font-black text-white" style={{ lineHeight: 1 }}>›</span>
                    <span className="text-2xl font-black text-nexxo-topo" style={{ lineHeight: 1 }}>›</span>
                  </div>
                  <div className="w-px h-7 bg-nexxo-topo opacity-40" />
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-black tracking-[0.18em] text-white">NEXXO</span>
                    <span className="text-[9px] font-medium tracking-[0.35em] text-nexxo-topo mt-0.5">CAPITAL</span>
                  </div>
                </div>
                <h2 className="font-serif text-3xl font-light text-white mb-2">{empresa?.nombre}</h2>
                <p className="text-xs text-nexxo-topo mb-1">
                  {new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' })}
                  {periodo?.periodo && ` · Período ${periodo.periodo}`}
                </p>
                <p className="text-xs text-nexxo-topo italic">Orden financiero. Acceso a capital.</p>
              </div>

              {/* ── Secciones ── */}
              <div className="divide-y divide-nexxo-light">
                {INFORME_SECCIONES.map(({ key, titulo, next }) => {
                  const rePatron = titulo.normalize('NFD').replace(/[̀-ͯ]/g,'')
                  const texto = (() => {
                    const re = new RegExp(titulo.replace(/[ÁÉÍÓÚáéíóú]/g, c => `[${c}${c.normalize('NFD').replace(/[̀-ͯ]/g,'')}]`), 'i')
                    const m  = informe.match(re) || informe.match(new RegExp(rePatron, 'i'))
                    if (!m) return ''
                    const start = m.index + m[0].length
                    let end = informe.length
                    for (const n2 of next) {
                      const m2 = informe.slice(start).search(new RegExp(n2, 'i'))
                      if (m2 !== -1 && start + m2 < end) end = start + m2
                    }
                    return informe.slice(start, end).replace(/^:?\s*\n?/, '').trim()
                  })()
                  if (!texto) return null
                  return (
                    <div key={key} className="px-8 py-6">
                      {/* Eyebrow */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-[18px] h-px bg-nexxo-topo" />
                        <p className="text-[9px] uppercase tracking-[0.2em] text-nexxo-topo">{titulo}</p>
                      </div>
                      <div className="border-t border-nexxo-light my-4" />
                      <div className="space-y-3">
                        {texto.split(/\n{2,}/).filter(p => p.trim()).map((p, i) => (
                          <p key={i} className="text-sm text-nexxo-black leading-relaxed">{p.trim()}</p>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ── Footer ── */}
              <div className="px-8 py-4 bg-nexxo-off border-t border-nexxo-light flex items-center justify-between">
                <p className="text-[10px] text-nexxo-gray uppercase tracking-wider">NEXXO CAPITAL · Información confidencial</p>
                <button onClick={handleDescargar} className="btn-primary flex items-center gap-2">
                  <Download size={13} className="text-nexxo-topo" /> Descargar PDF
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
