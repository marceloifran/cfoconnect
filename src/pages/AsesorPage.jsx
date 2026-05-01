import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'
import PageHeader from '@/components/shared/PageHeader'
import { ars } from '@/lib/financials'
import {
  Building2, AlertTriangle, TrendingUp, Plus, ExternalLink,
  CheckCircle, Clock, MessageCircle, ChevronRight, Zap, Bell,
  FileUp, ClipboardCheck, Eye,
} from 'lucide-react'

// Cliente garantizado con service role
const _svcKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY
const _url    = import.meta.env.VITE_SUPABASE_URL
const adminDb = supabaseAdmin
  || (_svcKey ? createClient(_url, _svcKey, { auth: { persistSession: false } }) : null)
  || supabase
console.log('[AsesorPage] adminDb type:', _svcKey ? 'service_role' : 'anon_fallback')

// ── Mapa de etapas ─────────────────────────────────────────────────
const ETAPA_MAP = {
  1: { label: 'Onboarding',        badge: 'badge-gray'  },
  2: { label: 'Diagnóstico',       badge: 'badge-amber' },
  3: { label: 'CFO activo',        badge: 'badge-green' },
  4: { label: 'Mercado capitales', badge: 'badge-blue'  },
  5: { label: 'Estratégico',       badge: 'badge-navy'  },
}

// ── Checklist de onboarding por empresa ────────────────────────────
const ONBOARDING_ITEMS = [
  { key: 'tiene_balance',    label: 'Balance cargado'          },
  { key: 'diag_completo',   label: 'Diagnóstico completo'      },
  { key: 'tiene_scoring',   label: 'Scoring SGR calculado'     },
  { key: 'tiene_cfo',       label: 'Presupuesto/CFO activo'    },
  { key: 'cuenta_comitente',label: 'Cuenta Beat Valores'       },
]

// ── Fila de empresa ─────────────────────────────────────────────────
// Badge estado diagnóstico — estilo Nexxo
function NxBadgeEstado({ label, tipo }) {
  const cls = {
    Onboarding:          'bg-amber-50 text-amber-700 border border-amber-200',
    'Balance recibido':  'bg-stone-50 text-stone-600 border border-stone-200',
    'Encuesta lista':    'bg-stone-50 text-stone-600 border border-stone-200',
    'Listo para analizar':'bg-stone-50 text-stone-600 border border-stone-200',
    'En revisión':       'bg-blue-50 text-blue-700 border border-blue-200',
    'Informe publicado': 'bg-green-50 text-green-700 border border-green-200',
    Completado:          'bg-green-50 text-green-700 border border-green-200',
    'Esperando cliente': 'bg-amber-50 text-amber-700 border border-amber-200',
  }[label] || 'bg-nexxo-off text-nexxo-gray border border-nexxo-light'
  return (
    <span className={`${cls} text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm`}>
      {label}
    </span>
  )
}

function EmpresaRow({ empresa, onAcceder, onRecargar, onVerInfo, idx }) {
  const score = empresa.scoring_sgr?.[0]?.score_total
  const est   = getEstadoDiag(empresa)
  const rowBg = idx % 2 === 0 ? 'bg-nexxo-white' : 'bg-nexxo-off'
  const tieneDoc = empresa._tieneBalance || empresa._tieneEncuesta
    || empresa.balance_subido_por_cliente || empresa.encuesta_completada

  return (
    <tr className={`${rowBg} hover:bg-nexxo-light cursor-pointer border-b border-nexxo-light transition-colors`}>
      <td className="px-4 py-3.5">
        <div>
          <p className="text-sm font-semibold text-nexxo-black">{empresa.nombre}</p>
          <p className="text-[10px] text-nexxo-gray mt-0.5">{empresa.cuit || 'Sin CUIT'} · {empresa.rubro || 'Sin rubro'}</p>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex flex-col gap-1">
          <NxBadgeEstado label={est.label} />
          <div className="flex items-center gap-2">
            {(empresa._tieneBalance || empresa.balance_subido_por_cliente) && (
              <span className="text-[9px] text-green-700 flex items-center gap-0.5">
                <FileUp size={9} /> balance
              </span>
            )}
            {(empresa._tieneEncuesta || empresa.encuesta_completada) && (
              <span className="text-[9px] text-green-700 flex items-center gap-0.5">
                <ClipboardCheck size={9} /> encuesta
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        {score > 0 ? (
          <span className={`font-mono text-sm font-bold
            ${score >= 65 ? 'text-green-700' : score >= 50 ? 'text-amber-700' : 'text-red-600'}`}>
            {score}/100
          </span>
        ) : (
          <span className="text-[10px] text-nexxo-topoLt">—</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-nexxo-gray">
          {empresa.plan_servicio ? empresa.plan_servicio.replace(/_/g, ' ') : '—'}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1">
          {tieneDoc && (
            <button onClick={() => onVerInfo(empresa)}
              className="py-1 px-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider
                         text-amber-700 border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors"
              style={{ borderRadius: 2 }}
              title="Ver documentación del cliente">
              <Eye size={11} /> Ver docs
            </button>
          )}
          <button onClick={() => onAcceder(empresa)} className="btn-secondary py-1 px-3 flex items-center gap-1">
            <ExternalLink size={11} /> Acceder
          </button>
          <MenuEstado empresa={empresa} onActualizar={onRecargar} />
        </div>
      </td>
    </tr>
  )
}

// ── Tarjeta de empresa (Móvil) ──────────────────────────────────────
function EmpresaCard({ empresa, onAcceder, onRecargar, onVerInfo }) {
  const score = empresa.scoring_sgr?.[0]?.score_total
  const est   = getEstadoDiag(empresa)
  const tieneDoc = empresa._tieneBalance || empresa._tieneEncuesta
    || empresa.balance_subido_por_cliente || empresa.encuesta_completada

  return (
    <div className="bg-white p-4 flex flex-col gap-3">
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className="text-sm font-semibold text-nexxo-black">{empresa.nombre}</p>
          <p className="text-[10px] text-nexxo-gray mt-0.5">{empresa.cuit || 'Sin CUIT'} · {empresa.rubro || 'Sin rubro'}</p>
        </div>
        <NxBadgeEstado label={est.label} />
      </div>

      <div className="flex items-center gap-3 bg-nexxo-off p-2 rounded border border-nexxo-light">
        <div className="flex-1">
          <span className="text-[9px] uppercase tracking-wider text-nexxo-topo font-bold block mb-0.5">Docs</span>
          <div className="flex items-center gap-2">
            {(empresa._tieneBalance || empresa.balance_subido_por_cliente) ? (
              <span className="text-[10px] text-green-700 font-medium flex items-center gap-1"><FileUp size={10} /> Bal</span>
            ) : <span className="text-[10px] text-nexxo-topo">No</span>}
            {(empresa._tieneEncuesta || empresa.encuesta_completada) ? (
              <span className="text-[10px] text-green-700 font-medium flex items-center gap-1"><ClipboardCheck size={10} /> Enc</span>
            ) : <span className="text-[10px] text-nexxo-topo">No</span>}
          </div>
        </div>
        <div className="w-px h-8 bg-nexxo-line" />
        <div className="flex-1">
          <span className="text-[9px] uppercase tracking-wider text-nexxo-topo font-bold block mb-0.5">Score</span>
          {score > 0 ? (
            <span className={`font-mono text-xs font-bold ${score >= 65 ? 'text-green-700' : score >= 50 ? 'text-amber-700' : 'text-red-600'}`}>
              {score}/100
            </span>
          ) : <span className="text-[10px] text-nexxo-topoLt">—</span>}
        </div>
        <div className="w-px h-8 bg-nexxo-line" />
        <div className="flex-1">
          <span className="text-[9px] uppercase tracking-wider text-nexxo-topo font-bold block mb-0.5">Plan</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-nexxo-gray truncate max-w-[80px] inline-block">
            {empresa.plan_servicio ? empresa.plan_servicio.replace(/_/g, ' ') : '—'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="flex items-center gap-2 flex-1">
          {tieneDoc && (
            <button onClick={() => onVerInfo(empresa)}
              className="flex-1 py-1.5 px-2 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider
                         text-amber-700 border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors rounded-sm">
              <Eye size={11} /> Docs
            </button>
          )}
          <button onClick={() => onAcceder(empresa)} className="btn-secondary flex-1 py-1.5 px-0 flex justify-center items-center gap-1 text-[10px]">
            <ExternalLink size={11} /> Acceder
          </button>
        </div>
        <MenuEstado empresa={empresa} onActualizar={onRecargar} />
      </div>
    </div>
  )
}

// ── Modal info del cliente ──────────────────────────────────────────
function InfoClienteModal({ empresa, onCerrar }) {
  const [urlBalance, setUrlBalance] = useState(null)
  const [encuesta,   setEncuesta]   = useState(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (!empresa?.id) return
    async function cargarInfo() {
      // 1. URL firmada del balance PDF
      const { data: signed } = await adminDb.storage
        .from('balances-cliente')
        .createSignedUrl(`${empresa.id}/balance.pdf`, 3600)
      if (signed?.signedUrl) setUrlBalance(signed.signedUrl)

      // 2. Respuestas de la encuesta desde diagnostico_profundo
      const { data: dp } = await adminDb
        .from('diagnostico_profundo')
        .select('dimension5')
        .eq('empresa_id', empresa.id)
        .maybeSingle()
      if (dp?.dimension5) setEncuesta(dp.dimension5)

      setLoading(false)
    }
    cargarInfo()
  }, [empresa?.id])

  const CAMPOS_ENCUESTA = [
    { key: 'problema_financiero',      label: 'Problema financiero principal' },
    { key: 'perdio_oportunidad',       label: '¿Perdió oportunidad por falta de financiamiento?' },
    { key: 'descripcion_oportunidad',  label: 'Descripción de la oportunidad' },
    { key: 'financiamiento_dia_dia',   label: 'Cómo financia el día a día' },
    { key: 'certeza_cobro',            label: 'Certeza sobre cobros del próximo mes' },
    { key: 'objetivo_12meses',         label: 'Objetivo en 12 meses' },
    { key: 'conoce_mercado_capitales', label: 'Conocimiento del mercado de capitales' },
    { key: 'expectativa_cfoconnect',   label: 'Expectativa del servicio' },
    { key: 'comentario_libre',         label: 'Comentario adicional' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-nexxo-black/40 backdrop-blur-sm" onClick={onCerrar} />
      <div className="relative bg-white w-full max-w-lg max-h-[85vh] flex flex-col shadow-nexxo-lg"
        style={{ borderRadius: 2 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-nexxo-light bg-nexxo-black">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-nexxo-topo mb-0.5">Información del cliente</p>
            <p className="text-sm font-semibold text-white">{empresa.nombre}</p>
          </div>
          <button onClick={onCerrar}
            className="w-7 h-7 flex items-center justify-center text-nexxo-topo hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <p className="text-sm text-nexxo-gray text-center py-6">Cargando información...</p>
          ) : (
            <div className="space-y-5">

              {/* Balance */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-nexxo-topo mb-2 flex items-center gap-2">
                  <span className="flex-1 h-px bg-nexxo-light block" />
                  Balance PDF
                </p>
                {urlBalance ? (
                  <a href={urlBalance} target="_blank" rel="noreferrer"
                    className="btn-primary flex items-center gap-2 text-sm">
                    ↓ Descargar balance del cliente
                  </a>
                ) : (
                  <p className="text-sm text-nexxo-gray italic">El cliente aún no subió su balance.</p>
                )}
              </div>

              {/* Encuesta */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-nexxo-topo mb-2 flex items-center gap-2">
                  <span className="flex-1 h-px bg-nexxo-light block" />
                  Respuestas de la encuesta
                </p>
                {encuesta ? (
                  <div className="space-y-2">
                    {CAMPOS_ENCUESTA.map(({ key, label }) => {
                      const val = encuesta[key]
                      if (!val || (Array.isArray(val) && !val.length)) return null
                      return (
                        <div key={key} className="p-2.5" style={{ background: 'var(--nx-off)', borderLeft: '2px solid var(--nx-topo)' }}>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-nexxo-topo mb-0.5">{label}</p>
                          <p className="text-sm text-nexxo-black">
                            {Array.isArray(val) ? val.join(', ') : String(val) === 'true' ? 'Sí' : String(val) === 'false' ? 'No' : val}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-nexxo-gray italic">El cliente aún no completó la encuesta.</p>
                )}
              </div>

            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-nexxo-light bg-nexxo-off flex justify-end">
          <button onClick={onCerrar} className="btn-secondary text-sm">Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de alerta ───────────────────────────────────────────────
function AlertaCard({ alerta }) {
  const colores = {
    critico: 'text-red-500',
    alto:    'text-amber-500',
    info:    'text-blue-400',
  }
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <AlertTriangle size={14} className={`flex-shrink-0 mt-0.5 ${colores[alerta.nivel] || 'text-slate-400'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-navy-700 truncate">{alerta.empresas?.nombre}</p>
        <p className="text-sm text-slate-600">{alerta.mensaje}</p>
      </div>
      <span className="text-xs text-slate-400 flex-shrink-0">
        {new Date(alerta.created_at).toLocaleDateString('es-AR')}
      </span>
    </div>
  )
}

// ── Modal nueva empresa ─────────────────────────────────────────────
const RUBROS = [
  'Agroindustria', 'Construcción', 'Comercio minorista', 'Comercio mayorista',
  'Manufactura', 'Servicios profesionales', 'Gastronomía', 'Transporte y logística',
  'Tecnología', 'Salud', 'Educación', 'Otro',
]
const PLANES = [
  { v: 'diagnostico', l: 'Solo diagnóstico' },
  { v: 'cfo_basico',  l: 'CFO Básico' },
  { v: 'cfo_medio',   l: 'CFO Medio' },
  { v: 'cfo_full',    l: 'CFO Full' },
]

function ModalNuevaEmpresa({ onCreada, onCerrar, asesorId, asesorNombre }) {
  const VACIO = { nombre: '', cuit: '', rubro: '', localidad: '', provincia: 'Salta', plan_servicio: 'diagnostico' }
  const [datos, setDatos]   = useState(VACIO)
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)

  function campo(k, v) { setDatos(p => ({ ...p, [k]: v })) }

  async function handleCrear() {
    if (!datos.nombre.trim()) { setErr('El nombre es obligatorio.'); return }
    setSaving(true); setErr(null)
    const { data, error } = await supabase.from('empresas')
      .insert({
        nombre:        datos.nombre.trim(),
        cuit:          datos.cuit.trim() || null,
        rubro:         datos.rubro || null,
        localidad:     datos.localidad.trim() || null,
        provincia:     datos.provincia,
        plan_servicio: datos.plan_servicio,
        etapa_numero:  1,
        asesor_id:     asesorId || null,
        asesor_nombre: asesorNombre || null,
        activa:        true,
      })
      .select().single()
    setSaving(false)
    if (error) { setErr('No se pudo crear la empresa.'); return }

    // Si hay asesorId, crear asignación automática
    if (asesorId) {
      await supabase.from('asignaciones').insert({ asesor_id: asesorId, empresa_id: data.id })
    }
    onCreada(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-800/40 backdrop-blur-sm" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-navy-800">Nueva empresa</h2>
          <button onClick={onCerrar} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="label">Nombre <span className="text-red-400">*</span></label>
            <input type="text" value={datos.nombre} onChange={e => campo('nombre', e.target.value)} className="input" placeholder="Ej: Molinos del NOA SA" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">CUIT</label>
              <input type="text" value={datos.cuit} onChange={e => campo('cuit', e.target.value)} className="input" placeholder="30-00000000-0" />
            </div>
            <div>
              <label className="label">Rubro</label>
              <select value={datos.rubro} onChange={e => campo('rubro', e.target.value)} className="input">
                <option value="">Seleccioná...</option>
                {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Localidad</label>
              <input type="text" value={datos.localidad} onChange={e => campo('localidad', e.target.value)} className="input" placeholder="Ej: Salta" />
            </div>
            <div>
              <label className="label">Plan</label>
              <select value={datos.plan_servicio} onChange={e => campo('plan_servicio', e.target.value)} className="input">
                {PLANES.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
              </select>
            </div>
          </div>
          {err && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12} />{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onCerrar} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={handleCrear} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
            {saving ? 'Creando...' : 'Crear empresa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Badge de estado diagnóstico ─────────────────────────────────────
function getEstadoDiag(e) {
  const et = e.etapa_diagnostico || 1
  // Usar tanto campos DB como datos enriquecidos desde Storage/diagnostico_profundo
  const tieneBalance  = !!e.balance_subido_por_cliente  || !!e._tieneBalance
  const tieneEncuesta = !!e.encuesta_completada         || !!e._tieneEncuesta

  if (et >= 5) return { label: 'Completado',           cls: 'badge-navy'  }
  if (et >= 4) return { label: 'Informe publicado',    cls: 'badge-green' }
  if (et >= 3 || (tieneBalance && tieneEncuesta)) return { label: 'Listo para analizar', cls: 'badge-amber' }
  if (tieneBalance && tieneEncuesta) return { label: 'Listo para analizar', cls: 'badge-amber' }
  if (tieneBalance)  return { label: 'Balance recibido',   cls: 'badge-amber' }
  if (tieneEncuesta) return { label: 'Encuesta lista',     cls: 'badge-amber' }
  return { label: 'Esperando cliente',   cls: 'badge-gray'  }
}

// ── Cards de acción requerida — Nexxo ───────────────────────────────
function AccionesRequeridas({ empresas, onActivar, onVerInfo }) {
  const acciones = empresas.filter(e => {
    const tieneBal = e._tieneBalance || e.balance_subido_por_cliente
    const tieneEnc = e._tieneEncuesta || e.encuesta_completada
    return (tieneBal || tieneEnc) && (e.etapa_diagnostico || 1) <= 3
  })
  if (!acciones.length) return null
  return (
    <div className="space-y-2">
      {acciones.map(e => {
        const tieneBal = e._tieneBalance || e.balance_subido_por_cliente
        const tieneEnc = e._tieneEncuesta || e.encuesta_completada
        const ambos = tieneBal && tieneEnc
        return (
          <div key={e.id}
            className="bg-nexxo-black border-l-4 border-l-nexxo-topo p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-nexxo-white">
                {ambos
                  ? `${e.nombre} — balance + encuesta recibidos`
                  : tieneBal
                    ? `${e.nombre} — subió su balance`
                    : `${e.nombre} — completó la encuesta`}
              </p>
              <p className="text-xs text-nexxo-topo mt-0.5">
                {ambos ? 'Listo para comenzar el análisis' : tieneBal ? 'Balance recibido' : 'Encuesta recibida'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => onVerInfo(e)}
                className="text-[10px] font-bold uppercase tracking-wider text-nexxo-topo
                           border border-nexxo-topo px-3 py-1.5 hover:bg-nexxo-topo hover:text-nexxo-black transition-colors">
                Ver docs →
              </button>
              <button
                onClick={() => onActivar(e, ambos ? '/diagnostico-profundo' : tieneBal ? '/balance' : '/diagnostico-profundo')}
                className="text-[10px] font-bold uppercase tracking-wider bg-nexxo-topo text-nexxo-black
                           px-3 py-1.5 hover:bg-nexxo-topoLt transition-colors">
                {ambos ? 'Ir al diagnóstico →' : 'Ir al análisis →'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Menú de control de estado ────────────────────────────────────────
function MenuEstado({ empresa, onActualizar }) {
  const [abierto, setAbierto] = useState(false)
  const [saving,  setSaving]  = useState(false)

  async function cambiarEstado(updates) {
    setSaving(true); setAbierto(false)
    await supabase.from('empresas').update(updates).eq('id', empresa.id)
    setSaving(false)
    onActualizar()
  }

  const opciones = [
    { label: 'Esperando información', updates: { etapa_diagnostico: 1 } },
    { label: 'Información recibida',  updates: { etapa_diagnostico: 2 } },
    { label: 'En revisión',           updates: { etapa_diagnostico: 3 } },
    { label: 'Publicar informe',      updates: { etapa_diagnostico: 4, informe_publicado: true, informe_publicado_at: new Date().toISOString() } },
    { label: 'Propuesta presentada',  updates: { etapa_diagnostico: 5 } },
    null,
    { label: '✓ Marcar balance recibido',   updates: { balance_subido_por_cliente: true } },
    { label: '✓ Marcar encuesta recibida',  updates: { encuesta_completada: true } },
  ]

  return (
    <div className="relative">
      <button onClick={() => setAbierto(o => !o)} disabled={saving}
        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors text-base font-bold leading-none">
        ···
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 min-w-52 overflow-hidden">
            <p className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">
              Ajustar estado del cliente
            </p>
            {opciones.map((op, i) =>
              op === null
                ? <div key={i} className="border-t border-slate-100 my-1" />
                : (
                  <button key={op.label} onClick={() => cambiarEstado(op.updates)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                    {op.label}
                  </button>
                )
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────────
export default function AsesorPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [empresas,       setEmpresas]       = useState([])
  const [alertas,        setAlertas]        = useState([])
  const [mensajesSin,    setMensajesSin]    = useState(0)
  const [loading,        setLoading]        = useState(true)
  const [modalNueva,     setModalNueva]     = useState(false)
  const [modalInfoEmpresa, setModalInfoEmpresa] = useState(null)
  const [busqueda,       setBusqueda]       = useState('')
  const [filtroEtapa,    setFiltroEtapa]    = useState('todas')
  const [notificaciones, setNotificaciones] = useState([])

  async function cargar() {
    const asesorId = profile?.id
    console.log('[AsesorPage] cargar() → asesorId:', asesorId)
    if (!asesorId) { setLoading(false); return }

    try {
      // ── PASO 1: asignaciones ──────────────────────────────────────
      const { data: asig, error: e1 } = await adminDb
        .from('asignaciones')
        .select('empresa_id')
        .eq('asesor_id', asesorId)

      console.log('[AsesorPage] asignaciones data:', asig, '| error:', e1?.message)

      // ── PASO 1b: test sin filtro (detecta RLS) ────────────────────
      const { data: testRLS } = await adminDb.from('asignaciones').select('*').limit(5)
      console.log('[AsesorPage] test sin filtro (RLS check):', testRLS)

      const empresaIds = [...new Set((asig || []).map(a => a.empresa_id))]
      console.log('[AsesorPage] empresaIds:', empresaIds)

      if (empresaIds.length === 0) { setEmpresas([]); return }

      // ── PASO 2: empresas ──────────────────────────────────────────
      const { data: emps, error: e2 } = await adminDb
        .from('empresas')
        .select('*')
        .in('id', empresaIds)
        .order('nombre')

      console.log('[AsesorPage] empresas data:', emps, '| error:', e2?.message)

      // ── PASO 3: resto de datos en paralelo ────────────────────────
      const storageQueries = (emps || []).map(emp =>
        adminDb.storage.from('balances-cliente').list(String(emp.id), { limit: 1 })
      )

      const [altRes, msgRes, periRes, dpRes, ...storageResults] = await Promise.all([
        adminDb.from('alertas')
          .select('*, empresas(nombre)')
          .in('empresa_id', empresaIds)
          .eq('leida', false)
          .order('created_at', { ascending: false })
          .limit(10),
        adminDb.from('mensajes')
          .select('id', { count: 'exact', head: true })
          .in('empresa_id', empresaIds)
          .eq('remitente_rol', 'cliente')
          .eq('leido', false),
        adminDb.from('periodos_financieros')
          .select('empresa_id')
          .in('empresa_id', empresaIds),
        adminDb.from('diagnostico_profundo')
          .select('empresa_id, dimension5')
          .in('empresa_id', empresaIds),
        ...storageQueries,
      ])

      const idsConPeriodo = new Set((periRes.data || []).map(p => p.empresa_id))

      // Mapa empresa_id → diagnostico_profundo
      const dpMap = {}
      for (const dp of dpRes.data || []) { dpMap[dp.empresa_id] = dp }

      const empresasEnriquecidas = (emps || []).map((e, idx) => {
        const storageFiles = storageResults[idx]?.data || []
        const tieneBalance = storageFiles.length > 0 || !!e.balance_subido_por_cliente
        const dp = dpMap[e.id]
        const tieneEncuesta = !!(dp?.dimension5 && Object.keys(dp.dimension5 || {}).length > 0)
          || !!e.encuesta_completada
        return {
          ...e,
          scoring_sgr: [],
          tiene_periodos: idsConPeriodo.has(e.id),
          tiene_cfo:      (e.etapa_numero || 1) >= 3,
          _tieneBalance:  tieneBalance,
          _tieneEncuesta: tieneEncuesta,
        }
      })

      console.log('[AsesorPage] empresasEnriquecidas final:', empresasEnriquecidas.length)
      setEmpresas(empresasEnriquecidas)
      setAlertas(altRes.data || [])
      setMensajesSin(msgRes.count || 0)
    } catch (err) {
      console.error('[AsesorPage] cargar() ERROR:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile?.id) cargar()
  }, [profile?.id])

  // ── Suscripciones real-time para actividad del cliente ──────────
  useEffect(() => {
    if (!profile?.id) return

    // Cargar notificaciones pendientes al montar
    async function cargarNotificaciones() {
      const { data: asig } = await supabase
        .from('asignaciones').select('empresa_id').eq('asesor_id', profile.id)
      const ids = (asig || []).map(a => a.empresa_id)
      if (!ids.length) return

      // Empresas con actividad pendiente del cliente
      const { data: emps } = await supabase
        .from('empresas')
        .select('id, nombre, balance_subido_por_cliente, encuesta_completada, etapa_diagnostico')
        .in('id', ids)
      const nuevas = []
      for (const e of emps || []) {
        if (e.balance_subido_por_cliente && (e.etapa_diagnostico || 1) <= 2)
          nuevas.push({ id: `bal-${e.id}`, tipo: 'balance',   empresa: e.nombre, msg: 'subió su balance', empresaId: e.id })
        if (e.encuesta_completada && (e.etapa_diagnostico || 1) <= 2)
          nuevas.push({ id: `enc-${e.id}`, tipo: 'encuesta',  empresa: e.nombre, msg: 'completó la encuesta', empresaId: e.id })
      }

      // Mensajes no leídos de clientes
      const { data: msgs } = await supabase
        .from('mensajes').select('id, empresa_id, created_at, empresas(nombre)')
        .in('empresa_id', ids)
        .eq('remitente_rol', 'cliente').eq('leido', false)
        .order('created_at', { ascending: false }).limit(5)
      const msgGroups = {}
      for (const m of msgs || []) {
        if (!msgGroups[m.empresa_id]) {
          msgGroups[m.empresa_id] = {
            id: `msg-${m.empresa_id}`, tipo: 'mensaje',
            empresa: m.empresas?.nombre, msg: 'te envió un mensaje', empresaId: m.empresa_id,
          }
        }
      }
      setNotificaciones([...nuevas, ...Object.values(msgGroups)])
    }

    cargarNotificaciones()

    // Real-time: cambios en empresas (cliente subió balance o encuesta)
    const chanEmp = supabase.channel('asesor-empresas')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'empresas' },
        payload => {
          const e = payload.new
          if (e.balance_subido_por_cliente || e.encuesta_completada) {
            cargar()
            cargarNotificaciones()
          }
        })
      .subscribe()

    // Real-time: nuevos mensajes de clientes
    const chanMsg = supabase.channel('asesor-mensajes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes',
          filter: 'remitente_rol=eq.cliente' },
        () => { cargarNotificaciones(); cargar() })
      .subscribe()

    return () => {
      supabase.removeChannel(chanEmp)
      supabase.removeChannel(chanMsg)
    }
  }, [profile?.id])

  function handleAcceder(empresa) {
    localStorage.setItem('impersonating_empresa_id', empresa.id)
    navigate('/dashboard')
  }

  function handleEmpresaCreada(nueva) {
    setModalNueva(false)
    cargar()
  }

  // Filtros
  const empresasFiltradas = empresas.filter(e => {
    const matchBusq = e.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                      (e.cuit || '').includes(busqueda)
    const matchEtapa = filtroEtapa === 'todas' || String(e.etapa_numero) === filtroEtapa
    return matchBusq && matchEtapa
  })

  // Stats
  const stats = {
    total:       empresas.length,
    cfoActivo:   empresas.filter(e => e.etapa_numero >= 3).length,
    diagnostico: empresas.filter(e => e.etapa_numero === 2).length,
    mercado:     empresas.filter(e => e.etapa_numero >= 4).length,
    alertasOpen: alertas.length,
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="Panel de asesor"
        subtitle={`${stats.total} empresa${stats.total !== 1 ? 's' : ''} asignada${stats.total !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            {notificaciones.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                <Bell size={13} className="animate-pulse" />
                {notificaciones.length} actividad{notificaciones.length !== 1 ? 'es' : ''} del cliente
              </div>
            )}
            <button onClick={() => setModalNueva(true)} className="btn-primary text-sm flex items-center gap-1.5">
              <Plus size={15} /> Nueva empresa
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 animate-slide-up">
        <div className="max-w-6xl mx-auto space-y-5">

          {/* ── Stats ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-nexxo-topoXl border border-nexxo-topoXl">
            {[
              { label: 'Total empresas',   value: stats.total       },
              { label: 'CFO activo',       value: stats.cfoActivo   },
              { label: 'En diagnóstico',   value: stats.diagnostico },
              { label: 'En mercado',       value: stats.mercado     },
              { label: 'Alertas abiertas', value: stats.alertasOpen },
            ].map(s => (
              <div key={s.label} className="bg-nexxo-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-nexxo-topo mb-2">{s.label}</p>
                <p className="font-serif text-3xl font-semibold text-nexxo-black">{s.value}</p>
              </div>
            ))}
          </div>

          {/* ── Notificaciones de actividad del cliente ─────────── */}
          {notificaciones.length > 0 && (
            <div className="space-y-2">
              {notificaciones.map(n => (
                <div key={n.id}
                  className="bg-nexxo-black border-l-4 border-l-nexxo-topo p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-nexxo-white">
                      {n.empresa}
                    </p>
                    <p className="text-xs text-nexxo-topo mt-0.5 capitalize">{n.msg}</p>
                  </div>
                  <button
                    onClick={() => {
                      const emp = empresas.find(e => e.id === n.empresaId)
                      if (emp) { handleAcceder(emp); navigate(n.tipo === 'mensaje' ? '/mensajes' : n.tipo === 'balance' ? '/balance' : '/diagnostico-profundo') }
                    }}
                    className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-nexxo-topo
                               border border-nexxo-topo px-3 py-1.5 hover:bg-nexxo-topo hover:text-nexxo-black transition-colors"
                  >
                    Ver →
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Acciones requeridas ──────────────────────────────── */}
          <AccionesRequeridas
            empresas={empresas}
            onActivar={(emp, ruta) => { handleAcceder(emp); navigate(ruta) }}
            onVerInfo={e => setModalInfoEmpresa(e)}
          />

          {/* ── Tabla de empresas ───────────────────────────────── */}
          <div className="bg-nexxo-white shadow-nexxo-sm border border-nexxo-topoXl">
            {/* Filtros */}
            <div className="px-5 py-3.5 border-b border-nexxo-light flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-nexxo-topo flex-1">
                Empresas asignadas
              </p>
              <input
                type="text"
                placeholder="Buscar empresa o CUIT..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="bg-nexxo-white border border-nexxo-light text-sm font-medium text-nexxo-black
                           px-3 py-1.5 rounded-sm outline-none focus:border-nexxo-topo focus:ring-1 focus:ring-nexxo-topo
                           hover:border-nexxo-topo transition-colors w-full sm:w-48"
              />
              <select
                value={filtroEtapa}
                onChange={e => setFiltroEtapa(e.target.value)}
                className="bg-nexxo-white border border-nexxo-light text-sm font-medium text-nexxo-black
                           px-3 py-1.5 rounded-sm outline-none focus:border-nexxo-topo focus:ring-1 focus:ring-nexxo-topo
                           hover:border-nexxo-topo transition-colors w-full sm:w-40"
              >
                <option value="todas">Todas las etapas</option>
                {Object.entries(ETAPA_MAP).map(([v, { label }]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <p className="text-sm text-nexxo-gray text-center py-10">Cargando empresas...</p>
            ) : empresasFiltradas.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-nexxo-gray">
                  {empresas.length === 0
                    ? 'Sin empresas asignadas aún.'
                    : 'Ninguna empresa coincide con el filtro.'}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-nexxo-black">
                        {['Empresa', 'Estado cliente', 'Score SGR', 'Plan', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-nexxo-topo">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {empresasFiltradas.map((e, idx) => (
                        <EmpresaRow key={e.id} empresa={e} idx={idx}
                          onAcceder={handleAcceder}
                          onRecargar={cargar}
                          onVerInfo={e => setModalInfoEmpresa(e)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Mobile Cards */}
                <div className="md:hidden flex flex-col divide-y divide-nexxo-light">
                  {empresasFiltradas.map(e => (
                    <EmpresaCard key={e.id} empresa={e}
                      onAcceder={handleAcceder}
                      onRecargar={cargar}
                      onVerInfo={e => setModalInfoEmpresa(e)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Alertas ─────────────────────────────────────────── */}
          {alertas.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-navy-800 mb-3 flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-500" />
                Alertas recientes
              </h2>
              <div className="divide-y divide-slate-50">
                {alertas.map(a => <AlertaCard key={a.id} alerta={a} />)}
              </div>
            </div>
          )}

        </div>
      </div>

      {modalNueva && (
        <ModalNuevaEmpresa
          onCreada={handleEmpresaCreada}
          onCerrar={() => setModalNueva(false)}
          asesorId={profile?.id}
          asesorNombre={profile?.nombre}
        />
      )}

      {modalInfoEmpresa && (
        <InfoClienteModal
          empresa={modalInfoEmpresa}
          onCerrar={() => setModalInfoEmpresa(null)}
        />
      )}
    </div>
  )
}
