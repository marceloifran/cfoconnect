// SETUP: Crear bucket en Supabase Storage → Storage → New bucket
// nombre: "balances-cliente" → Public: false
// SQL a ejecutar antes de usar este módulo:
// ALTER TABLE empresas ADD COLUMN IF NOT EXISTS etapa_diagnostico integer DEFAULT 1;
// ALTER TABLE empresas ADD COLUMN IF NOT EXISTS balance_subido_por_cliente boolean DEFAULT false;
// ALTER TABLE empresas ADD COLUMN IF NOT EXISTS encuesta_completada boolean DEFAULT false;
// ALTER TABLE empresas ADD COLUMN IF NOT EXISTS informe_publicado boolean DEFAULT false;
// ALTER TABLE empresas ADD COLUMN IF NOT EXISTS informe_publicado_at timestamptz;

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import PageHeader from '@/components/shared/PageHeader'
import { CheckCircle, Upload, ChevronRight, AlertTriangle } from 'lucide-react'

// Usa supabaseAdmin (service key) para bypass RLS en storage.
// Fallback al cliente anon si no está configurado.
const storageClient = supabaseAdmin || supabase

// ── Opciones de las preguntas ────────────────────────────────────────
const FINANCIAMIENTO_OPS = ['Con lo que cobro', 'Con crédito bancario', 'Con tarjeta', 'Con ahorros propios', 'Me cuesta llegar']
const CERTEZA_OPS        = ['Sí, tengo certeza', 'Más o menos', 'No tengo idea']
const MERCADO_OPS        = ['Nunca escuché', 'Escuché pero no entiendo', 'Conozco el tema', 'Ya lo hice']
const EXPECTATIVA_OPS    = ['Ordenar mis finanzas', 'Acceder a financiamiento', 'Bajar el costo financiero', 'Entender mis números', 'Acompañamiento estratégico']

const EMPTY_ENC = {
  problema:         '',
  perdio_oport:     false,
  desc_oport:       '',
  financiamiento:   [],
  certeza_cobro:    '',
  objetivo:         '',
  conoce_mercado:   '',
  expectativa:      [],
  comentario:       '',
}

// ── UI Atoms ─────────────────────────────────────────────────────────
function SiNo({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map(({ v, l }) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)}
          className={`px-5 py-1.5 rounded-lg text-sm font-medium border transition-colors
            ${value === v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
          {l}
        </button>
      ))}
    </div>
  )
}

function MultiToggle({ options, value = [], onChange }) {
  const toggle = item => onChange(value.includes(item) ? value.filter(x => x !== item) : [...value, item])
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors
            ${value.includes(opt) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
          {opt}
        </button>
      ))}
    </div>
  )
}

function Opcion({ options, value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={`text-left px-4 py-2.5 rounded-lg text-sm border transition-colors
            ${value === opt ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
          {opt}
        </button>
      ))}
    </div>
  )
}

function Pregunta({ numero, texto, children }) {
  return (
    <div className="mb-6 pb-6 border-b border-slate-100 last:border-0 last:pb-0 last:mb-0">
      <p className="text-sm font-medium text-navy-800 mb-3">
        <span className="inline-flex w-6 h-6 rounded-full bg-brand-600 text-white text-xs items-center justify-center font-bold mr-2 flex-shrink-0">
          {numero}
        </span>
        {texto}
      </p>
      {children}
    </div>
  )
}

// ── Paso A — Subir balance ────────────────────────────────────────────
function PasoBalance({ empresa, onCompletado }) {
  const [subiendo,  setSubiendo]  = useState(false)
  const [error,     setError]     = useState(null)
  const [arrastrar, setArrastrar] = useState(false)
  const fileRef = useRef(null)

  async function subirArchivo(file) {
    if (!file || file.type !== 'application/pdf') {
      setError('Solo se aceptan archivos PDF.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('El archivo no puede superar los 20 MB.')
      return
    }
    setSubiendo(true); setError(null)
    try {
      const { error: upErr } = await storageClient.storage
        .from('balances-cliente')
        .upload(`${empresa.id}/balance.pdf`, file, { upsert: true })
      if (upErr) {
        console.error('[Upload] Error completo:', upErr)
        throw new Error(upErr.message || JSON.stringify(upErr))
      }

      // Marcar hito en localStorage ANTES del update de DB
      // (garantiza persistencia incluso si el update falla)
      marcarHito(empresa.id, 'balance')

      const { error: dbErr } = await supabase.from('empresas')
        .update({ balance_subido_por_cliente: true, etapa_diagnostico: 2 })
        .eq('id', empresa.id)
      if (dbErr) console.warn('[Upload] DB update error (hito guardado en local):', dbErr.message)

      // Notificar al asesor en segundo plano
      notificarAsesor(empresa.id, empresa.nombre,
        `📥 ${empresa.nombre} subió su balance. Revisalo y completá el análisis.`
      ).catch(e => console.warn('[Upload] notificarAsesor:', e))

      onCompletado()
    } catch (e) {
      setError('No se pudo subir el archivo. Intentá de nuevo.')
      console.error('[DiagnosticoPage] upload:', e)
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-navy-800 mb-1">Subí el balance de tu empresa</h2>
      <p className="text-sm text-slate-500 mb-6 leading-relaxed">
        Es el documento que prepara tu contador cada año. Si no lo tenés a mano, pedíselo —
        es el balance o los estados contables.
      </p>

      <div
        onDragOver={e => { e.preventDefault(); setArrastrar(true) }}
        onDragLeave={() => setArrastrar(false)}
        onDrop={e => { e.preventDefault(); setArrastrar(false); subirArchivo(e.dataTransfer.files[0]) }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
          ${arrastrar ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/50'}`}
      >
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => subirArchivo(e.target.files[0])} />
        {subiendo ? (
          <>
            <svg className="animate-spin w-8 h-8 text-brand-600 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm font-medium text-brand-700">Subiendo tu balance...</p>
          </>
        ) : (
          <>
            <Upload size={36} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-navy-700 mb-1">Arrastrá el PDF acá o hacé click para buscarlo</p>
            <p className="text-xs text-slate-400">Solo PDF · máximo 20 MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center mt-4">
        Tu información es confidencial y solo la ve tu asesor.
      </p>
    </div>
  )
}

// ── Paso B — Encuesta ────────────────────────────────────────────────
function PasoEncuesta({ empresa, onCompletado }) {
  const [enc,     setEnc]     = useState(EMPTY_ENC)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  function set(k, v) { setEnc(prev => ({ ...prev, [k]: v })) }

  async function handleEnviar() {
    if (!enc.problema.trim())    { setError('Por favor respondé la pregunta 1.'); return }
    if (!enc.certeza_cobro)      { setError('Por favor respondé la pregunta 4.'); return }
    if (!enc.objetivo.trim())    { setError('Por favor respondé la pregunta 5.'); return }
    if (!enc.conoce_mercado)     { setError('Por favor respondé la pregunta 6.'); return }
    if (!enc.expectativa.length) { setError('Por favor respondé la pregunta 7.'); return }

    setSaving(true); setError(null)
    try {
      // Cargar d5 existente para merge inteligente
      const { data: dp } = await supabase.from('diagnostico_profundo')
        .select('dimension5').eq('empresa_id', empresa.id).maybeSingle()
      const d5base = dp?.dimension5 || {}

      const d5nuevo = {
        ...d5base,
        problema_financiero:    enc.problema,
        perdio_oportunidad:     enc.perdio_oport,
        descripcion_oportunidad: enc.desc_oport,
        financiamiento_dia_dia:  enc.financiamiento,
        certeza_cobro:           enc.certeza_cobro,
        objetivo_12meses:        enc.objetivo,
        conoce_mercado_capitales: enc.conoce_mercado,
        expectativa_cfoconnect:  enc.expectativa,
        comentario_libre:        enc.comentario,
      }

      await supabase.from('diagnostico_profundo').upsert({
        empresa_id: empresa.id,
        estado:     'borrador',
        dimension5: d5nuevo,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'empresa_id' })

      // Marcar hito en localStorage ANTES del update de DB
      marcarHito(empresa.id, 'balance')   // asegurar que balance también quede
      marcarHito(empresa.id, 'encuesta')

      const { error: dbErr2 } = await supabase.from('empresas')
        .update({ encuesta_completada: true, etapa_diagnostico: 3 })
        .eq('id', empresa.id)
      if (dbErr2) console.warn('[Encuesta] DB update error (hito guardado en local):', dbErr2.message)

      // Notificar al asesor en segundo plano
      notificarAsesor(empresa.id, empresa.nombre,
        `✍ ${empresa.nombre} completó la encuesta. Toda la información está lista para el diagnóstico.`
      ).catch(e => console.warn('[Encuesta] notificarAsesor:', e))

      onCompletado()
    } catch (e) {
      setError('No se pudo guardar. Intentá de nuevo.')
      console.error('[DiagnosticoPage] encuesta:', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-navy-800 mb-1">Contanos sobre tu empresa</h2>
      <p className="text-sm text-slate-500 mb-6">8 preguntas simples — menos de 5 minutos</p>

      <div className="space-y-0">
        <Pregunta numero={1} texto="¿Cuál es el mayor problema financiero que tiene tu empresa hoy?">
          <textarea rows={3} value={enc.problema} onChange={e => set('problema', e.target.value)}
            className="input resize-none" placeholder="Ej: me cuesta cobrar a tiempo, necesito financiamiento para crecer..." />
        </Pregunta>

        <Pregunta numero={2} texto="¿Hubo algo que quisiste hacer pero no pudiste por falta de financiamiento?">
          <SiNo value={enc.perdio_oport} onChange={v => set('perdio_oport', v)} />
          {enc.perdio_oport && (
            <textarea rows={2} value={enc.desc_oport} onChange={e => set('desc_oport', e.target.value)}
              className="input resize-none mt-3" placeholder="Contanos qué pasó..." />
          )}
        </Pregunta>

        <Pregunta numero={3} texto="¿Cómo financiás el día a día de tu empresa?">
          <MultiToggle options={FINANCIAMIENTO_OPS} value={enc.financiamiento} onChange={v => set('financiamiento', v)} />
        </Pregunta>

        <Pregunta numero={4} texto="¿Sabés cuánto dinero va a entrar el mes que viene?">
          <Opcion options={CERTEZA_OPS} value={enc.certeza_cobro} onChange={v => set('certeza_cobro', v)} />
        </Pregunta>

        <Pregunta numero={5} texto="¿Qué querés lograr en los próximos 12 meses?">
          <textarea rows={2} value={enc.objetivo} onChange={e => set('objetivo', e.target.value)}
            className="input resize-none" placeholder="Ej: reducir la deuda, abrir una sucursal, profesionalizar la empresa..." />
        </Pregunta>

        <Pregunta numero={6} texto="¿Alguna vez escuchaste hablar de descontar cheques o facturas en el mercado de capitales?">
          <Opcion options={MERCADO_OPS} value={enc.conoce_mercado} onChange={v => set('conoce_mercado', v)} />
        </Pregunta>

        <Pregunta numero={7} texto="¿Qué esperás de este servicio? (podés elegir varias)">
          <MultiToggle options={EXPECTATIVA_OPS} value={enc.expectativa} onChange={v => set('expectativa', v)} />
        </Pregunta>

        <Pregunta numero={8} texto="¿Hay algo más que quieras contarnos?">
          <textarea rows={2} value={enc.comentario} onChange={e => set('comentario', e.target.value)}
            className="input resize-none" placeholder="Opcional — cualquier cosa que quieras agregar..." />
        </Pregunta>
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button onClick={handleEnviar} disabled={saving}
        className="btn-primary w-full justify-center mt-6 py-3 disabled:opacity-60">
        {saving ? 'Enviando...' : 'Enviar mis respuestas →'}
      </button>
    </div>
  )
}

// ── Pantalla de confirmación ──────────────────────────────────────────
function Confirmacion() {
  return (
    <div className="text-center py-6">
      <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={32} className="text-brand-600" />
      </div>
      <h2 className="text-xl font-bold text-navy-800 mb-2">¡Listo!</h2>
      <p className="text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
        Tu asesor ya tiene toda la información y está preparando tu diagnóstico.
        Te avisaremos cuando esté listo.
      </p>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────
// ── Helpers de persistencia de hitos ──────────────────────────────
function lsKey(empId, hito) { return `nx_hito_${empId}_${hito}` }
function marcarHito(empId, hito) { localStorage.setItem(lsKey(empId, hito), '1') }
function tieneHito(empId, hito)  { return localStorage.getItem(lsKey(empId, hito)) === '1' }

// ── Notificar al asesor (alerta + mensaje automático) ─────────────
async function notificarAsesor(empresaId, empresaNombre, mensaje) {
  // 1. Alerta persistente visible en el panel del asesor
  const alertaPayload = {
    empresa_id: empresaId,
    tipo:       'general',
    nivel:      'alto',
    mensaje,
    leida:      false,
  }
  // Intentar con campo origen, fallback sin él
  const { error: e1 } = await supabase.from('alertas')
    .insert({ ...alertaPayload, origen: 'cliente_automatico' })
  if (e1) {
    await supabase.from('alertas').insert(alertaPayload)
  }

  // 2. Mensaje automático en el chat (aparece en la sección Mensajes del asesor)
  await supabase.from('mensajes').insert({
    empresa_id:    empresaId,
    remitente_id:  (await supabase.auth.getUser()).data.user?.id,
    remitente_rol: 'cliente',
    contenido:     mensaje,
    leido:         false,
  })
}

export default function DiagnosticoPage() {
  const { empresa } = useAuth()
  const [paso,    setPaso]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!empresa?.id) return
    const id = empresa.id

    async function cargarEstado() {
      try {
        const { data, error } = await supabase.from('empresas')
          .select('balance_subido_por_cliente, encuesta_completada, etapa_diagnostico')
          .eq('id', id)
          .single()

        if (error) console.warn('[DiagnosticoPage] error al leer estado:', error.message)

        // DB es la fuente principal, localStorage es fallback
        const balanceDb  = data?.balance_subido_por_cliente  ?? false
        const encuestaDb = data?.encuesta_completada         ?? false
        const etapaDb    = data?.etapa_diagnostico           ?? 1

        // Combinar DB + localStorage: usar el estado más avanzado
        const balanceOk  = balanceDb  || tieneHito(id, 'balance')
        const encuestaOk = encuestaDb || tieneHito(id, 'encuesta')
        const etapaOk    = etapaDb >= 3 || tieneHito(id, 'encuesta')

        if (encuestaOk || etapaOk) {
          setPaso('listo')
        } else if (balanceOk) {
          setPaso('encuesta')
        } else {
          setPaso('balance')
        }
      } catch (e) {
        console.error('[DiagnosticoPage] cargarEstado excepción:', e)
        // Fallback total a localStorage
        const balanceLocal  = tieneHito(id, 'balance')
        const encuestaLocal = tieneHito(id, 'encuesta')
        if (encuestaLocal) setPaso('listo')
        else if (balanceLocal) setPaso('encuesta')
        else setPaso('balance')
      } finally {
        setLoading(false)
      }
    }

    cargarEstado()
  }, [empresa?.id])

  if (loading || !empresa) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-slate-400">Cargando...</p>
    </div>
  )

  // Indicadores de progreso (2 pasos)
  const steps = [
    { id: 'balance',  label: 'Tu balance'  },
    { id: 'encuesta', label: 'Tu situación' },
  ]
  const stepIdx = paso === 'balance' ? 0 : paso === 'encuesta' ? 1 : 2

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader title="Mi perfil financiero" subtitle={empresa?.nombre} />
      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="max-w-xl mx-auto">

          {/* Progress (solo si no completado) */}
          {paso !== 'listo' && (
            <div className="flex items-center gap-2 mb-8">
              {steps.map((s, i) => {
                const done   = i < stepIdx
                const active = i === stepIdx
                return (
                  <div key={s.id} className="flex items-center gap-2 flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                      ${done ? 'bg-brand-600 text-white' : active ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'bg-slate-100 text-slate-400'}`}>
                      {done ? <CheckCircle size={14} /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium ${active ? 'text-brand-700' : done ? 'text-brand-600' : 'text-slate-400'}`}>
                      {s.label}
                    </span>
                    {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${done ? 'bg-brand-400' : 'bg-slate-200'}`} />}
                  </div>
                )
              })}
            </div>
          )}

          <div className="card p-6">
            {paso === 'balance' && (
              <PasoBalance empresa={empresa} onCompletado={() => { setPaso('encuesta'); setLoading(false) }} />
            )}
            {paso === 'encuesta' && (
              <>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-brand-50 border border-brand-200 mb-5">
                  <CheckCircle size={14} className="text-brand-500 flex-shrink-0" />
                  <p className="text-sm text-brand-800 font-medium">¡Balance recibido! Tu asesor ya puede verlo.</p>
                </div>
                <PasoEncuesta empresa={empresa} onCompletado={() => setPaso('listo')} />
              </>
            )}
            {paso === 'listo' && <Confirmacion />}
          </div>

        </div>
      </div>
    </div>
  )
}
