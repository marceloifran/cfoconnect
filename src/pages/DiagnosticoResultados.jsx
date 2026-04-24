import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { calcRatios, calcSemaforo, ars } from '@/lib/financials'
import PageHeader from '@/components/shared/PageHeader'
import {
  Building2, TrendingUp, Wallet, Shield,
  Clock, MessageCircle, Rocket, CheckCircle, Edit2,
} from 'lucide-react'

// ── Semáforo en lenguaje simple ────────────────────────────────────
const METRICAS = [
  {
    clave: 'liquidez',
    titulo: 'Tu capacidad de pagar lo que debés a corto plazo',
    frases: {
      green: 'Tenés dinero suficiente para afrontar todos tus compromisos del año. Bien.',
      amber: 'Tenés lo justo — un mes difícil puede ponerte en aprietos. Conviene reforzar el colchón.',
      red:   'Puede costarte afrontar los pagos que vencen pronto. Es importante revisar esto con tu asesor.',
    },
  },
  {
    clave: 'rentabilidad',
    titulo: 'Cuánto te queda después de pagar todos los costos',
    frases: {
      green: 'Tu empresa genera buen excedente. Los márgenes están en zona saludable.',
      amber: 'Los márgenes son ajustados. Hay oportunidad de mejorar la rentabilidad.',
      red:   'Los costos se llevan casi toda la ganancia. Hay que revisar la estructura de costos.',
    },
  },
  {
    clave: 'endeudamiento',
    titulo: 'Qué tan endeudada está tu empresa',
    frases: {
      green: 'El nivel de deuda es manejable en relación al tamaño de tu empresa.',
      amber: 'La deuda es significativa. Conviene vigilar los vencimientos y el costo financiero.',
      red:   'La deuda es elevada. Esto puede limitar el crecimiento y generar riesgos financieros.',
    },
  },
  {
    clave: 'ciclo_caja',
    titulo: 'Cuántos días tarda tu plata en volver después de una venta',
    frases: {
      green: 'Cobrás rápido y pagás con tiempo. El flujo de caja es eficiente.',
      amber: 'Hay demora entre que vendés y cobrás. Eso puede generar tensión en el día a día.',
      red:   'La plata tarda mucho en volver. Puede necesitarse financiamiento para sostener el capital de trabajo.',
    },
  },
]

const ETIQUETAS = {
  green: 'Bien',
  amber: 'Precaución',
  red:   'Atención',
  gray:  'Sin datos',
}

const DOT_COLOR = {
  green: 'dot-green',
  amber: 'dot-amber',
  red:   'dot-red',
  gray:  'dot-gray',
}

const BADGE_COLOR = {
  green: 'badge-green',
  amber: 'badge-amber',
  red:   'badge-red',
  gray:  'badge-gray',
}

// ── Componentes ────────────────────────────────────────────────────
function FilaSemaforo({ titulo, color = 'gray', frase }) {
  const c = color in DOT_COLOR ? color : 'gray'
  return (
    <div className="flex items-start gap-3 py-4 border-b border-slate-100 last:border-0">
      <div className={`${DOT_COLOR[c]} flex-shrink-0 mt-1.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-navy-800">{titulo}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{frase}</p>
      </div>
      <span className={`${BADGE_COLOR[c]} flex-shrink-0 self-start mt-0.5`}>
        {ETIQUETAS[c]}
      </span>
    </div>
  )
}

function TarjetaResumen({ icono: Icon, paso, titulo, resumen, sub, completo = true }) {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon size={16} className="text-brand-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400 mb-0.5">Paso {paso}</p>
          <p className="text-sm font-semibold text-navy-800 mb-1">{titulo}</p>
          <p className="text-xs text-slate-600 leading-relaxed">{resumen}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </div>
      {completo && (
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100">
          <CheckCircle size={11} className="text-brand-500" />
          <span className="text-xs text-brand-600 font-medium">Completado</span>
        </div>
      )}
    </div>
  )
}

const PASOS_SIGUIENTES = [
  {
    icono: Clock,
    numero: 1,
    titulo: 'Estamos revisando tu información',
    desc: 'En breve tu asesor va a analizar todo lo que nos contaste sobre tu empresa.',
  },
  {
    icono: MessageCircle,
    numero: 2,
    titulo: 'Te contactamos con tu análisis',
    desc: 'Vas a recibir un informe personalizado con los puntos clave que encontramos.',
  },
  {
    icono: Rocket,
    numero: 3,
    titulo: 'Juntos definimos el plan',
    desc: 'Vamos a diseñar con vos el camino para mejorar la salud financiera de tu negocio.',
  },
]

// ── Helpers de resumen ─────────────────────────────────────────────
const ESTACIONALIDAD_LABEL = {
  ninguna:  'Sin estacionalidad marcada',
  moderada: 'Con variaciones estacionales',
  fuerte:   'Alta estacionalidad',
}

function resumenNegocio(diag, empresa) {
  if (diag?.lineas_negocio) {
    const txt = diag.lineas_negocio.trim()
    return txt.length > 72 ? txt.slice(0, 70) + '…' : txt
  }
  return empresa?.rubro || 'Información registrada'
}

function subNegocio(diag) {
  return ESTACIONALIDAD_LABEL[diag?.estacionalidad] || null
}

function resumenVentas(periodo) {
  if (!periodo?.ventas_netas) return 'Datos registrados'
  const items = [`Ventas: ${ars(periodo.ventas_netas)}`]
  if (periodo.costo_ventas) items.push(`Costo de ventas: ${ars(periodo.costo_ventas)}`)
  return items.join(' · ')
}

function resumenPlata(periodo, garantias) {
  const caja    = garantias?._caja     ?? null
  const deudores = garantias?._deudores ?? null
  const liquido = caja != null && deudores != null
    ? caja + deudores
    : periodo?.activo_corriente ?? null

  const partes = []
  if (liquido != null)            partes.push(`Disponible: ${ars(liquido)}`)
  if (periodo?.deuda_total)       partes.push(`Deuda: ${ars(periodo.deuda_total)}`)
  return partes.length ? partes.join(' · ') : 'Datos registrados'
}

function subPlata(periodo) {
  if (!periodo?.dias_cobro && !periodo?.dias_pago) return null
  const partes = []
  if (periodo.dias_cobro) partes.push(`Cobrás en ${periodo.dias_cobro} días`)
  if (periodo.dias_pago)  partes.push(`Pagás en ${periodo.dias_pago} días`)
  return partes.join(' · ')
}

function resumenBienes(garantias, periodo) {
  const partes = []
  if (garantias?.inmueble_propio)    partes.push('Inmueble propio')
  else                               partes.push('Sin inmueble propio')
  if (garantias?.echeqs_disponibles) partes.push('ECHEQs disponibles')
  return partes.join(' · ')
}

function subBienes(periodo) {
  if (!periodo?.patrimonio_neto) return null
  return `Patrimonio estimado: ${ars(periodo.patrimonio_neto)}`
}

// ── Página principal ───────────────────────────────────────────────
export default function DiagnosticoResultados() {
  const { empresa } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [diag, setDiag] = useState(null)
  const [periodo, setPeriodo] = useState(null)

  useEffect(() => {
    if (!empresa) return

    async function cargar() {
      const [{ data: d }, { data: p }] = await Promise.all([
        supabase
          .from('diagnostico')
          .select('*')
          .eq('empresa_id', empresa.id)
          .maybeSingle(),
        supabase
          .from('periodos_financieros')
          .select('*')
          .eq('empresa_id', empresa.id)
          .eq('tipo_periodo', 'año')
          .order('periodo', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      // Si no hay diagnóstico completo, volver al formulario
      if (!d || d.estado !== 'completo') {
        navigate('/diagnostico', { replace: true })
        return
      }

      setDiag(d)
      setPeriodo(p)
      setLoading(false)
    }

    cargar()
  }, [empresa, navigate])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-slate-400">Cargando tu diagnóstico...</div>
      </div>
    )
  }

  const garantias = diag?.garantias || {}
  const ratios    = calcRatios(periodo)
  const semaforo  = calcSemaforo(ratios)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="Diagnóstico financiero"
        subtitle="Resultados de tu empresa"
        actions={<span className="badge badge-green">Completo</span>}
      />

      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* ── 1. Header cálido ────────────────────────────────── */}
          <div className="card p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={24} className="text-brand-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-navy-800 mb-1">
                  ¡Listo! Recibimos la información de tu empresa
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Estamos revisando todo y en breve vas a tener novedades.
                </p>
              </div>
            </div>
          </div>

          {/* ── 2. Resumen de lo completado ──────────────────────── */}
          <div>
            <h3 className="text-sm font-medium text-navy-700 mb-3">Lo que completaste</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <TarjetaResumen
                icono={Building2}
                paso={1}
                titulo="Tu negocio"
                resumen={resumenNegocio(diag, empresa)}
                sub={subNegocio(diag)}
              />
              <TarjetaResumen
                icono={TrendingUp}
                paso={2}
                titulo="Tus ventas"
                resumen={resumenVentas(periodo)}
                sub={periodo?.gastos_personal ? `Sueldos: ${ars(periodo.gastos_personal)}` : null}
              />
              <TarjetaResumen
                icono={Wallet}
                paso={3}
                titulo="Tu plata"
                resumen={resumenPlata(periodo, garantias)}
                sub={subPlata(periodo)}
              />
              <TarjetaResumen
                icono={Shield}
                paso={4}
                titulo="Tus bienes"
                resumen={resumenBienes(garantias, periodo)}
                sub={subBienes(periodo)}
              />
            </div>
          </div>

          {/* ── 3. Semáforo simple ──────────────────────────────── */}
          <div>
            <h3 className="text-sm font-medium text-navy-700 mb-3">
              Tu situación financiera — primer vistazo
            </h3>
            <div className="card p-5">
              {!ratios ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  Tu asesor va a completar el análisis cuando revise la información.
                </p>
              ) : (
                METRICAS.map(({ clave, titulo, frases }) => {
                  const item  = semaforo[clave]
                  const color = item?.color || 'gray'
                  const frase = frases[color] || 'Tu asesor va a analizar este punto en detalle.'
                  return (
                    <FilaSemaforo
                      key={clave}
                      titulo={titulo}
                      color={color}
                      frase={frase}
                    />
                  )
                })
              )}
            </div>
          </div>

          {/* ── 4. ¿Qué sigue? ──────────────────────────────────── */}
          <div>
            <h3 className="text-sm font-medium text-navy-700 mb-3">¿Qué sigue?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PASOS_SIGUIENTES.map(({ icono: Icon, numero, titulo, desc }) => (
                <div key={numero} className="card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-navy-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-white">{numero}</span>
                    </div>
                    <Icon size={16} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-navy-800 mb-1">{titulo}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 5. Botón editar ─────────────────────────────────── */}
          <div className="flex justify-center pb-2">
            <button
              onClick={() => navigate('/diagnostico', { state: { edit: true } })}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Edit2 size={14} />
              Editar mi información
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
