import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/shared/PageHeader'
import { ChevronLeft, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react'

// ── Configuración de pasos ─────────────────────────────────────────
const STEPS = [
  { n: 1, label: 'Tu negocio' },
  { n: 2, label: 'Ventas y costos' },
  { n: 3, label: 'Plata y deudas' },
  { n: 4, label: 'Tus bienes' },
]

const EMPTY_DATA = {
  // Paso 1
  lineas_negocio: '',
  estacionalidad: '',
  concentracion_top3: '',
  factura_usd: false,
  exporta: false,
  dolor_principal: '',
  decision_pendiente: '',
  objetivo_12meses: '',
  // Paso 2
  ventas_netas: '',
  costo_ventas: '',
  gastos_personal: '',
  gastos_admin: '',
  principal_costo: '',
  pct_costos_fijos: '',
  // Paso 3
  caja: '',
  deudores: '',
  stock: '',
  deuda_total: '',
  pasivo_corriente: '',
  dias_cobro: '',
  dias_pago: '',
  // Paso 4
  inmueble_propio: false,
  valor_inmueble: '',
  echeqs_disponibles: false,
  valor_echeqs: '',
  patrimonio_neto: '',
}

// ── Componentes de UI reutilizables ────────────────────────────────
function ProgressBar({ current }) {
  return (
    <div className="flex items-start mb-8 max-w-2xl mx-auto">
      {STEPS.map((s, i) => {
        const isDone = s.n < current
        const isActive = s.n === current
        return (
          <div key={s.n} className="flex-1 flex items-start">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all
                  ${isDone   ? 'bg-brand-600 text-white' :
                    isActive ? 'bg-brand-600 text-white ring-4 ring-brand-100' :
                               'bg-white border-2 border-slate-200 text-slate-400'}`}
              >
                {isDone ? <CheckCircle size={14} /> : s.n}
              </div>
              <span
                className={`text-xs mt-1.5 font-medium text-center leading-tight
                  ${isActive ? 'text-brand-700' : isDone ? 'text-brand-600' : 'text-slate-400'}`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mt-4 mx-1 transition-colors
                  ${isDone ? 'bg-brand-600' : 'bg-slate-200'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Field({ label, hint, optional, children }) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-navy-800 mb-1.5">
        {label}
        {optional && <span className="text-slate-400 font-normal ml-1 text-xs">(opcional)</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

function YesNo({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map(({ v, l }) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          className={`px-6 py-2 rounded-lg text-sm font-medium border transition-colors
            ${value === v
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300 hover:text-navy-700'}`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function MoneyInput({ value, onChange, placeholder = 'Ej: 1500000' }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">
        $
      </span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-7"
      />
    </div>
  )
}

function DaysInput({ value, onChange, placeholder = 'Ej: 30' }) {
  return (
    <div className="relative">
      <input
        type="number"
        min="0"
        max="365"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pr-14"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
        días
      </span>
    </div>
  )
}

// ── Paso 1: Tu negocio ─────────────────────────────────────────────
function Paso1({ data, set }) {
  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-navy-800 mb-1">Contanos sobre tu negocio</h3>
      <p className="text-sm text-slate-500 mb-5">Respondé con tus propias palabras — no hace falta ser técnico.</p>

      <Field label="¿A qué se dedica tu empresa? ¿Qué hacés o vendés?">
        <textarea
          rows={3}
          value={data.lineas_negocio}
          onChange={e => set('lineas_negocio', e.target.value)}
          placeholder="Ej: Fabricamos y vendemos ropa deportiva. Tenemos local propio y también vendemos por mayor a otros negocios del NOA..."
          className="input resize-none"
        />
      </Field>

      <Field label="¿Tu negocio tiene meses buenos y meses flojos?">
        <div className="flex flex-col gap-2">
          {[
            { v: 'ninguna',  l: 'No, es parejo todo el año' },
            { v: 'moderada', l: 'Sí, hay meses un poco mejores que otros' },
            { v: 'fuerte',   l: 'Muy marcada — en ciertos meses se concentra casi todo lo que ganamos' },
          ].map(({ v, l }) => (
            <label key={v} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="estacionalidad"
                value={v}
                checked={data.estacionalidad === v}
                onChange={() => set('estacionalidad', v)}
                className="w-4 h-4 text-brand-600 border-slate-300 focus:ring-brand-500"
              />
              <span className="text-sm text-slate-700 group-hover:text-navy-800">{l}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field
        label="¿Cuánto dependen tus ventas de tus 3 principales clientes?"
        hint="Esto nos ayuda a entender qué tan concentrado está tu negocio"
      >
        <select
          value={data.concentracion_top3}
          onChange={e => set('concentracion_top3', e.target.value)}
          className="input"
        >
          <option value="">Elegí una opción...</option>
          <option value="12.5">Menos del 25% — tengo muchos clientes distintos</option>
          <option value="37.5">Entre 25% y 50%</option>
          <option value="62.5">Entre 50% y 75%</option>
          <option value="87.5">Más del 75% — dependo de pocos clientes grandes</option>
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-sm font-medium text-navy-800 mb-1.5">¿Facturás en dólares?</label>
          <YesNo value={data.factura_usd} onChange={v => set('factura_usd', v)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-navy-800 mb-1.5">¿Exportás productos?</label>
          <YesNo value={data.exporta} onChange={v => set('exporta', v)} />
        </div>
      </div>

      <Field label="¿Cuál es el mayor problema de tu empresa hoy?">
        <textarea
          rows={2}
          value={data.dolor_principal}
          onChange={e => set('dolor_principal', e.target.value)}
          placeholder="Ej: Nos cuesta cobrar a tiempo y eso nos deja cortos de caja a fin de mes..."
          className="input resize-none"
        />
      </Field>

      <Field label="¿Qué decisión importante tenés frenada o pendiente?" optional>
        <input
          type="text"
          value={data.decision_pendiente}
          onChange={e => set('decision_pendiente', e.target.value)}
          placeholder="Ej: Comprar una máquina nueva, abrir una sucursal, contratar más gente..."
          className="input"
        />
      </Field>

      <Field label="¿Qué querés lograr en los próximos 12 meses?">
        <textarea
          rows={2}
          value={data.objetivo_12meses}
          onChange={e => set('objetivo_12meses', e.target.value)}
          placeholder="Ej: Bajar la deuda a la mitad y aumentar las ventas un 30%..."
          className="input resize-none"
        />
      </Field>
    </div>
  )
}

// ── Paso 2: Ventas y costos ────────────────────────────────────────
function Paso2({ data, set }) {
  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-navy-800 mb-1">Tus ventas y costos del último año</h3>
      <p className="text-sm text-slate-500 mb-5">
        Ponelos lo más aproximado que puedas — no tienen que ser exactos al peso.
      </p>

      <Field
        label="¿Cuánto vendiste en total el año pasado?"
        hint="El total de tus ingresos por ventas antes de impuestos"
      >
        <MoneyInput value={data.ventas_netas} onChange={v => set('ventas_netas', v)} placeholder="Ej: 15000000" />
      </Field>

      <Field
        label="¿Cuánto te costó lo que vendiste?"
        hint="La mercadería, las materias primas o lo que pagaste para producir lo que vendiste"
      >
        <MoneyInput value={data.costo_ventas} onChange={v => set('costo_ventas', v)} placeholder="Ej: 9000000" />
      </Field>

      <Field
        label="¿Cuánto pagaste de sueldos en el año?"
        hint="Incluí todos los sueldos, cargas sociales y aguinaldo"
      >
        <MoneyInput value={data.gastos_personal} onChange={v => set('gastos_personal', v)} placeholder="Ej: 2400000" />
      </Field>

      <Field
        label="¿Cuánto te costó mantener la oficina o el local?"
        hint="Alquiler, servicios, internet, papelería, honorarios y otros gastos fijos"
      >
        <MoneyInput value={data.gastos_admin} onChange={v => set('gastos_admin', v)} placeholder="Ej: 800000" />
      </Field>

      <Field label="¿Cuál es tu mayor costo?">
        <input
          type="text"
          value={data.principal_costo}
          onChange={e => set('principal_costo', e.target.value)}
          placeholder="Ej: La mercadería importada, los sueldos, el alquiler..."
          className="input"
        />
      </Field>

      <Field
        label="¿Cuánto de tus costos no cambian si vendés más o menos?"
        hint="Por ejemplo: el alquiler y los sueldos son fijos; la mercadería varía con las ventas"
      >
        <select
          value={data.pct_costos_fijos}
          onChange={e => set('pct_costos_fijos', e.target.value)}
          className="input"
        >
          <option value="">Elegí una opción...</option>
          <option value="10">Menos del 20% — casi todo varía con las ventas</option>
          <option value="30">Entre 20% y 40%</option>
          <option value="50">Entre 40% y 60%</option>
          <option value="70">Más del 60% — la mayoría son fijos</option>
        </select>
      </Field>
    </div>
  )
}

// ── Paso 3: Plata y deudas ─────────────────────────────────────────
function Paso3({ data, set }) {
  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-navy-800 mb-1">Tu plata disponible y tus deudas</h3>
      <p className="text-sm text-slate-500 mb-5">
        Estos números nos ayudan a ver si tu empresa tiene suficiente oxígeno financiero.
      </p>

      <Field
        label="¿Cuánto dinero tenés disponible hoy?"
        hint="Todo lo que tenés en caja, cuenta bancaria y plazos fijos"
      >
        <MoneyInput value={data.caja} onChange={v => set('caja', v)} placeholder="Ej: 500000" />
      </Field>

      <Field
        label="¿Cuánto te deben tus clientes en este momento?"
        hint="Facturas pendientes de cobro, cheques recibidos, cuentas corrientes a tu favor"
      >
        <MoneyInput value={data.deudores} onChange={v => set('deudores', v)} placeholder="Ej: 1200000" />
      </Field>

      <Field
        label="¿Cuánto tenés en stock o mercadería?"
        hint="El valor de todo lo que tenés almacenado listo para vender o producir"
      >
        <MoneyInput value={data.stock} onChange={v => set('stock', v)} placeholder="Ej: 800000" />
      </Field>

      <Field
        label="¿Cuánto debés en total?"
        hint="Sumá préstamos bancarios, tarjetas, deudas con proveedores — todo lo que debés"
      >
        <MoneyInput value={data.deuda_total} onChange={v => set('deuda_total', v)} placeholder="Ej: 3000000" />
      </Field>

      <Field
        label="¿Cuánto de esa deuda tenés que pagar en menos de un año?"
        hint="Las cuotas y vencimientos que caen en los próximos 12 meses"
      >
        <MoneyInput value={data.pasivo_corriente} onChange={v => set('pasivo_corriente', v)} placeholder="Ej: 1200000" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="¿En cuántos días cobran tus clientes?"
          hint="Promedio desde que vendés hasta que te pagan"
        >
          <DaysInput value={data.dias_cobro} onChange={v => set('dias_cobro', v)} placeholder="Ej: 30" />
        </Field>

        <Field
          label="¿En cuántos días pagás a tus proveedores?"
          hint="Promedio desde que comprás hasta que pagás"
        >
          <DaysInput value={data.dias_pago} onChange={v => set('dias_pago', v)} placeholder="Ej: 15" />
        </Field>
      </div>
    </div>
  )
}

// ── Paso 4: Tus bienes ─────────────────────────────────────────────
function Paso4({ data, set }) {
  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-navy-800 mb-1">Tus bienes y el valor de la empresa</h3>
      <p className="text-sm text-slate-500 mb-5">
        Esta info nos ayuda a entender qué garantías y activos tiene tu empresa.
      </p>

      <Field label="¿Tenés un local, galpón o inmueble propio?">
        <YesNo value={data.inmueble_propio} onChange={v => set('inmueble_propio', v)} />
        {data.inmueble_propio && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-navy-800 mb-1.5">
              ¿Cuánto calculás que vale?
              <span className="text-slate-400 font-normal ml-1 text-xs">(opcional)</span>
            </label>
            <MoneyInput
              value={data.valor_inmueble}
              onChange={v => set('valor_inmueble', v)}
              placeholder="Ej: 50000000"
            />
          </div>
        )}
      </Field>

      <Field label="¿Tenés cheques diferidos o ECHEQs para cobrar?">
        <YesNo value={data.echeqs_disponibles} onChange={v => set('echeqs_disponibles', v)} />
        {data.echeqs_disponibles && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-navy-800 mb-1.5">
              ¿Por cuánto monto aproximado?
              <span className="text-slate-400 font-normal ml-1 text-xs">(opcional)</span>
            </label>
            <MoneyInput
              value={data.valor_echeqs}
              onChange={v => set('valor_echeqs', v)}
              placeholder="Ej: 2000000"
            />
          </div>
        )}
      </Field>

      <Field
        label="¿Cuánto calculás que vale tu empresa hoy?"
        optional
        hint="Es todo lo que tiene la empresa (maquinaria, stock, plata, inmuebles) menos todo lo que debe. Si no sabés, dejalo en blanco."
      >
        <MoneyInput value={data.patrimonio_neto} onChange={v => set('patrimonio_neto', v)} placeholder="Ej: 20000000" />
      </Field>

      <div className="mt-4 p-4 rounded-lg bg-brand-50 border border-brand-100">
        <p className="text-sm text-brand-800 font-medium mb-0.5">¡Casi terminaste!</p>
        <p className="text-xs text-brand-700">
          Al hacer clic en "Completar diagnóstico" guardamos todo y tu asesor va a poder ver el análisis completo de tu empresa.
        </p>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────
export default function DiagnosticoPage() {
  const { empresa } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState(1)
  const [data, setData] = useState(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  // Cargar datos existentes al montar
  useEffect(() => {
    if (!empresa) return

    async function cargarDatos() {
      // Cargar diagnóstico cualitativo
      const { data: diag } = await supabase
        .from('diagnostico')
        .select('*')
        .eq('empresa_id', empresa.id)
        .maybeSingle()

      if (diag) {
        const g = diag.garantias || {}
        setData(prev => ({
          ...prev,
          lineas_negocio:    diag.lineas_negocio    || '',
          estacionalidad:    diag.estacionalidad    || '',
          concentracion_top3: diag.concentracion_top3 != null ? String(diag.concentracion_top3) : '',
          factura_usd:       diag.factura_usd       ?? false,
          exporta:           diag.exporta           ?? false,
          dolor_principal:   diag.dolor_principal   || '',
          decision_pendiente: diag.decision_pendiente || '',
          objetivo_12meses:  diag.objetivo_12meses  || '',
          principal_costo:   diag.principal_costo   || '',
          pct_costos_fijos:  diag.pct_costos_fijos  != null ? String(diag.pct_costos_fijos) : '',
          // Bienes
          inmueble_propio:   g.inmueble_propio      ?? false,
          valor_inmueble:    g.valor_inmueble        != null ? String(g.valor_inmueble) : '',
          echeqs_disponibles: g.echeqs_disponibles  ?? false,
          valor_echeqs:      g.valor_echeqs          != null ? String(g.valor_echeqs) : '',
          // Datos financieros guardados para resumir el formulario
          caja:    g._caja    != null ? String(g._caja)    : '',
          deudores: g._deudores != null ? String(g._deudores) : '',
        }))

        // Si ya está completo y no viene del botón "Editar", redirigir a resultados
        if (diag.estado === 'completo' && !location.state?.edit) {
          navigate('/diagnostico/resultados', { replace: true })
          return
        }
      }

      // Cargar datos numéricos del último período anual
      const { data: periodo } = await supabase
        .from('periodos_financieros')
        .select('*')
        .eq('empresa_id', empresa.id)
        .eq('tipo_periodo', 'año')
        .order('periodo', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (periodo) {
        setData(prev => ({
          ...prev,
          ventas_netas:    periodo.ventas_netas    ? String(periodo.ventas_netas)    : prev.ventas_netas,
          costo_ventas:    periodo.costo_ventas    ? String(periodo.costo_ventas)    : prev.costo_ventas,
          gastos_personal: periodo.gastos_personal ? String(periodo.gastos_personal) : prev.gastos_personal,
          gastos_admin:    periodo.gastos_admin    ? String(periodo.gastos_admin)    : prev.gastos_admin,
          stock:           periodo.stock           ? String(periodo.stock)           : prev.stock,
          deuda_total:     periodo.deuda_total     ? String(periodo.deuda_total)     : prev.deuda_total,
          pasivo_corriente: periodo.pasivo_corriente ? String(periodo.pasivo_corriente) : prev.pasivo_corriente,
          dias_cobro:      periodo.dias_cobro      ? String(periodo.dias_cobro)      : prev.dias_cobro,
          dias_pago:       periodo.dias_pago       ? String(periodo.dias_pago)       : prev.dias_pago,
          patrimonio_neto: periodo.patrimonio_neto ? String(periodo.patrimonio_neto) : prev.patrimonio_neto,
        }))
      }

      // Restaurar paso desde localStorage
      const pasoGuardado = localStorage.getItem(`diag_step_${empresa.id}`)
      if (pasoGuardado) setStep(Number(pasoGuardado))

      setLoading(false)
    }

    cargarDatos()
  }, [empresa])

  function actualizar(campo, valor) {
    setData(prev => ({ ...prev, [campo]: valor }))
    setSaved(false)
  }

  async function guardar(esCompleto = false) {
    setSaving(true)
    setError(null)

    const garantias = {
      inmueble_propio:    data.inmueble_propio,
      valor_inmueble:     data.valor_inmueble    ? Number(data.valor_inmueble)    : null,
      echeqs_disponibles: data.echeqs_disponibles,
      valor_echeqs:       data.valor_echeqs      ? Number(data.valor_echeqs)      : null,
      // Guardamos el desglose para poder restaurar el formulario
      _caja:    data.caja    ? Number(data.caja)    : null,
      _deudores: data.deudores ? Number(data.deudores) : null,
    }

    const payloadDiag = {
      empresa_id:         empresa.id,
      estado:             esCompleto ? 'completo' : 'borrador',
      lineas_negocio:     data.lineas_negocio     || null,
      estacionalidad:     data.estacionalidad     || null,
      concentracion_top3: data.concentracion_top3  ? Number(data.concentracion_top3) : null,
      factura_usd:        data.factura_usd,
      exporta:            data.exporta,
      dolor_principal:    data.dolor_principal     || null,
      decision_pendiente: data.decision_pendiente  || null,
      objetivo_12meses:   data.objetivo_12meses    || null,
      principal_costo:    data.principal_costo     || null,
      pct_costos_fijos:   data.pct_costos_fijos    ? Number(data.pct_costos_fijos) : null,
      garantias,
      updated_at:         new Date().toISOString(),
    }

    const { error: errDiag } = await supabase
      .from('diagnostico')
      .upsert(payloadDiag, { onConflict: 'empresa_id' })

    if (errDiag) {
      setError('No pudimos guardar. Revisá tu conexión e intentá de nuevo.')
      setSaving(false)
      return false
    }

    // Al completar el paso 4, guardar también en periodos_financieros
    if (esCompleto) {
      const anio = String(new Date().getFullYear() - 1)
      const activo_corriente =
        (Number(data.caja) || 0) + (Number(data.deudores) || 0) + (Number(data.stock) || 0)

      const payloadPeriodo = {
        empresa_id:       empresa.id,
        periodo:          anio,
        tipo_periodo:     'año',
        ventas_netas:     Number(data.ventas_netas)    || 0,
        costo_ventas:     Number(data.costo_ventas)    || 0,
        gastos_personal:  Number(data.gastos_personal) || 0,
        gastos_admin:     Number(data.gastos_admin)    || 0,
        activo_corriente,
        stock:            Number(data.stock)           || 0,
        pasivo_corriente: Number(data.pasivo_corriente) || 0,
        deuda_total:      Number(data.deuda_total)     || 0,
        dias_cobro:       Number(data.dias_cobro)      || 0,
        dias_pago:        Number(data.dias_pago)       || 0,
        patrimonio_neto:  Number(data.patrimonio_neto) || 0,
      }

      const { error: errPeriodo } = await supabase
        .from('periodos_financieros')
        .upsert(payloadPeriodo, { onConflict: 'empresa_id,periodo' })

      if (errPeriodo) {
        setError('Los datos financieros no se guardaron correctamente. Intentá de nuevo.')
        setSaving(false)
        return false
      }
    }

    setSaving(false)
    setSaved(true)
    return true
  }

  async function handleSiguiente() {
    const ok = await guardar(false)
    if (!ok) return
    const siguiente = step + 1
    setStep(siguiente)
    localStorage.setItem(`diag_step_${empresa.id}`, siguiente)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleCompletar() {
    const ok = await guardar(true)
    if (ok) navigate('/diagnostico/resultados')
  }

  function handleAnterior() {
    const anterior = step - 1
    setStep(anterior)
    localStorage.setItem(`diag_step_${empresa.id}`, anterior)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-slate-400">Cargando tu diagnóstico...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="Diagnóstico financiero"
        subtitle="Contanos sobre tu empresa — solo lleva unos minutos"
        actions={
          <span className="badge badge-amber">En progreso</span>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <ProgressBar current={step} />

        <div className="max-w-2xl mx-auto">
          {step === 1 && <Paso1 data={data} set={actualizar} />}
          {step === 2 && <Paso2 data={data} set={actualizar} />}
          {step === 3 && <Paso3 data={data} set={actualizar} />}
          {step === 4 && <Paso4 data={data} set={actualizar} />}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* Navegación */}
          <div className="flex items-center justify-between mt-6">
            <button
              type="button"
              onClick={handleAnterior}
              disabled={step === 1}
              className="btn-secondary flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              Anterior
            </button>

            <div className="flex items-center gap-3">
              {saved && !saving && (
                <span className="flex items-center gap-1 text-xs text-brand-600 font-medium">
                  <CheckCircle size={13} />
                  Guardado
                </span>
              )}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleSiguiente}
                  disabled={saving}
                  className="btn-primary flex items-center gap-1.5 disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : 'Guardar y continuar'}
                  {!saving && <ChevronRight size={16} />}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCompletar}
                  disabled={saving}
                  className="btn-primary flex items-center gap-1.5 disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : 'Completar diagnóstico'}
                  {!saving && <CheckCircle size={16} />}
                </button>
              )}
            </div>
          </div>

          {/* Indicador de paso */}
          <p className="text-center text-xs text-slate-400 mt-4">
            Paso {step} de {STEPS.length}
          </p>
        </div>
      </div>
    </div>
  )
}
