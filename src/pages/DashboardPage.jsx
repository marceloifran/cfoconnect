import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { calcRatios, calcSemaforo, ars, pct, ratio, days } from '@/lib/financials'
import { SemaforoGrid } from '@/components/shared/Semaforo'
import { CheckCircle, MessageCircle, FolderOpen, TrendingUp, FileText } from 'lucide-react'
import PanelMercado from '@/components/dashboard/PanelMercado'

// ── Helpers visuales ────────────────────────────────────────────────
const SEM_COLOR = { green:'var(--nx-green)', amber:'var(--nx-amber)', red:'var(--nx-red)', gray:'var(--nx-topo-xl)' }
const SEM_BG    = { green:'var(--nx-green-bg)', amber:'var(--nx-amber-bg)', red:'var(--nx-red-bg)', gray:'var(--nx-off)' }
const SEM_BD    = { green:'var(--nx-green-bd)', amber:'var(--nx-amber-bd)', red:'var(--nx-red-bd)', gray:'var(--nx-light)' }
const SEM_LABEL = { green:'Saludable', amber:'Moderado', red:'Crítico', gray:'Sin datos' }

// ── Patrón universal de sección ─────────────────────────────────────
function NxSection({ titulo, meta, children }) {
  return (
    <div>
      <div className="flex items-center justify-between px-4 py-[9px]"
        style={{ background: 'var(--nx-black)' }}>
        <div className="flex items-center gap-2">
          <div className="w-px h-[14px]"
            style={{ background: 'linear-gradient(to bottom, #4F46E5, #A8A093)' }} />
          <span className="font-bold uppercase tracking-[0.24em] text-white"
            style={{ fontSize: 8.5 }}>
            {titulo}
          </span>
        </div>
        {meta && <span className="font-mono" style={{ fontSize: 8, color: 'var(--nx-topo)' }}>{meta}</span>}
      </div>
      <div className="bg-white p-[18px]"
        style={{ border: '1px solid var(--nx-line)', borderTop: 'none', boxShadow: 'var(--nx-shadow)' }}>
        {children}
      </div>
    </div>
  )
}

// ── KPI Card ────────────────────────────────────────────────────────
function NxKpi({ label, value, context, colorKey = 'sky', isLast }) {
  const dotColor   = { green:'var(--nx-green)', amber:'var(--nx-amber)', red:'var(--nx-red)', sky:'var(--nx-sky)', topo:'var(--nx-topo)' }[colorKey] || 'var(--nx-topo)'
  const badgeBg    = { green:'var(--nx-green-bg)', amber:'var(--nx-amber-bg)', red:'var(--nx-red-bg)', sky:'var(--nx-sky-bg)', topo:'var(--nx-off)' }[colorKey] || 'var(--nx-off)'
  const badgeBd    = { green:'var(--nx-green-bd)', amber:'var(--nx-amber-bd)', red:'var(--nx-red-bd)', sky:'var(--nx-sky-bd)', topo:'var(--nx-light)' }[colorKey] || 'var(--nx-light)'
  const badgeColor = { green:'var(--nx-green)', amber:'var(--nx-amber)', red:'var(--nx-red)', sky:'var(--nx-sky)', topo:'var(--nx-topo)' }[colorKey] || 'var(--nx-topo)'
  const statusText = { green:'↑ Saludable', amber:'→ Moderado', red:'↓ Crítico', sky:'Disponible', topo:'—' }[colorKey] || '—'

  return (
    <div className="px-4 pb-4 md:pb-0 mb-4 md:mb-0" style={{ borderRight: isLast ? 'none' : '1px solid var(--nx-line)' }}>
      <div className="flex items-center gap-1.5 mb-1.5"
        style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--nx-topo)' }}>
        <div className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: dotColor }} />
        {label}
      </div>
      <div className="font-serif leading-none tracking-tight mb-1"
        style={{ fontSize: 30, fontWeight: 600, color: 'var(--nx-black)' }}>
        {value}
      </div>
      {context && (
        <p className="font-mono mb-1.5" style={{ fontSize: 9, color: 'var(--nx-gray)' }}>{context}</p>
      )}
      <span className="inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded-sm"
        style={{ fontSize: 9, background: badgeBg, color: badgeColor, border: `1px solid ${badgeBd}` }}>
        {statusText}
      </span>
    </div>
  )
}

// ── Barra de progreso — 5 pasos ─────────────────────────────────────
// Helpers localStorage — mismas keys que DiagnosticoPage
function lsHito(empId, hito) { return localStorage.getItem(`nx_hito_${empId}_${hito}`) === '1' }

function BarraDiagnostico({ estado, empresaId, navigate }) {
  // Combinar DB + localStorage: usar el estado más avanzado disponible
  const balanceOk  = !!estado?.balance_subido_por_cliente  || lsHito(empresaId, 'balance')
  const encuestaOk = !!estado?.encuesta_completada         || lsHito(empresaId, 'encuesta')
  const informeOk  = !!estado?.informe_publicado

  // et: tomar el mayor entre DB y lo que indican los hitos locales
  const etDB  = estado?.etapa_diagnostico ?? 1
  const etLocal = encuestaOk ? 3 : balanceOk ? 2 : 1
  const et = Math.max(etDB, etLocal)

  const STEPS = [
    { n: 1, label: 'Cuenta activada' },
    { n: 2, label: 'Tu información'  },
    { n: 3, label: 'En revisión'     },
    { n: 4, label: 'Tu informe'      },
    { n: 5, label: 'Próximos pasos'  },
  ]

  function stepState(n) {
    if (n === 1) return 'done'
    // Paso 2 completo si: ambos flags OK, o etapa ya avanzó a 3+
    if (n === 2) {
      if ((balanceOk && encuestaOk) || et >= 3) return 'done'
      if (balanceOk || encuestaOk || et >= 2)   return 'partial'
      return 'pending'
    }
    if (n === 3) return et >= 3 ? 'done' : 'pending'
    if (n === 4) return informeOk ? 'done' : et === 4 ? 'active' : 'pending'
    if (n === 5) return et >= 5 ? 'done' : 'pending'
    return 'pending'
  }

  let msg = null
  // et === 1: el banner de arriba ya muestra "El primer paso es subir tu balance"
  if (et === 2 && !balanceOk)  msg = { text:'Subí tu balance para continuar.', btn:'Subir balance', to:'/mi-perfil' }
  else if (et === 2 && !encuestaOk) msg = { text:'Completá las preguntas sobre tu empresa.', btn:'Completar', to:'/mi-perfil' }
  else if (et === 3) msg = { text:'Tu asesor está preparando tu diagnóstico. Te avisaremos cuando esté listo.' }
  else if (et === 4) msg = { text:'¡Tu informe está listo!', btn:'Ver mi informe', to:'/mi-informe' }
  else if (et >= 5) msg = { text:'Diagnóstico completo.', btn:'Ver mi ruta', to:'/mi-ruta' }

  return (
    <div style={{ background: 'var(--nx-white)', border: '1px solid var(--nx-line)', borderTop: '3px solid var(--nx-black)', boxShadow: 'var(--nx-shadow)', padding: '16px', marginBottom: 20 }}>
      {/* Label con línea */}
      <p className="flex items-center font-bold uppercase mb-3"
        style={{ fontSize: 8, letterSpacing: '0.22em', color: 'var(--nx-topo)' }}>
        Tu progreso en la plataforma
        <span className="flex-1 ml-2" style={{ height: 1, background: 'var(--nx-line)' }} />
      </p>

      {/* Steps */}
      <div className="overflow-x-auto pb-4 mb-2">
        <div className="flex items-start min-w-[500px]">
        {STEPS.map((s, i) => {
          const st = stepState(s.n)
          const isLast = i === STEPS.length - 1
          let circleStyle = {}
          if (st === 'done' || st === 'partial') {
            circleStyle = { background: 'var(--nx-black)', color: 'white' }
          } else if (st === 'active') {
            circleStyle = { background: 'var(--nx-indigo)', color: 'white',
              boxShadow: '0 0 0 3px white, 0 0 0 5px var(--nx-indigo-bd)' }
          } else {
            circleStyle = { background: 'white', border: '1.5px solid var(--nx-light)', color: 'var(--nx-topo-xl)' }
          }
          return (
            <div key={s.n} className="flex items-start flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center font-bold font-mono flex-shrink-0 transition-all"
                  style={{ ...circleStyle, fontSize: 10 }}>
                  {st === 'done' || st === 'partial' ? <CheckCircle size={12} /> : s.n}
                </div>
                <p className="text-center mt-1.5 font-medium leading-tight"
                  style={{ fontSize: 9, color: st === 'pending' ? 'var(--nx-topo-xl)' : st === 'active' ? 'var(--nx-black)' : 'var(--nx-black)' }}>
                  {s.label}
                </p>
                {st === 'active' && (
                  <span className="mt-1 text-white font-bold px-1.5 py-0.5"
                    style={{ fontSize: 7, letterSpacing: '0.06em', background: 'var(--nx-indigo)', borderRadius: 2 }}>
                    AQUÍ
                  </span>
                )}
              </div>
              {!isLast && (
                <div className="flex-1 mt-3 mx-1" style={{ height: 1, background: (st === 'done') ? 'var(--nx-black)' : 'var(--nx-light)' }} />
              )}
            </div>
          )
        })}
        </div>
      </div>

      {msg && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-3 sm:gap-0"
          style={{ background: 'var(--nx-indigo-bg)', border: '1px solid var(--nx-indigo-bd)',
            borderLeft: '3px solid var(--nx-indigo)', borderRadius: 2 }}>
          <p style={{ fontSize: 11, color: 'var(--nx-black)' }}>{msg.text}</p>
          {msg.btn && (
            <button onClick={() => navigate(msg.to)}
              className="font-bold uppercase tracking-wider ml-4 flex-shrink-0 transition-colors"
              style={{ background: 'var(--nx-indigo)', color: 'white', padding: '6px 14px', fontSize: 9, letterSpacing: '0.12em', borderRadius: 2 }}
              onMouseEnter={e => e.currentTarget.style.background = '#3730a3'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--nx-indigo)'}>
              {msg.btn} →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Ruta al mercado ─────────────────────────────────────────────────
const RUTA_ETAPAS = [
  {
    n: 1,
    label: 'Orden tributario',
    req: 'CUIT activo · sin deuda AFIP',
    desc: 'Base obligatoria. Con el CUIT habilitado y situación fiscal en orden podés operar en el mercado.',
    accede: ['Consultas de elegibilidad', 'Apertura de cuenta ALYC'],
  },
  {
    n: 2,
    label: 'Cuenta comitente ALYC',
    req: 'Apertura de cuenta en tu agente de bolsa',
    desc: 'Con la cuenta comitente activa podés invertir tu excedente de caja sin intermediarios bancarios.',
    accede: ['FCIs money market', 'Cauciones bursátiles', 'Dólar linked', 'LECAPS', 'ONs de inversión'],
  },
  {
    n: 3,
    label: 'ePyME',
    req: 'Inscripción ePyME en AFIP',
    desc: 'La categoría ePyME habilita el descuento de tus propios documentos en el mercado a tasa bursátil.',
    accede: ['Descuento de ECHEQs propios', 'Facturas de crédito FCES', 'Pagarés bursátiles'],
  },
  {
    n: 4,
    label: 'Aval SGR',
    req: 'Score ≥ 50 · activos como garantía',
    desc: 'El aval de una Sociedad de Garantía Recíproca mejora tu tasa y amplía el cupo disponible.',
    accede: ['Cheques y pagarés avalados', 'Líneas de crédito con aval', 'Tasas preferenciales'],
  },
  {
    n: 5,
    label: 'ON PyME',
    req: 'Score ≥ 65 · empresa estructurada',
    desc: 'El instrumento más avanzado: tu empresa emite una Obligación Negociable y capta inversores directamente.',
    accede: ['ON Simple PyME', 'Emisión pública o privada', 'Financiamiento a largo plazo'],
  },
]

function RutaMercado({ score = 0, etapaActual = 1 }) {
  const etapaRuta = score >= 65 ? Math.max(etapaActual, 5) : etapaActual

  return (
    <NxSection titulo="Ruta al mercado de capitales" meta={score > 0 ? `Score: ${score}/100` : undefined}>

      {/* Barra de progreso */}
      <div className="overflow-x-auto pb-4 mb-5">
        <div className="relative flex justify-between min-w-[600px]">
          <div className="absolute top-3 left-3 right-3 h-px" style={{ background: 'var(--nx-light)' }} />
        <div className="absolute top-3 left-3 h-px transition-all duration-500"
          style={{ width: `${Math.min(((etapaRuta - 1) / 4) * 100, 100)}%`, background: 'var(--nx-black)' }} />
        {RUTA_ETAPAS.map(etapa => {
          const completada = etapa.n < etapaRuta
          const activa     = etapa.n === etapaRuta
          let circleStyle = {}
          if (completada)  circleStyle = { background: 'var(--nx-black)', color: 'white' }
          else if (activa) circleStyle = { background: 'var(--nx-indigo)', color: 'white',
            boxShadow: '0 0 0 3px white, 0 0 0 5px var(--nx-indigo-bd)' }
          else             circleStyle = { background: 'white', border: '1px solid var(--nx-light)', color: 'var(--nx-topo-xl)' }
          return (
            <div key={etapa.n} className="flex flex-col items-center z-10" style={{ width: '20%' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all"
                style={circleStyle}>
                {completada ? <CheckCircle size={11} /> : etapa.n}
              </div>
              <p className="text-center mt-1.5 leading-tight font-bold"
                style={{ fontSize: 7.5, color: (activa || completada) ? 'var(--nx-black)' : 'var(--nx-topo)' }}>
                {etapa.label}
              </p>
              {activa && (
                <span className="mt-1 text-white font-bold px-1 py-0.5"
                  style={{ fontSize: 7, background: 'var(--nx-indigo)', borderRadius: 2 }}>AQUÍ</span>
              )}
            </div>
          )
        })}
        </div>
      </div>

      {/* Lista de etapas con descripción */}
      <div style={{ borderTop: '1px solid var(--nx-line)' }}>
        {RUTA_ETAPAS.map(etapa => {
          const completada = etapa.n < etapaRuta
          const activa     = etapa.n === etapaRuta
          const pendiente  = etapa.n > etapaRuta

          return (
            <div key={etapa.n}
              className="flex gap-3 py-3"
              style={{ borderBottom: '1px solid var(--nx-off)' }}>

              {/* Indicador */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: completada ? 'var(--nx-black)' : activa ? 'var(--nx-indigo)' : 'var(--nx-off)',
                    border: pendiente ? '1px solid var(--nx-light)' : 'none',
                  }}>
                  {completada
                    ? <CheckCircle size={10} color="white" />
                    : <span style={{ fontSize: 8, fontWeight: 700, color: activa ? 'white' : 'var(--nx-topo-xl)' }}>{etapa.n}</span>}
                </div>
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p style={{
                    fontSize: 11, fontWeight: 700,
                    color: pendiente ? 'var(--nx-topo)' : 'var(--nx-black)',
                  }}>
                    {etapa.label}
                  </p>
                  {completada && (
                    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
                      background: 'var(--nx-green-bg)', color: 'var(--nx-green)', border: '1px solid var(--nx-green-bd)',
                      padding: '1px 6px', borderRadius: 2 }}>
                      COMPLETADO
                    </span>
                  )}
                  {activa && (
                    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
                      background: 'var(--nx-indigo-bg)', color: 'var(--nx-indigo)', border: '1px solid var(--nx-indigo-bd)',
                      padding: '1px 6px', borderRadius: 2 }}>
                      ETAPA ACTUAL
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 9.5, color: pendiente ? 'var(--nx-topo-xl)' : 'var(--nx-gray)', lineHeight: 1.5, marginBottom: 4 }}>
                  {etapa.desc}
                </p>

                {/* Productos accesibles */}
                {!pendiente && (
                  <div className="flex flex-wrap gap-1">
                    {etapa.accede.map(prod => (
                      <span key={prod} style={{
                        fontSize: 8, fontWeight: 600,
                        background: completada ? 'var(--nx-off)' : 'var(--nx-indigo-bg)',
                        color:      completada ? 'var(--nx-topo)' : 'var(--nx-indigo)',
                        border:     `1px solid ${completada ? 'var(--nx-light)' : 'var(--nx-indigo-bd)'}`,
                        padding: '2px 6px', borderRadius: 2,
                      }}>
                        {prod}
                      </span>
                    ))}
                  </div>
                )}

                {/* Requisito para etapas pendientes */}
                {pendiente && (
                  <p style={{ fontSize: 8.5, color: 'var(--nx-topo-xl)', fontStyle: 'italic' }}>
                    Requiere: {etapa.req}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

    </NxSection>
  )
}

// ── Semáforo financiero ─────────────────────────────────────────────
function SemaforoNexxo({ areas }) {
  return (
    <NxSection titulo="Semáforo financiero">
      <div className="space-y-0">
        {areas.map(({ label, color, badge, desc }) => {
          const c = color || 'gray'
          return (
            <div key={label} className="flex items-center justify-between py-2 last:border-0"
              style={{ borderBottom: '1px solid var(--nx-off)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                  style={{ background: SEM_COLOR[c] }} />
                <div>
                  <p className="font-medium" style={{ fontSize: 11, color: 'var(--nx-black)' }}>{label}</p>
                  {desc && <p className="font-mono" style={{ fontSize: 9.5, color: 'var(--nx-topo)' }}>{desc}</p>}
                </div>
              </div>
              <span className="font-bold px-2 py-[3px] rounded-sm"
                style={{ fontSize: 8.5, background: SEM_BG[c], color: SEM_COLOR[c], border: `1px solid ${SEM_BD[c]}` }}>
                {badge || SEM_LABEL[c]}
              </span>
            </div>
          )
        })}
      </div>
    </NxSection>
  )
}

// ── Score SGR ───────────────────────────────────────────────────────
function ScoreSGR({ sgr }) {
  const score = sgr?.score_total || 0
  const cat   = sgr?.categoria || '—'
  const DESC  = { AAA:'Excelente elegibilidad', AA:'Muy buena elegibilidad', A:'Buena elegibilidad', BBB:'Elegibilidad moderada', BB:'Elegibilidad baja', 'Sin elegibilidad':'No elegible' }
  const cupos = [
    { label:'ECHEQs',          v: sgr?.cupo_echeqs,          state:'green' },
    { label:'Pagarés',         v: sgr?.cupo_pagares,         state:'green' },
    { label:'ON PyME',         v: sgr?.cupo_on_simple,       state:'sky'   },
    { label:'ON Garantizada',  v: sgr?.cupo_on_garantizada,  state:'sky'   },
    { label:'Crédito SGR',     v: sgr?.cupo_credito_sgr,     state:'amber' },
  ].filter(c => c.v > 0)

  const STATE_BG = { green:'var(--nx-green-bg)', sky:'var(--nx-sky-bg)', amber:'var(--nx-amber-bg)', red:'var(--nx-red-bg)' }
  const STATE_BD = { green:'var(--nx-green)', sky:'var(--nx-sky)', amber:'var(--nx-amber)', red:'var(--nx-red)' }

  return (
    <NxSection titulo="Scoring SGR" meta={cat}>
      {/* Número + barra */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
        <div className="font-serif font-semibold leading-none tracking-tight"
          style={{ fontSize: 64, color: 'var(--nx-black)' }}>
          {score}
        </div>
        <div>
          <p className="font-bold uppercase mb-2"
            style={{ fontSize: 8, letterSpacing: '0.2em', color: 'var(--nx-topo)' }}>
            Score SGR — 0 a 100 pts
          </p>
          <div className="w-[130px] h-[5px] rounded-full overflow-hidden mb-1.5"
            style={{ background: 'var(--nx-light)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: score + '%', background: 'linear-gradient(90deg, var(--nx-black) 0%, var(--nx-indigo) 40%, var(--nx-amber) 70%, var(--nx-green) 100%)' }} />
          </div>
          <p className="font-semibold" style={{ fontSize: 10, color: 'var(--nx-topo)' }}>
            {cat} — {DESC[cat] || ''}
          </p>
        </div>
      </div>

      {/* Cupos */}
      {cupos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {cupos.map(({ label, v, state }) => (
            <div key={label} className="p-2.5"
              style={{ background: STATE_BG[state], borderLeft: `2px solid ${STATE_BD[state]}` }}>
              <p className="font-semibold mb-0.5"
                style={{ fontSize: 7.5, color: 'var(--nx-topo)' }}>{label}</p>
              <p className="font-mono font-bold"
                style={{ fontSize: 11, color: 'var(--nx-black)' }}>{ars(v)}</p>
            </div>
          ))}
        </div>
      )}
    </NxSection>
  )
}

// ── Accesos rápidos ─────────────────────────────────────────────────
function AccesoRapido({ to, icon: Icon, label, badge }) {
  return (
    <Link to={to} className="flex items-center justify-between p-3 transition-colors group"
      style={{ border: '1px solid var(--nx-line)', background: 'white', borderRadius: 2 }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--nx-off)'}
      onMouseLeave={e => e.currentTarget.style.background = 'white'}>
      <div className="flex items-center gap-2.5">
        <Icon size={13} style={{ color: 'var(--nx-topo)' }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--nx-black)' }}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge > 0 && (
          <span className="w-4 h-4 rounded-full text-white text-[8px] flex items-center justify-center font-bold"
            style={{ background: 'var(--nx-red)' }}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
        <span style={{ fontSize: 10, color: 'var(--nx-topo-xl)' }}>›</span>
      </div>
    </Link>
  )
}

// ── Tooltip gráfico ─────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white px-3 py-2" style={{ border: '1px solid var(--nx-line)', boxShadow: 'var(--nx-shadow)', fontSize: 10 }}>
      <p style={{ color: 'var(--nx-topo)' }}>{label}</p>
      <p className="font-semibold" style={{ color: 'var(--nx-black)' }}>{ars(payload[0]?.value)}</p>
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────────
export default function DashboardPage() {
  const { empresa } = useAuth()
  const navigate    = useNavigate()

  const [periodos,   setPeriodos]   = useState([])
  const [sgr,        setSgr]        = useState(null)
  const [alertasDB,  setAlertasDB]  = useState([])
  const [mensajes,   setMensajes]   = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [estadoDiag, setEstadoDiag] = useState(null)

  useEffect(() => {
    if (!empresa?.id) return

    // Carga principal (una vez)
    Promise.all([
      supabase.from('periodos_financieros').select('*').eq('empresa_id', empresa.id)
        .order('periodo', { ascending: false }).limit(5),
      supabase.from('scoring_sgr').select('*').eq('empresa_id', empresa.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('alertas').select('*').eq('empresa_id', empresa.id)
        .eq('leida', false).order('created_at', { ascending: false }).limit(5),
      supabase.from('mensajes').select('id', { count:'exact', head:true })
        .eq('empresa_id', empresa.id).eq('remitente_rol', 'asesor').eq('leido', false),
    ]).then(([per, sc, alt, msg]) => {
      setPeriodos(per.data || [])
      setSgr(sc.data)
      setAlertasDB(alt.data || [])
      setMensajes(msg.count || 0)
      setLoading(false)
    })

    // Polling de empresas cada 5s — incluye etapa_numero (fuente de verdad para la ruta)
    const empId = empresa.id
    function fetchEmpresa() {
      supabase.from('empresas')
        .select('etapa_diagnostico, etapa_numero, balance_subido_por_cliente, encuesta_completada, informe_publicado')
        .eq('id', empId)
        .maybeSingle()
        .then(({ data }) => { if (data) setEstadoDiag(data) })
    }

    fetchEmpresa()
    const interval = setInterval(fetchEmpresa, 5000)
    return () => clearInterval(interval)
  }, [empresa?.id])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--nx-off)' }}>
      <p style={{ fontSize: 12, color: 'var(--nx-topo)' }}>Cargando...</p>
    </div>
  )

  const ultimo        = periodos[0]
  const ratios        = calcRatios(ultimo)
  const semaforo      = calcSemaforo(ratios)
  const score         = sgr?.score_total || 0
  const et            = estadoDiag?.etapa_diagnostico ?? 1
  const chartData     = [...periodos].reverse().map(p => ({ name: p.periodo, ventas: p.ventas_netas }))
  const semaforoAreas = buildSemaforoAreas(semaforo)

  // Determinar KPI color
  const kpiLiqColor = ratios?.liquidez_corriente >= 1.5 ? 'green' : ratios?.liquidez_corriente >= 1.0 ? 'amber' : 'red'
  const kpiEbColor  = ratios?.margen_ebitda >= 0.15 ? 'green' : ratios?.margen_ebitda >= 0.08 ? 'amber' : 'red'
  const kpiCceColor = ratios?.cce < 45 ? 'green' : ratios?.cce < 70 ? 'amber' : 'red'

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--nx-off)', fontFamily: 'Montserrat, sans-serif' }}>
      <div className="p-4 md:p-7 mx-auto" style={{ maxWidth: 1100 }}>

        {/* ── PASO 3: Page Header ── */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-5 pb-5 -mx-4 px-4 md:-mx-7 md:px-7 gap-3 md:gap-0"
          style={{ borderBottom: '2px solid var(--nx-black)',
            background: 'linear-gradient(to right, var(--nx-indigo-bg), transparent)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1"
              style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--nx-topo)' }}>
              <div className="w-4" style={{ height: 1, background: 'var(--nx-topo)' }} />
              Panel de empresa
            </div>
            <h1 className="font-serif tracking-tight leading-tight"
              style={{ fontSize: 26, fontWeight: 600, color: 'var(--nx-black)' }}>
              {empresa?.nombre || 'Mi empresa'}
            </h1>
            <p className="font-mono mt-1"
              style={{ fontSize: 10, color: 'var(--nx-gray)' }}>
              {ultimo ? `Período ${ultimo.periodo}` : 'Sin datos cargados'}
              {ultimo ? ` · Último análisis: ${new Date().toLocaleDateString('es-AR')}` : ''}
            </p>
          </div>
        </div>

        {/* ── Pasos de acción (visibles hasta que ambos estén completos) ── */}
        {et < 3 && (() => {
          const balOk = !!estadoDiag?.balance_subido_por_cliente || lsHito(empresa?.id, 'balance')
          const encOk = !!estadoDiag?.encuesta_completada       || lsHito(empresa?.id, 'encuesta')
          return (
            <div className="space-y-2 mb-5">

              {/* Paso 1 — Balance */}
              {balOk ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-3 sm:gap-0"
                  style={{ background: 'var(--nx-green-bg)', border: '1px solid var(--nx-green-bd)',
                    borderLeft: '3px solid var(--nx-green)', borderRadius: 2 }}>
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="9" fill="var(--nx-green)" />
                      <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p style={{ fontSize: 11, color: 'var(--nx-green)', fontWeight: 600 }}>
                      Paso 1 — Balance recibido
                    </p>
                  </div>
                  <span className="font-bold uppercase tracking-wider px-3 py-1"
                    style={{ fontSize: 9, letterSpacing: '0.12em', background: 'var(--nx-green)',
                      color: 'white', borderRadius: 2 }}>
                    Listo ✓
                  </span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-3 sm:gap-0"
                  style={{ background: 'var(--nx-indigo-bg)', border: '1px solid var(--nx-indigo-bd)',
                    borderLeft: '3px solid var(--nx-indigo)', borderRadius: 2 }}>
                  <p style={{ fontSize: 11, color: 'var(--nx-black)' }}>
                    <span className="font-bold">El primer paso es subir tu balance.</span>
                    {' '}Tu asesor lo analiza y te entrega el diagnóstico en 48 horas.
                  </p>
                  <button onClick={() => navigate('/mi-perfil')}
                    className="font-bold uppercase tracking-wider ml-4 whitespace-nowrap flex-shrink-0 transition-colors"
                    style={{ background: 'var(--nx-indigo)', color: 'white', padding: '8px 16px', fontSize: 9, letterSpacing: '0.12em', borderRadius: 2 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#3730a3'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--nx-indigo)'}>
                    Empezar →
                  </button>
                </div>
              )}

              {/* Paso 2 — Encuesta (aparece solo si el balance ya fue subido) */}
              {balOk && (
                encOk ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-3 sm:gap-0"
                    style={{ background: 'var(--nx-green-bg)', border: '1px solid var(--nx-green-bd)',
                      borderLeft: '3px solid var(--nx-green)', borderRadius: 2 }}>
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="9" fill="var(--nx-green)" />
                        <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <p style={{ fontSize: 11, color: 'var(--nx-green)', fontWeight: 600 }}>
                        Paso 2 — Encuesta completada
                      </p>
                    </div>
                    <span className="font-bold uppercase tracking-wider px-3 py-1"
                      style={{ fontSize: 9, letterSpacing: '0.12em', background: 'var(--nx-green)',
                        color: 'white', borderRadius: 2 }}>
                      Listo ✓
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-3 sm:gap-0"
                    style={{ background: 'var(--nx-indigo-bg)', border: '1px solid var(--nx-indigo-bd)',
                      borderLeft: '3px solid var(--nx-indigo)', borderRadius: 2 }}>
                    <p style={{ fontSize: 11, color: 'var(--nx-black)' }}>
                      <span className="font-bold">El segundo paso es completar la encuesta.</span>
                      {' '}Son 8 preguntas simples — menos de 5 minutos.
                    </p>
                    <button onClick={() => navigate('/mi-perfil')}
                      className="font-bold uppercase tracking-wider ml-4 whitespace-nowrap flex-shrink-0 transition-colors"
                      style={{ background: 'var(--nx-indigo)', color: 'white', padding: '8px 16px', fontSize: 9, letterSpacing: '0.12em', borderRadius: 2 }}
                      onMouseEnter={e => e.currentTarget.style.background = '#3730a3'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--nx-indigo)'}>
                      Completar →
                    </button>
                  </div>
                )
              )}

            </div>
          )
        })()}

        {/* ── PASO 5: Barra de progreso ── */}
        <BarraDiagnostico estado={estadoDiag} empresaId={empresa?.id} navigate={navigate} />

        {/* ── PASO 7: KPIs ── */}
        {ultimo && (
          <div className="mb-5">
            <NxSection titulo="Indicadores financieros" meta={ultimo.periodo}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-4 md:gap-y-0">
                <NxKpi label="Ventas netas" value={ars(ultimo.ventas_netas)} context={`Período ${ultimo.periodo}`} colorKey="sky" />
                <NxKpi label="Margen EBITDA" value={pct(ratios?.margen_ebitda)} context="Sobre ventas netas" colorKey={kpiEbColor} />
                <NxKpi label="Liquidez corriente" value={ratio(ratios?.liquidez_corriente)} context="Activo / pasivo cte." colorKey={kpiLiqColor} />
                <NxKpi label="Ciclo de caja" value={days(ratios?.cce)} context="Días de capital de trabajo" colorKey={kpiCceColor} isLast />
              </div>
            </NxSection>
          </div>
        )}

        {/* ── Gráfico + Semáforo ── */}
        {ultimo && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">
            <div className="lg:col-span-3">
              <PanelMercado />
            </div>
            <div className="lg:col-span-2">
              {semaforoAreas.length > 0
                ? <SemaforoNexxo areas={semaforoAreas} />
                : (
                  <NxSection titulo="Semáforo financiero">
                    <p style={{ fontSize: 11, color: 'var(--nx-topo)', textAlign: 'center', padding: '24px 0' }}>
                      Disponible después del diagnóstico
                    </p>
                  </NxSection>
                )
              }
            </div>
          </div>
        )}

        {/* ── PASO 8: Ruta al mercado ── */}
        <div className="mb-5">
          <RutaMercado score={score} etapaActual={estadoDiag?.etapa_numero || 1} />
        </div>

        {/* ── PASO 10: Score SGR ── */}
        {sgr && sgr.score_total > 0 && (
          <div className="mb-5">
            <ScoreSGR sgr={sgr} />
          </div>
        )}

        {/* ── Alertas ── */}
        {(alertasDB.length > 0) && (
          <div className="mb-5">
            <NxSection titulo="Alertas y recomendaciones">
              <div className="space-y-2">
                {alertasDB.map(a => {
                  const c = a.nivel === 'critico' ? 'red' : a.nivel === 'alto' ? 'amber' : 'green'
                  return (
                    <div key={a.id} className="p-3" style={{ background: SEM_BG[c], borderLeft: `2px solid ${SEM_COLOR[c]}` }}>
                      <p className="font-semibold text-[11px] text-[var(--nx-black)] uppercase" style={{ fontSize: 9, color: SEM_COLOR[c], fontWeight: 700 }}>
                        {c === 'red' ? 'Crítico' : c === 'amber' ? 'Atención' : 'Positivo'}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--nx-black)', marginTop: 2 }}>{a.mensaje}</p>
                    </div>
                  )
                })}
              </div>
            </NxSection>
          </div>
        )}

        {/* ── Accesos rápidos ── */}
        <NxSection titulo="Accesos rápidos">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <AccesoRapido to="/mi-perfil"  icon={FileText}       label="Mi perfil financiero" />
            <AccesoRapido to="/mi-informe" icon={TrendingUp}     label="Mi informe" />
            <AccesoRapido to="/mensajes"   icon={MessageCircle}  label="Mensajes con mi asesor" badge={mensajes} />
            <AccesoRapido to="/documentos" icon={FolderOpen}     label="Mis documentos" />
          </div>
        </NxSection>

      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────
function buildSemaforoAreas(sem) {
  if (!sem) return []
  return [
    { label:'Rentabilidad',  color: sem.rentabilidad?.color,  badge: sem.rentabilidad?.label,  desc: sem.rentabilidad?.desc  },
    { label:'Liquidez',      color: sem.liquidez?.color,      badge: sem.liquidez?.label,      desc: sem.liquidez?.desc      },
    { label:'Endeudamiento', color: sem.endeudamiento?.color, badge: sem.endeudamiento?.label, desc: sem.endeudamiento?.desc },
    { label:'Ciclo de caja', color: sem.ciclo_caja?.color,   badge: sem.ciclo_caja?.label,   desc: sem.ciclo_caja?.desc   },
    { label:'Cobertura',     color: sem.cobertura?.color,    badge: sem.cobertura?.label,    desc: sem.cobertura?.desc    },
  ]
}
