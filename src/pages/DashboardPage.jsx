import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { calcRatios, calcSemaforo, pct, ars, ratio, days } from '@/lib/financials'
import PageHeader from '@/components/shared/PageHeader'
import MetricCard from '@/components/shared/MetricCard'
import { SemaforoGrid } from '@/components/shared/Semaforo'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { AlertTriangle, CheckCircle, Info } from 'lucide-react'

const ETAPAS = ['Onboarding', 'Diagnóstico', 'CFO activo', 'Mercado capitales', 'Estratégico']

function EtapaPipeline({ etapa }) {
  return (
    <div className="flex gap-0 mb-6">
      {ETAPAS.map((e, i) => {
        const n = i + 1
        const isDone   = n < etapa
        const isActive = n === etapa
        return (
          <div
            key={e}
            className={`flex-1 text-center py-1.5 text-xs font-medium border-y first:border-l last:border-r
              first:rounded-l-lg last:rounded-r-lg border-r transition-colors
              ${isDone   ? 'bg-brand-50 border-brand-200 text-brand-700' :
                isActive ? 'bg-brand-600 border-brand-600 text-white' :
                           'bg-white border-slate-200 text-slate-400'}`}
          >
            {isActive && <span className="mr-1">▶</span>}
            {isDone    && <span className="mr-1">✓</span>}
            {e}
          </div>
        )
      })}
    </div>
  )
}

function Alert({ type, text }) {
  const cfg = {
    red:   { icon: AlertTriangle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', ico: 'text-red-500' },
    amber: { icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', ico: 'text-amber-500' },
    green: { icon: CheckCircle,   bg: 'bg-brand-50', border: 'border-brand-200', text: 'text-brand-800', ico: 'text-brand-500' },
    info:  { icon: Info,          bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', ico: 'text-blue-500' },
  }[type] || {}
  const Icon = cfg.icon
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-lg border ${cfg.bg} ${cfg.border} mb-2`}>
      <Icon size={15} className={`${cfg.ico} flex-shrink-0 mt-0.5`} />
      <span className={`text-sm ${cfg.text}`}>{text}</span>
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-card-md text-xs">
      <p className="text-slate-500 mb-1">{label}</p>
      <p className="font-semibold text-navy-800">{ars(payload[0].value)}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { empresa } = useAuth()
  const [periodos, setPeriodos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!empresa) return
    supabase
      .from('periodos_financieros')
      .select('*')
      .eq('empresa_id', empresa.id)
      .order('periodo', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        setPeriodos(data || [])
        setLoading(false)
      })
  }, [empresa])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-sm text-slate-400">Cargando datos...</div>
    </div>
  )

  const ultimo = periodos[0]
  const ratios = calcRatios(ultimo)
  const semaforo = calcSemaforo(ratios)
  const etapa = empresa?.etapa_numero || 2

  const chartData = [...periodos].reverse().map(p => ({
    name: p.periodo,
    ventas: p.ventas_netas,
  }))

  const alertas = buildAlertas(ratios, semaforo)
  const semaforoAreas = buildSemaforoAreas(semaforo)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="Resumen ejecutivo"
        subtitle={ultimo ? `Último período: ${ultimo.periodo}` : 'Sin datos aún'}
        actions={
          <span className={`badge ${etapa >= 3 ? 'badge-green' : 'badge-amber'}`}>
            {ETAPAS[etapa - 1]}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <EtapaPipeline etapa={etapa} />

        {!ultimo ? (
          <div className="card p-8 text-center">
            <p className="text-slate-500 text-sm mb-3">Todavía no hay datos financieros cargados.</p>
            <a href="/diagnostico" className="btn-primary text-sm">
              Completar diagnóstico →
            </a>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <MetricCard
                label="Ventas anuales"
                value={ars(ultimo.ventas_netas)}
                sub="Último período"
                trend="up"
              />
              <MetricCard
                label="Margen EBITDA"
                value={pct(ratios?.margen_ebitda)}
                sub={ratios?.margen_ebitda >= 0.10 ? 'Saludable' : 'Bajo umbral'}
                color={ratios?.margen_ebitda >= 0.10 ? 'green' : 'red'}
              />
              <MetricCard
                label="Liquidez corriente"
                value={ratio(ratios?.liquidez_corriente)}
                sub={ratios?.liquidez_corriente >= 1.2 ? 'En rango' : 'Riesgo'}
                color={ratios?.liquidez_corriente >= 1.2 ? 'green' : 'red'}
              />
              <MetricCard
                label="CCE"
                value={days(ratios?.cce)}
                sub="Ciclo de caja"
                color={ratios?.cce < 45 ? 'green' : ratios?.cce < 70 ? 'amber' : 'red'}
              />
            </div>

            {/* Chart + Semáforo */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
              <div className="card p-5 lg:col-span-3">
                <h3 className="text-sm font-medium text-navy-700 mb-4">Ventas por período</h3>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chartData} barSize={28}>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                      <Bar dataKey="ventas" radius={[4, 4, 0, 0]}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={i === chartData.length - 1 ? '#0A8A7A' : '#9FE1CB'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-10">Cargá más períodos para ver el gráfico</p>
                )}
              </div>

              <div className="card p-5 lg:col-span-2">
                <h3 className="text-sm font-medium text-navy-700 mb-3">Semáforo financiero</h3>
                <SemaforoGrid areas={semaforoAreas} />
              </div>
            </div>

            {/* Alertas */}
            <div className="card p-5">
              <h3 className="text-sm font-medium text-navy-700 mb-3">Alertas y oportunidades</h3>
              {alertas.map((a, i) => <Alert key={i} {...a} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function buildAlertas(ratios, semaforo) {
  if (!ratios) return [{ type: 'info', text: 'Completá el diagnóstico para ver alertas personalizadas.' }]
  const a = []
  if (ratios.liquidez_corriente < 1.2)
    a.push({ type: 'red', text: `Liquidez corriente en ${ratio(ratios.liquidez_corriente)} — debajo del mínimo recomendado de 1.2x. Revisá el capital de trabajo.` })
  if (ratios.cce > 60)
    a.push({ type: 'amber', text: `Ciclo de conversión de efectivo de ${days(ratios.cce)}. Considerá financiamiento de capital de trabajo para cubrir la brecha.` })
  if (ratios.margen_ebitda >= 0.10)
    a.push({ type: 'green', text: `Margen EBITDA del ${pct(ratios.margen_ebitda)} — por encima del umbral mínimo del sector.` })
  if (ratios.leverage > 2)
    a.push({ type: 'amber', text: `Leverage de ${ratio(ratios.leverage)} — nivel elevado. Evaluá reemplazar deuda bancaria por instrumentos bursátiles a menor costo.` })
  if (a.length === 0)
    a.push({ type: 'green', text: 'Todos los indicadores principales dentro de parámetros saludables.' })
  return a
}

function buildSemaforoAreas(sem) {
  if (!sem) return []
  return [
    { label: 'Rentabilidad',       ...sem.rentabilidad,   badge: sem.rentabilidad?.label },
    { label: 'Liquidez',           ...sem.liquidez,       badge: sem.liquidez?.label },
    { label: 'Endeudamiento',      ...sem.endeudamiento,  badge: sem.endeudamiento?.label },
    { label: 'Ciclo de caja',      ...sem.ciclo_caja,     badge: sem.ciclo_caja?.label },
    { label: 'Cobertura',          ...sem.cobertura,      badge: sem.cobertura?.label },
  ]
}
