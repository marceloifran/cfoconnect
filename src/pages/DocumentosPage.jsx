import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'
import PageHeader from '@/components/shared/PageHeader'
import {
  Upload, Download, Trash2, FileText, AlertTriangle, CheckCircle,
  FileUp, ClipboardCheck, FolderOpen,
} from 'lucide-react'

const _svcKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY
const _url    = import.meta.env.VITE_SUPABASE_URL
const adminDb = supabaseAdmin
  || (_svcKey ? createClient(_url, _svcKey, { auth: { persistSession: false } }) : null)
  || supabase

const TIPOS = [
  { v: 'informe_diagnostico', l: 'Informe diagnóstico' },
  { v: 'balance_analizado',   l: 'Balance analizado'   },
  { v: 'recomendacion',       l: 'Recomendación'       },
  { v: 'propuesta',           l: 'Propuesta'           },
  { v: 'contrato',            l: 'Contrato'            },
  { v: 'alerta',              l: 'Alerta'              },
  { v: 'otro',                l: 'Otro'                },
]

const TIPO_BADGE = {
  informe_diagnostico: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  balance_analizado:   'bg-sky-50 text-sky-700 border border-sky-200',
  recomendacion:       'bg-green-50 text-green-700 border border-green-200',
  propuesta:           'bg-purple-50 text-purple-700 border border-purple-200',
  contrato:            'bg-amber-50 text-amber-700 border border-amber-200',
  alerta:              'bg-red-50 text-red-700 border border-red-200',
  otro:                'bg-stone-50 text-stone-600 border border-stone-200',
}

function esNuevo(fecha) {
  return (Date.now() - new Date(fecha).getTime()) < 7 * 24 * 60 * 60 * 1000
}

function NxSectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-nexxo-topo whitespace-nowrap">{children}</p>
      <div className="flex-1 h-px bg-nexxo-light" />
    </div>
  )
}

function StatusChip({ ok, label, pendingLabel }) {
  if (ok) return (
    <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-green-700
                     bg-green-50 border border-green-200 px-3 py-1.5" style={{ borderRadius: 2 }}>
      ✓ {label}
    </span>
  )
  return (
    <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-nexxo-topoLt
                     border border-nexxo-topoXl px-3 py-1.5" style={{ borderRadius: 2 }}>
      {pendingLabel}
    </span>
  )
}

export default function DocumentosPage() {
  const { empresa, isAsesor, profile } = useAuth()

  const [docs,          setDocs]          = useState([])
  const [docsLoading,   setDocsLoading]   = useState(true)
  const [balanceUrl,    setBalanceUrl]    = useState(null)
  const [balanceNombre, setBalanceNombre] = useState(null)
  const [balanceLoading, setBalanceLoading] = useState(true)

  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState(null)
  const [ok,        setOk]        = useState(null)
  const [form, setForm] = useState({ titulo: '', descripcion: '', tipo: 'informe_diagnostico' })
  const fileRef = useRef(null)

  async function cargarDocs() {
    if (!empresa?.id) return
    const { data } = await supabase.from('documentos').select('*')
      .eq('empresa_id', empresa.id).order('created_at', { ascending: false })
    setDocs(data || [])
    setDocsLoading(false)
  }

  async function cargarBalance() {
    if (!empresa?.id) { setBalanceLoading(false); return }
    try {
      const { data: files } = await adminDb.storage
        .from('balances-cliente')
        .list(String(empresa.id), { limit: 10 })

      if (files && files.length > 0) {
        const archivo = files.find(f => /\.(pdf|PDF)$/.test(f.name)) || files[0]
        const { data: signed } = await adminDb.storage
          .from('balances-cliente')
          .createSignedUrl(`${empresa.id}/${archivo.name}`, 3600)
        if (signed?.signedUrl) {
          setBalanceUrl(signed.signedUrl)
          setBalanceNombre(archivo.name)
        }
      }
    } catch (e) {
      console.warn('[DocumentosPage] cargarBalance error:', e)
    } finally {
      setBalanceLoading(false)
    }
  }

  useEffect(() => {
    if (empresa?.id) {
      cargarDocs()
      cargarBalance()
    }
  }, [empresa?.id])

  async function handleSubir(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!form.titulo) { setError('Ingresá un título para el documento.'); return }
    setUploading(true); setError(null); setOk(null)
    try {
      const path = `${empresa.id}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('documentos').upload(path, file)
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)

      const { error: dbErr } = await supabase.from('documentos').insert({
        empresa_id:     empresa.id,
        titulo:         form.titulo,
        descripcion:    form.descripcion,
        tipo:           form.tipo,
        url_archivo:    urlData.publicUrl,
        path_archivo:   path,
        nombre_archivo: file.name,
        subido_por:     profile?.id,
      })
      if (dbErr) throw dbErr

      setOk('Documento subido correctamente.')
      setForm({ titulo: '', descripcion: '', tipo: 'informe_diagnostico' })
      if (fileRef.current) fileRef.current.value = ''
      cargarDocs()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleEliminar(doc) {
    if (!confirm(`¿Eliminar "${doc.titulo}"?`)) return
    if (doc.path_archivo) {
      await supabase.storage.from('documentos').remove([doc.path_archivo])
    }
    await supabase.from('documentos').delete().eq('id', doc.id)
    cargarDocs()
  }

  async function handleDescargar(doc) {
    if (doc.path_archivo) {
      const { data } = await supabase.storage.from('documentos')
        .createSignedUrl(doc.path_archivo, 3600)
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    } else if (doc.url_archivo) {
      window.open(doc.url_archivo, '_blank')
    }
  }

  if (!empresa) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-nexxo-gray">Sin empresa seleccionada.</p>
    </div>
  )

  const encuestaOk = !!empresa.encuesta_completada
  const totalItems = (balanceUrl ? 1 : 0) + (encuestaOk ? 1 : 0) + docs.length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="Documentos"
        subtitle={empresa.nombre}
        actions={
          <span className="text-[10px] font-bold uppercase tracking-wider text-nexxo-topo">
            {totalItems} elemento{totalItems !== 1 ? 's' : ''}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 animate-slide-up">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* ── Documentación del cliente ─────────────────────── */}
          <div>
            <NxSectionLabel>Documentación enviada por el cliente</NxSectionLabel>
            <div className="bg-nexxo-white border border-nexxo-topoXl divide-y divide-nexxo-light">

              {/* Balance PDF */}
              <div className="px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-nexxo-black flex items-center justify-center flex-shrink-0"
                  style={{ borderRadius: 2 }}>
                  <FileUp size={17} className="text-nexxo-topo" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-nexxo-black">Balance contable</p>
                  <p className="text-[10px] text-nexxo-gray mt-0.5">
                    {balanceLoading
                      ? 'Verificando...'
                      : balanceUrl
                        ? balanceNombre
                        : 'El cliente aún no subió su balance'}
                  </p>
                </div>
                {!balanceLoading && (
                  balanceUrl ? (
                    <a href={balanceUrl} target="_blank" rel="noreferrer"
                      className="flex-shrink-0 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider
                                 text-nexxo-black border border-nexxo-black px-3 py-1.5
                                 hover:bg-nexxo-light transition-colors"
                      style={{ borderRadius: 2 }}>
                      <Download size={11} /> Descargar
                    </a>
                  ) : (
                    <StatusChip ok={false} pendingLabel="Pendiente" />
                  )
                )}
              </div>

              {/* Encuesta */}
              <div className="px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-nexxo-black flex items-center justify-center flex-shrink-0"
                  style={{ borderRadius: 2 }}>
                  <ClipboardCheck size={17} className="text-nexxo-topo" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-nexxo-black">Encuesta de diagnóstico</p>
                  <p className="text-[10px] text-nexxo-gray mt-0.5">
                    {encuestaOk ? 'Encuesta completada por el cliente' : 'Pendiente de completar'}
                  </p>
                </div>
                <StatusChip ok={encuestaOk} label="Recibida" pendingLabel="Pendiente" />
              </div>

            </div>
          </div>

          {/* ── Expediente ────────────────────────────────────── */}
          <div>
            <NxSectionLabel>
              {isAsesor ? 'Expediente del asesor' : 'Documentos del asesor'}
            </NxSectionLabel>

            {/* Formulario upload — solo asesor */}
            {isAsesor && (
              <div className="bg-nexxo-white border border-nexxo-topoXl p-5 mb-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-nexxo-topo mb-4">Agregar archivo al expediente</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="col-span-2">
                    <label className="label">Título del documento</label>
                    <input type="text" value={form.titulo}
                      onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                      className="input" placeholder="Ej: Informe diagnóstico Q1 2025" />
                  </div>
                  <div>
                    <label className="label">Tipo</label>
                    <select value={form.tipo}
                      onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                      className="input">
                      {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Descripción <span className="text-slate-400">(opcional)</span></label>
                    <input type="text" value={form.descripcion}
                      onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                      className="input" placeholder="Breve descripción..." />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input ref={fileRef} type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"
                    className="hidden" onChange={handleSubir} />
                  <button onClick={() => fileRef.current?.click()}
                    disabled={uploading || !form.titulo}
                    className="btn-primary flex items-center gap-2 disabled:opacity-60">
                    {uploading ? (
                      <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg> Subiendo...</>
                    ) : (
                      <><Upload size={14} /> Seleccionar archivo</>
                    )}
                  </button>
                  {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12} />{error}</p>}
                  {ok    && <p className="text-xs text-green-700 flex items-center gap-1"><CheckCircle size={12} />{ok}</p>}
                </div>
              </div>
            )}

            {/* Lista */}
            <div className="bg-nexxo-white border border-nexxo-topoXl">
              {docsLoading ? (
                <p className="text-sm text-nexxo-gray text-center py-8">Cargando...</p>
              ) : docs.length === 0 ? (
                <div className="text-center py-10">
                  <FolderOpen size={28} className="text-nexxo-topoXl mx-auto mb-2" />
                  <p className="text-sm text-nexxo-gray">
                    {isAsesor ? 'Aún no hay archivos en el expediente.' : 'El asesor no ha subido documentos aún.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-nexxo-light">
                  {docs.map(doc => {
                    const tipo  = TIPOS.find(t => t.v === doc.tipo)
                    const nuevo = esNuevo(doc.created_at)
                    const badgeCls = TIPO_BADGE[doc.tipo] || TIPO_BADGE.otro
                    return (
                      <div key={doc.id}
                        className="px-5 py-4 flex items-start gap-4 hover:bg-nexxo-off transition-colors">
                        <div className="w-9 h-9 bg-nexxo-off border border-nexxo-light flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ borderRadius: 2 }}>
                          <FileText size={15} className="text-nexxo-topo" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-semibold text-nexxo-black">{doc.titulo}</p>
                            <span className={`${badgeCls} text-[9px] font-bold uppercase tracking-wider px-2 py-0.5`}
                              style={{ borderRadius: 2 }}>
                              {tipo?.l || doc.tipo}
                            </span>
                            {nuevo && (
                              <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5"
                                style={{ borderRadius: 2 }}>
                                Nuevo
                              </span>
                            )}
                          </div>
                          {doc.descripcion && (
                            <p className="text-xs text-nexxo-gray">{doc.descripcion}</p>
                          )}
                          <p className="text-[10px] text-nexxo-topoLt mt-0.5">
                            {new Date(doc.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {doc.nombre_archivo && ` · ${doc.nombre_archivo}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => handleDescargar(doc)} title="Descargar"
                            className="w-8 h-8 flex items-center justify-center text-nexxo-gray
                                       hover:text-nexxo-black hover:bg-nexxo-light transition-colors"
                            style={{ borderRadius: 2 }}>
                            <Download size={15} />
                          </button>
                          {isAsesor && (
                            <button onClick={() => handleEliminar(doc)} title="Eliminar"
                              className="w-8 h-8 flex items-center justify-center text-nexxo-gray
                                         hover:text-red-600 hover:bg-red-50 transition-colors"
                              style={{ borderRadius: 2 }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
