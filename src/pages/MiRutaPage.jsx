import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/shared/PageHeader'
import { CheckCircle, Lock, Clock, MessageCircle } from 'lucide-react'

const fmt = v => typeof v === 'number' ? `$${v.toLocaleString('es-AR')}` : '—'

const RUTA_ETAPAS = [
  {
    n: 1,
    titulo: 'Orden tributario',
    desc: 'CUIT habilitado y sin deudas exigibles con AFIP. Base obligatoria para operar en el mercado.',
    requisito: 'Sin deuda AFIP · CUIT activo',
    cumplida: (_d4) => _d4?.tiene_deuda_afip === false,
  },
  {
    n: 2,
    titulo: 'Cuenta comitente ALYC',
    desc: 'Apertura de cuenta en tu ALYC. Habilita FCIs money market, cauciones, dólar linked, LECAPS y ONs de inversión.',
    requisito: 'Documentación societaria + apertura de cuenta',
    cumplida: (d4) => d4?.tiene_cuenta_comitente === true,
  },
  {
    n: 3,
    titulo: 'ePyME',
    desc: 'Inscripción como empresa PyME en AFIP. Habilita el descuento de ECHEQs, facturas FCES y pagarés bursátiles propios.',
    requisito: 'Inscripción ePyME en AFIP',
    cumplida: (_d4, d1) => d1?.es_epyme === true,
  },
  {
    n: 4,
    titulo: 'Aval SGR',
    desc: 'Con el aval de una SGR accedés a financiamiento de mayor cupo y mejor tasa que sin garantía.',
    requisito: 'Score SGR ≥ 50 · Activos como garantía',
    cumplida: (d4) => d4?.tiene_aval_sgr === true,
  },
  {
    n: 5,
    titulo: 'ON PyME',
    desc: 'La empresa emite su propia Obligación Negociable. El instrumento más avanzado del mercado de capitales.',
    requisito: 'Score SGR ≥ 65 · Empresa estructurada',
    cumplida: (_d4, _d1, score) => (score ?? 0) >= 65,
  },
]

const CAT_COLOR = {
  AAA: 'text-brand-700 bg-brand-50 border-brand-200',
  AA:  'text-brand-700 bg-brand-50 border-brand-200',
  A:   'text-blue-700 bg-blue-50 border-blue-200',
  BBB: 'text-amber-700 bg-amber-50 border-amber-200',
  BB:  'text-amber-700 bg-amber-50 border-amber-200',
  'Sin elegibilidad': 'text-slate-600 bg-slate-50 border-slate-200',
}

function calcularEtapaRuta(d1, d4, score) {
  if (d4?.tiene_deuda_afip !== false) return 1
  if (!d4?.tiene_cuenta_comitente)    return 2
  if (!d1?.es_epyme)                  return 3
  if (!d4?.tiene_aval_sgr)            return 4
  return 5
}

export default function MiRutaPage() {
  const { empresa } = useAuth()
  const [scoring,   setScoring]   = useState(null)
  const [etapaNumero, setEtapaNumero] = useState(0)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    if (!empresa?.id) return

    // Carga inicial del scoring (una vez)
    supabase.from('scoring_sgr')
      .select('score_total, categoria, cupo_echeqs, cupo_pagares, cupo_on_simple, cupo_on_garantizada, cupo_credito_sgr')
      .eq('empresa_id', empresa.id).maybeSingle()
      .then(({ data }) => { setScoring(data); setLoading(false) })

    // Polling de empresas.etapa_numero cada 5s — fuente de verdad para los hitos
    const empId = empresa.id
    function fetchEtapa() {
      supabase.from('empresas')
        .select('etapa_numero')
        .eq('id', empId)
        .maybeSingle()
        .then(({ data }) => { if (data) setEtapaNumero(data.etapa_numero || 1) })
    }

    fetchEtapa()
    const interval = setInterval(fetchEtapa, 5000)
    return () => clearInterval(interval)
  }, [empresa?.id])

  const score      = scoring?.score_total || 0
  const categoria  = scoring?.categoria || null
  const etapaActual = score >= 65 ? Math.max(etapaNumero, 5) : etapaNumero
  const catCls     = categoria ? (CAT_COLOR[categoria] || CAT_COLOR['Sin elegibilidad']) : ''

  const cupos = scoring ? [
    { label: 'ECHEQs y Facturas FCES', monto: scoring.cupo_echeqs,         plazo: 'Hasta 365 días' },
    { label: 'Pagarés bursátiles',      monto: scoring.cupo_pagares,        plazo: '30 – 180 días'  },
    { label: 'Línea con aval SGR',      monto: scoring.cupo_on_simple,      plazo: '12 – 36 meses'  },
    { label: 'ON PyME',                 monto: scoring.cupo_on_garantizada, plazo: '24 – 60 meses'  },
    { label: 'Crédito ALYC',            monto: scoring.cupo_credito_sgr,    plazo: '12 – 48 meses'  },
  ].filter(c => c.monto > 0) : []

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader title="Mi ruta al mercado" subtitle={empresa?.nombre} />

      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Score */}
          {scoring && (
            <div className="card p-5">
              <div className="flex items-start gap-5">
                <div className={`rounded-xl border px-5 py-3 text-center flex-shrink-0 ${catCls}`}>
                  <p className="text-3xl font-bold leading-none">{score}</p>
                  <p className="text-sm font-semibold mt-0.5">{categoria}</p>
                  <p className="text-xs opacity-60 mt-0.5">/ 100 pts</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy-800 mb-1">Tu score de elegibilidad SGR</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Este puntaje resume la salud financiera de tu empresa y determina
                    a qué herramientas del mercado de capitales podés acceder.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Ruta — 5 etapas */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-navy-800 mb-4">Tu ruta al mercado de capitales</h3>
            <div className="space-y-0">
              {RUTA_ETAPAS.map((etapa, i) => {
                const completada = etapa.n < etapaActual
                const activa     = etapa.n === etapaActual
                const pendiente  = etapa.n > etapaActual

                return (
                  <div key={etapa.n} className="flex gap-4">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all
                        ${completada ? 'bg-brand-600 border-brand-600' :
                          activa     ? 'bg-white border-brand-600 ring-4 ring-brand-100' :
                                       'bg-white border-slate-200'}`}>
                        {completada
                          ? <CheckCircle size={14} className="text-white" />
                          : activa
                            ? <div className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-pulse" />
                            : <Lock size={11} className="text-slate-300" />}
                      </div>
                      {i < RUTA_ETAPAS.length - 1 && (
                        <div className={`w-0.5 flex-1 my-1 min-h-4 ${completada ? 'bg-brand-400' : 'bg-slate-200'}`} />
                      )}
                    </div>

                    <div className={`pb-5 flex-1 ${i === RUTA_ETAPAS.length - 1 ? 'pb-0' : ''}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm font-semibold
                          ${activa ? 'text-brand-700' : completada ? 'text-navy-800' : 'text-slate-400'}`}>
                          {etapa.titulo}
                        </p>
                        {activa     && <span className="badge badge-amber text-xs">Etapa actual</span>}
                        {completada && <span className="badge badge-green text-xs">Completada</span>}
                      </div>
                      <p className={`text-xs leading-relaxed mb-0.5 ${pendiente ? 'text-slate-300' : 'text-slate-500'}`}>
                        {etapa.desc}
                      </p>
                      {pendiente && (
                        <p className="text-xs text-slate-400 italic">Requiere: {etapa.requisito}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Cupos estimados */}
          {cupos.length > 0 && (
            <div className="card p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Cupos estimados disponibles para tu empresa
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {cupos.map(({ label, monto, plazo }) => (
                  <div key={label} className="p-3.5 rounded-xl bg-brand-50 border border-brand-100">
                    <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                    <p className="text-base font-bold text-brand-800">{fmt(monto)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{plazo}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3 text-center">
                * Estimaciones de referencia. Tu asesor te confirma las condiciones vigentes.
              </p>
            </div>
          )}

          {!scoring && !loading && (
            <div className="card p-6 text-center">
              <Clock size={24} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-navy-800 mb-1">Tu asesor está calculando tu posición</p>
              <p className="text-xs text-slate-400">
                Una vez que analice tu balance, vas a ver tu ruta y los cupos disponibles.
              </p>
            </div>
          )}

          <div className="card p-4 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-navy-800">¿Tenés preguntas sobre el mercado de capitales?</p>
              <p className="text-xs text-slate-400">Tu asesor puede explicarte cada instrumento.</p>
            </div>
            <Link to="/mensajes" className="btn-primary text-sm flex-shrink-0 flex items-center gap-2">
              <MessageCircle size={14} /> Escribir
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
