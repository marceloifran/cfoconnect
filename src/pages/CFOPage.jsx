import { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ars, pct } from '@/lib/financials'
import PageHeader from '@/components/shared/PageHeader'
import { Save, Sparkles, Download, AlertTriangle, CheckCircle, Info } from 'lucide-react'

// ── Constantes ──────────────────────────────────────────────────────────────
const AÑO = new Date().getFullYear()

const MESES    = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES_F  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const TABS_CFO = [
  { id: 'presupuesto', label: 'Presupuesto anual'      },
  { id: 'cashflow',    label: 'Cash flow 13 semanas'   },
  { id: 'reporte',     label: 'Reporte mensual'        },
]

const FILAS = [
  { key: 'ventas_netas',       label: 'Ventas netas',          tipo: 'input' },
  { key: 'costo_ventas',       label: 'Costo de ventas',       tipo: 'input' },
  { key: 'utilidad_bruta',     label: 'Utilidad bruta',        tipo: 'calc'  },
  { key: 'gastos_comerciales', label: 'Gastos comerciales',    tipo: 'input' },
  { key: 'gastos_admin',       label: 'Gastos administración', tipo: 'input' },
  { key: 'gastos_personal',    label: 'Gastos personal',       tipo: 'input' },
  { key: 'ebitda',             label: 'EBITDA',                tipo: 'calc'  },
]

const PROMPT_CFO = `Sos un CFO senior con experiencia en PyMEs argentinas. \
Redacta un reporte mensual ejecutivo claro, directo y accionable. \
Usa lenguaje profesional pero accesible. \
Estructuralo con estas secciones exactas como titulos en mayusculas seguidos de dos puntos:

RESULTADO DEL MES:
SITUACION DE CAJA:
ALERTAS Y RIESGOS:
OPORTUNIDADES DE MERCADO DE CAPITALES:
COMPROMISOS Y PROXIMOS PASOS:

Cada seccion con 2-3 parrafos. Sin markdown, sin asteriscos, solo texto plano.`

// ── Helpers ─────────────────────────────────────────────────────────────────
const n    = v => Number(v) || 0
const bKey = (yr, m) => `${yr}-presupuesto-${String(m).padStart(2,'0')}`
const rKey = (yr, m) => `${yr}-${String(m).padStart(2,'0')}`

function calcMes(mes) {
  const ub = n(mes.ventas_netas) - n(mes.costo_ventas)
  return {
    ...mes,
    utilidad_bruta: ub,
    ebitda: ub - n(mes.gastos_comerciales) - n(mes.gastos_admin) - n(mes.gastos_personal),
  }
}

function emptyMes() {
  return { ventas_netas:'', costo_ventas:'', gastos_comerciales:'', gastos_admin:'', gastos_personal:'' }
}

function sumar(arr, key) { return arr.reduce((s, x) => s + n(x?.[key]), 0) }

// ── EmpresaSelector compartido ───────────────────────────────────────────────
function EmpresaSelector({ empresas, value, onChange }) {
  if (!empresas.length) return null
  return (
    <div className="flex items-center gap-3">
      <label className="label mb-0 whitespace-nowrap">Empresa</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="input w-56">
        {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
      </select>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// HERRAMIENTA 1 — PRESUPUESTO ANUAL
// ════════════════════════════════════════════════════════════════════════════

function PresupuestoAsesor({ empresaId }) {
  const [year, setYear]         = useState(AÑO)
  const [form, setForm]         = useState(Array.from({ length: 12 }, emptyMes))
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    if (!empresaId) return
    supabase.from('periodos_financieros')
      .select('*')
      .eq('empresa_id', empresaId)
      .like('periodo', `${year}-presupuesto-%`)
      .then(({ data }) => {
        if (!data?.length) { setForm(Array.from({ length: 12 }, emptyMes)); return }
        const nuevo = Array.from({ length: 12 }, emptyMes)
        data.forEach(p => {
          const m = parseInt(p.periodo.split('-').pop(), 10) - 1
          if (m >= 0 && m < 12) {
            nuevo[m] = {
              ventas_netas:       p.ventas_netas       ? String(p.ventas_netas)       : '',
              costo_ventas:       p.costo_ventas       ? String(p.costo_ventas)       : '',
              gastos_comerciales: p.gastos_comerciales ? String(p.gastos_comerciales) : '',
              gastos_admin:       p.gastos_admin       ? String(p.gastos_admin)       : '',
              gastos_personal:    p.gastos_personal    ? String(p.gastos_personal)    : '',
            }
          }
        })
        setForm(nuevo)
      })
  }, [empresaId, year])

  function setCell(mIdx, key, val) {
    setForm(prev => { const next = [...prev]; next[mIdx] = { ...next[mIdx], [key]: val }; return next })
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    const payloads = form.map((mes, i) => ({
      empresa_id:        empresaId,
      periodo:           bKey(year, i + 1),
      tipo_periodo:      'mes',
      ventas_netas:      n(mes.ventas_netas),
      costo_ventas:      n(mes.costo_ventas),
      gastos_comerciales: n(mes.gastos_comerciales),
      gastos_admin:      n(mes.gastos_admin),
      gastos_personal:   n(mes.gastos_personal),
    }))
    await supabase.from('periodos_financieros').upsert(payloads, { onConflict: 'empresa_id,periodo' })
    setSaving(false)
    setSaved(true)
  }

  const calculados = form.map(calcMes)

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <label className="label mb-0">Año</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="input w-28">
            {[AÑO - 1, AÑO, AÑO + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          {saved && !saving && (
            <span className="flex items-center gap-1 text-xs text-brand-600 font-medium">
              <CheckCircle size={13} /> Guardado
            </span>
          )}
          <button onClick={handleSave} disabled={saving || !empresaId} className="btn-primary flex items-center gap-2 disabled:opacity-60">
            <Save size={15} />
            {saving ? 'Guardando...' : 'Guardar presupuesto'}
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="text-xs min-w-full">
          <thead>
            <tr className="bg-navy-800 text-white">
              <th className="sticky left-0 bg-navy-800 text-left px-3 py-2.5 font-semibold w-36">Concepto</th>
              {MESES.map(m => <th key={m} className="px-2 py-2.5 font-semibold text-center w-20">{m}</th>)}
              <th className="px-3 py-2.5 font-semibold text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {FILAS.map(({ key, label, tipo }) => {
              const isCalc = tipo === 'calc'
              const isEBITDA = key === 'ebitda'
              const rowCls = isEBITDA
                ? 'bg-brand-50'
                : isCalc ? 'bg-slate-50' : 'bg-white'
              const textCls = isEBITDA ? 'text-brand-800 font-semibold' : isCalc ? 'text-navy-800 font-semibold' : 'text-slate-600'
              const total = calculados.reduce((s, m) => s + n(m[key]), 0)

              return (
                <tr key={key} className={`${rowCls} border-t border-slate-100`}>
                  <td className={`sticky left-0 ${rowCls} px-3 py-1.5 font-medium ${textCls} whitespace-nowrap`}>
                    {label}
                  </td>
                  {calculados.map((mes, mIdx) => (
                    <td key={mIdx} className="px-1 py-1">
                      {isCalc ? (
                        <span className={`block text-right px-2 py-1 ${textCls}`}>
                          {ars(mes[key])}
                        </span>
                      ) : (
                        <input
                          type="number"
                          value={form[mIdx][key]}
                          onChange={e => setCell(mIdx, key, e.target.value)}
                          className="w-20 text-right text-xs px-1.5 py-1 border border-transparent hover:border-slate-200 focus:border-brand-400 focus:ring-0 rounded bg-transparent outline-none"
                          placeholder="0"
                        />
                      )}
                    </td>
                  ))}
                  <td className={`px-3 py-1.5 text-right font-semibold ${textCls} whitespace-nowrap`}>
                    {ars(total)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PresupuestoCliente({ empresaId }) {
  const [year, setYear]   = useState(AÑO)
  const [mesSel, setMes]  = useState(0)   // 0 = acumulado
  const [budget, setBudget] = useState([])
  const [real, setReal]     = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!empresaId) return
    setLoading(true)
    Promise.all([
      supabase.from('periodos_financieros').select('*').eq('empresa_id', empresaId).like('periodo', `${year}-presupuesto-%`),
      supabase.from('periodos_financieros').select('*').eq('empresa_id', empresaId).gte('periodo', `${year}-01`).lte('periodo', `${year}-12`).eq('tipo_periodo', 'mes'),
    ]).then(([{ data: b }, { data: r }]) => {
      setBudget(b || [])
      setReal(r || [])
      setLoading(false)
    })
  }, [empresaId, year])

  function getValues(arr, m) {
    if (m === 0) {
      // Acumulado
      const acc = {}
      FILAS.forEach(({ key }) => { acc[key] = sumar(arr, key) })
      const ub = acc.ventas_netas - acc.costo_ventas
      return { ...acc, utilidad_bruta: ub, ebitda: ub - acc.gastos_comerciales - acc.gastos_admin - acc.gastos_personal }
    }
    const rec = arr.find(p => p.periodo === (budget === arr ? bKey(year, m) : rKey(year, m)))
    return rec ? calcMes(rec) : {}
  }

  const bVals = getValues(budget, mesSel)
  const rVals = getValues(real, mesSel)

  const isRevenueRow = key => ['ventas_netas', 'utilidad_bruta', 'ebitda'].includes(key)

  if (loading) return <div className="text-sm text-slate-400 py-8 text-center">Cargando datos...</div>

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="input w-28">
          {[AÑO - 1, AÑO, AÑO + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={mesSel} onChange={e => setMes(Number(e.target.value))} className="input w-40">
          <option value={0}>Acumulado año</option>
          {MESES_F.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
      </div>

      {!budget.length ? (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <Info size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">Todavía no hay presupuesto cargado para este período. Tu asesor lo va a completar pronto.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-800 text-white">
                {['Concepto', 'Presupuestado', 'Real', 'Desvío $', 'Desvío %'].map(h => (
                  <th key={h} className={`px-4 py-2.5 text-xs font-semibold ${h === 'Concepto' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FILAS.map(({ key, label, tipo }) => {
                const b = n(bVals[key])
                const r = n(rVals[key])
                const dev = r - b
                const devPct = b !== 0 ? dev / Math.abs(b) : 0
                const goodDevio = (dev > 0) === isRevenueRow(key)
                const devCls = dev === 0 ? 'text-slate-400' : goodDevio ? 'text-brand-600' : 'text-red-600'
                const isCalc = tipo === 'calc'
                const rowCls = key === 'ebitda' ? 'bg-brand-50' : isCalc ? 'bg-slate-50' : ''

                return (
                  <tr key={key} className={`border-t border-slate-100 ${rowCls}`}>
                    <td className={`px-4 py-2.5 ${isCalc ? 'font-semibold text-navy-800' : 'text-slate-700'}`}>{label}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700 tabular-nums">{b ? ars(b) : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-navy-800 tabular-nums">{r ? ars(r) : '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-medium tabular-nums ${devCls}`}>
                      {dev !== 0 ? (dev > 0 ? '+' : '') + ars(dev) : '—'}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium tabular-nums ${devCls}`}>
                      {dev !== 0 ? (devPct > 0 ? '+' : '') + pct(devPct) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PresupuestoTab({ isAsesor, empresa, empresas, empresaId }) {
  return (
    <div>
      {!isAsesor && !empresaId ? (
        <div className="text-sm text-slate-400 py-8 text-center">Sin datos de empresa.</div>
      ) : isAsesor ? (
        <PresupuestoAsesor empresaId={empresaId} />
      ) : (
        <PresupuestoCliente empresaId={empresa?.id} />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// HERRAMIENTA 2 — CASH FLOW 13 SEMANAS
// ════════════════════════════════════════════════════════════════════════════

function CashFlowTab({ isAsesor, empresaId }) {
  const [periodo,      setPeriodo]  = useState(() => `${AÑO}-S1`)
  const [saldoInicial, setSaldo]    = useState('')
  const [semanas,      setSemanas]  = useState(
    Array.from({ length: 13 }, (_, i) => ({ semana: i+1, fecha_semana:'', cobros_esperados:'', pagos_previstos:'' }))
  )
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    if (!empresaId) return
    supabase.from('proyeccion_caja')
      .select('*').eq('empresa_id', empresaId).eq('periodo_base', periodo)
      .order('semana')
      .then(({ data }) => {
        if (!data?.length) {
          setSaldo('')
          setSemanas(Array.from({ length: 13 }, (_, i) => ({ semana:i+1, fecha_semana:'', cobros_esperados:'', pagos_previstos:'' })))
          return
        }
        const si = data[0]?.notas ? (() => { try { return JSON.parse(data[0].notas)?.saldo_inicial ?? '' } catch { return '' } })() : ''
        setSaldo(si === '' ? '' : String(si))
        setSemanas(Array.from({ length: 13 }, (_, i) => {
          const row = data.find(d => d.semana === i + 1) || {}
          return {
            semana:           i + 1,
            fecha_semana:     row.fecha_semana || '',
            cobros_esperados: row.cobros_esperados ? String(row.cobros_esperados) : '',
            pagos_previstos:  row.pagos_previstos  ? String(row.pagos_previstos)  : '',
          }
        }))
      })
  }, [empresaId, periodo])

  function setCell(idx, key, val) {
    setSemanas(prev => { const next = [...prev]; next[idx] = { ...next[idx], [key]: val }; return next })
    setSaved(false)
  }

  // Calcular saldos acumulados
  const withSaldos = semanas.reduce((acc, s, i) => {
    const prev = i === 0 ? n(saldoInicial) : acc[i-1].saldo_proyectado
    acc.push({ ...s, saldo_proyectado: prev + n(s.cobros_esperados) - n(s.pagos_previstos) })
    return acc
  }, [])

  const avgCobros = sumar(semanas, 'cobros_esperados') / 13

  function alertaColor(saldo) {
    if (saldo < 0)                    return 'red'
    if (saldo < avgCobros * 0.20)     return 'amber'
    return 'green'
  }

  const SALDO_CLS = { green: 'text-brand-700 font-semibold', amber: 'text-amber-700 font-semibold', red: 'text-red-600 font-semibold' }

  function getRecomendacion(brecha) {
    const abs = Math.abs(brecha)
    if (abs < 5_000_000)  return 'Recomendamos descontar ECHEQs disponibles en el mercado bursatil.'
    if (abs < 20_000_000) return 'Recomendamos gestionar una Caucion bursatil para cubrir la brecha.'
    return 'Recomendamos financiamiento via SGR para el monto requerido.'
  }

  const semanasCriticas = withSaldos.filter(s => s.saldo_proyectado < 0)

  async function handleSave() {
    if (!empresaId) return
    setSaving(true)
    await supabase.from('proyeccion_caja').delete().eq('empresa_id', empresaId).eq('periodo_base', periodo)
    const payloads = withSaldos.map(s => ({
      empresa_id:       empresaId,
      periodo_base:     periodo,
      semana:           s.semana,
      fecha_semana:     s.fecha_semana || null,
      cobros_esperados: n(s.cobros_esperados),
      pagos_previstos:  n(s.pagos_previstos),
      saldo_proyectado: s.saldo_proyectado,
      alerta:           alertaColor(s.saldo_proyectado) === 'red' ? 'critico' : alertaColor(s.saldo_proyectado) === 'amber' ? 'precaucion' : 'ok',
      notas:            s.semana === 1 ? JSON.stringify({ saldo_inicial: n(saldoInicial) }) : null,
    }))
    await supabase.from('proyeccion_caja').insert(payloads)
    setSaving(false)
    setSaved(true)
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div>
            <label className="label">Período base</label>
            <input type="text" value={periodo} onChange={e => { setPeriodo(e.target.value); setSaved(false) }} className="input w-32" placeholder="2025-S1" />
          </div>
          <div>
            <label className="label">Saldo inicial ($)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
              <input type="number" value={saldoInicial} onChange={e => { setSaldo(e.target.value); setSaved(false) }} className="input pl-7 w-40" placeholder="0" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saved && !saving && <span className="flex items-center gap-1 text-xs text-brand-600 font-medium"><CheckCircle size={13} /> Guardado</span>}
          <button onClick={handleSave} disabled={saving || !empresaId} className="btn-primary flex items-center gap-2 disabled:opacity-60">
            <Save size={15} />
            {saving ? 'Guardando...' : 'Guardar proyeccion'}
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 mb-5">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-navy-800 text-white">
              {['Semana','Fecha','Cobros esperados','Pagos previstos','Saldo proyectado'].map(h => (
                <th key={h} className="px-3 py-2.5 font-semibold text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withSaldos.map((s, i) => {
              const col = alertaColor(s.saldo_proyectado)
              return (
                <tr key={i} className={`border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="px-3 py-2 font-medium text-navy-700">S{s.semana}</td>
                  <td className="px-2 py-1">
                    <input type="date" value={s.fecha_semana} onChange={e => setCell(i, 'fecha_semana', e.target.value)}
                      className="border border-transparent hover:border-slate-200 focus:border-brand-400 rounded px-1 py-0.5 outline-none bg-transparent text-slate-600 w-32" />
                  </td>
                  <td className="px-2 py-1">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">$</span>
                      <input type="number" value={s.cobros_esperados} onChange={e => setCell(i, 'cobros_esperados', e.target.value)}
                        className="w-32 text-right pl-5 pr-1 py-0.5 border border-transparent hover:border-slate-200 focus:border-brand-400 rounded bg-transparent outline-none" placeholder="0" />
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">$</span>
                      <input type="number" value={s.pagos_previstos} onChange={e => setCell(i, 'pagos_previstos', e.target.value)}
                        className="w-32 text-right pl-5 pr-1 py-0.5 border border-transparent hover:border-slate-200 focus:border-brand-400 rounded bg-transparent outline-none" placeholder="0" />
                    </div>
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${SALDO_CLS[col]}`}>
                    {ars(s.saldo_proyectado)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Recomendaciones automáticas */}
      {semanasCriticas.length > 0 && (
        <div className="card p-4">
          <h4 className="text-sm font-semibold text-navy-800 mb-3">Recomendaciones automaticas</h4>
          <div className="space-y-2">
            {semanasCriticas.map(s => (
              <div key={s.semana} className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">
                  <span className="font-semibold">Semana {s.semana}:</span> Brecha de {ars(Math.abs(s.saldo_proyectado))} — {getRecomendacion(s.saldo_proyectado)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// HERRAMIENTA 3 — REPORTE MENSUAL
// ════════════════════════════════════════════════════════════════════════════

function generarPDFReporte(reporte, empresaNombre, periodoLabel) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W     = 210
  const ML    = 15
  const TW    = 180
  const fecha = new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' })
  let y       = 20

  function checkPage(n = 15) { if (y + n > 278) { doc.addPage(); y = 20 } }

  // Header
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(10, 138, 122)
  doc.text('CFOConnect', ML, y); y += 9
  doc.setFontSize(14); doc.setTextColor(13, 27, 62)
  doc.text(empresaNombre || 'Empresa', ML, y); y += 6
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 116, 139)
  doc.text(`Reporte mensual — ${periodoLabel}`, ML, y); y += 4.5
  doc.text(`Generado el: ${fecha}`, ML, y); y += 6
  doc.setDrawColor(10, 138, 122); doc.line(ML, y, W - ML, y); y += 7

  // Secciones del reporte
  const SECCIONES = ['RESULTADO DEL MES', 'SITUACION DE CAJA', 'ALERTAS Y RIESGOS', 'OPORTUNIDADES DE MERCADO DE CAPITALES', 'COMPROMISOS Y PROXIMOS PASOS']
  const texto = reporte.replace(/\r\n/g, '\n')
  const partes = texto.split(new RegExp(`(${SECCIONES.join('|')}):?`, 'i'))

  let seccionActiva = null
  partes.forEach(parte => {
    const esTitulo = SECCIONES.some(s => s.toLowerCase() === parte.trim().toLowerCase())
    if (esTitulo) {
      seccionActiva = parte.trim()
      checkPage(14)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(13, 27, 62)
      doc.text(seccionActiva, ML, y); y += 6
    } else if (seccionActiva && parte.trim()) {
      const parrafos = parte.trim().split(/\n+/).filter(p => p.trim())
      parrafos.forEach(p => {
        const lines = doc.splitTextToSize(p.trim(), TW)
        checkPage(lines.length * 4 + 3)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(71, 85, 105)
        doc.text(lines, ML, y)
        y += lines.length * 4 + 2
      })
      y += 2
    }
  })

  // Footer
  const total = doc.getNumberOfPages ? doc.getNumberOfPages() : doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240); doc.line(ML, 285, W - ML, 285)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(148, 163, 184)
    doc.text('Documento generado por CFOConnect - Asesoria financiera para PyMEs', ML, 291)
    doc.text(`${fecha}  |  Pag ${i} de ${total}`, W - ML, 291, { align: 'right' })
  }

  const nom = (empresaNombre || 'Empresa').replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '-')
  doc.save(`Reporte-${nom}-${periodoLabel}.pdf`)
}

function ReporteTab({ isAsesor, empresa, empresas, empresaId, empresaNombre }) {
  const [year,     setYear]    = useState(AÑO)
  const [mes,      setMes]     = useState(new Date().getMonth() + 1)
  const [reporte,  setReporte] = useState('')
  const [generando,setGenerando] = useState(false)
  const [error,    setError]   = useState(null)

  async function handleGenerar() {
    if (!empresaId) return
    setGenerando(true)
    setError(null)
    setReporte('')

    const periodo = rKey(year, mes)
    const { data: pf } = await supabase.from('periodos_financieros')
      .select('*').eq('empresa_id', empresaId).eq('periodo', periodo).maybeSingle()
    const { data: cf } = await supabase.from('proyeccion_caja')
      .select('*').eq('empresa_id', empresaId).order('semana').limit(13)

    const datosFinancieros = pf ? `
Ventas netas: ${ars(pf.ventas_netas)}
Costo de ventas: ${ars(pf.costo_ventas)}
Utilidad bruta: ${ars(n(pf.ventas_netas) - n(pf.costo_ventas))}
Gastos comerciales: ${ars(pf.gastos_comerciales)}
Gastos administracion: ${ars(pf.gastos_admin)}
Gastos personal: ${ars(pf.gastos_personal)}
EBITDA estimado: ${ars(n(pf.ventas_netas) - n(pf.costo_ventas) - n(pf.gastos_comerciales) - n(pf.gastos_admin) - n(pf.gastos_personal))}
Liquidez corriente: ${pf.pasivo_corriente ? (n(pf.activo_corriente) / n(pf.pasivo_corriente)).toFixed(2) + 'x' : 'sin dato'}
Deuda total: ${ars(pf.deuda_total)}` : 'Sin datos financieros cargados para este periodo.'

    const datosCashflow = cf?.length
      ? cf.slice(0,4).map(s => `Semana ${s.semana}: cobros ${ars(s.cobros_esperados)}, pagos ${ars(s.pagos_previstos)}, saldo ${ars(s.saldo_proyectado)}`).join('\n')
      : 'Sin proyeccion de caja cargada.'

    const mensaje = `Empresa: ${empresaNombre || 'PyME argentina'}
Periodo: ${MESES_F[mes - 1]} ${year}

DATOS FINANCIEROS DEL PERIODO:
${datosFinancieros}

CASH FLOW (proximas semanas):
${datosCashflow}`

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) { setError('VITE_ANTHROPIC_API_KEY no esta definida en .env.local'); setGenerando(false); return }

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
          max_tokens: 3000,
          system: PROMPT_CFO,
          messages: [{ role: 'user', content: mensaje }],
        }),
      })
      if (!resp.ok) {
        const t = await resp.text().catch(() => '')
        throw new Error(`HTTP ${resp.status}: ${t.slice(0, 120)}`)
      }
      const payload = await resp.json()
      setReporte(payload.content?.[0]?.text?.trim() || '')
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerando(false)
    }
  }

  const periodoLabel = `${MESES_F[mes - 1]} ${year}`

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="input w-28">
          {[AÑO - 1, AÑO, AÑO + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={mes} onChange={e => setMes(Number(e.target.value))} className="input w-40">
          {MESES_F.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <button
          onClick={handleGenerar}
          disabled={generando || !empresaId}
          className="btn-primary flex items-center gap-2 disabled:opacity-60"
        >
          {generando ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Generando reporte...
            </>
          ) : (
            <><Sparkles size={15} /> Generar reporte con IA</>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 mb-4">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Reporte generado */}
      {reporte && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-navy-800">Reporte ejecutivo — {periodoLabel}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{empresaNombre}</p>
            </div>
            <button
              onClick={() => {
                try { generarPDFReporte(reporte, empresaNombre, periodoLabel) }
                catch (e) { alert('Error al generar PDF: ' + e.message) }
              }}
              className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
            >
              <Download size={13} />
              Descargar PDF
            </button>
          </div>

          {/* Render secciones */}
          <div className="space-y-5 text-sm text-slate-700 leading-relaxed">
            {reporte.split(/\n{2,}/).map((bloque, i) => {
              const esTitulo = /^[A-Z\s]{8,}:?$/.test(bloque.trim())
              return esTitulo ? (
                <h4 key={i} className="text-xs font-bold text-navy-700 uppercase tracking-wider pt-2 border-t border-slate-100 first:border-0 first:pt-0">
                  {bloque.trim().replace(/:$/, '')}
                </h4>
              ) : (
                <p key={i}>{bloque.trim()}</p>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

export default function CFOPage() {
  const { empresa, isAsesor } = useAuth()
  const [tab,       setTab]       = useState('presupuesto')
  const [empresas,  setEmpresas]  = useState([])
  const [empresaId, setEmpresaId] = useState('')

  // Cargar lista de empresas para asesor
  useEffect(() => {
    if (!isAsesor) { if (empresa?.id) setEmpresaId(empresa.id); return }
    supabase.from('empresas').select('id, nombre').eq('activa', true).order('nombre')
      .then(({ data }) => {
        setEmpresas(data || [])
        if (data?.length) setEmpresaId(data[0].id)
      })
  }, [isAsesor, empresa])

  const empresaNombre = isAsesor
    ? (empresas.find(e => e.id === empresaId)?.nombre || '')
    : (empresa?.nombre || '')

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="CFO — Gestión mensual"
        subtitle="Presupuesto, cash flow y reportes"
        actions={
          isAsesor && empresas.length > 0 ? (
            <EmpresaSelector empresas={empresas} value={empresaId} onChange={setEmpresaId} />
          ) : (
            <span className="text-xs text-slate-400">{empresaNombre}</span>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="max-w-5xl mx-auto">
          {/* Tab selector */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            {TABS_CFO.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors
                  ${tab === t.id ? 'bg-white text-navy-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Contenido del tab activo */}
          <div className="card p-5">
            {tab === 'presupuesto' && (
              <PresupuestoTab isAsesor={isAsesor} empresa={empresa} empresas={empresas} empresaId={empresaId} />
            )}
            {tab === 'cashflow' && (
              <CashFlowTab isAsesor={isAsesor} empresaId={empresaId} />
            )}
            {tab === 'reporte' && (
              <ReporteTab isAsesor={isAsesor} empresa={empresa} empresas={empresas} empresaId={empresaId} empresaNombre={empresaNombre} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
