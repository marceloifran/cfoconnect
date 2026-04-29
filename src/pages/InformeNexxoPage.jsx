import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'
import PageHeader from '@/components/shared/PageHeader'
import { checkPrerequisitesInformeNexxo, generarInformeNexxo, guardarPDFEnStorage } from '@/lib/informeNexxo'
import { generarPDFInformeNexxo } from '@/lib/informeNexxoPDF'
import {
  CheckCircle, XCircle, Minus, RefreshCw, FileText,
  Send, EyeOff, Download, Loader2, ChevronDown, ChevronRight,
  AlertTriangle, Clock,
} from 'lucide-react'

// ── Componentes visuales compartidos (también usa MiInformePage) ────
import InformeSection      from '@/components/informe-nexxo/InformeSection'
import Narrativa           from '@/components/informe-nexxo/Narrativa'
import HallazgoCard        from '@/components/informe-nexxo/HallazgoCard'
import InstrumentoCard     from '@/components/informe-nexxo/InstrumentoCard'
import PlanTimeline        from '@/components/informe-nexxo/PlanTimeline'
import GlosarioAcordeon    from '@/components/informe-nexxo/GlosarioAcordeon'
import PuntosVerificarCard from '@/components/informe-nexxo/PuntosVerificarCard'
import SidebarNav, { SECCIONES_BASE } from '@/components/informe-nexxo/SidebarNav'

// ── Cliente admin para bypasear RLS en lecturas ─────────────────────
const _svcKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY
const _url    = import.meta.env.VITE_SUPABASE_URL
const adminDb = supabaseAdmin
  || (_svcKey ? createClient(_url, _svcKey, { auth: { persistSession: false } }) : null)
  || supabase

// ── Pasos animados en VISTA B ───────────────────────────────────────
const STEPS_GENERACION = [
  'Recolectando datos del balance',
  'Procesando alma de la empresa',
  'Redactando análisis financiero',
  'Generando plan de acción',
  'Compilando glosario y cierre',
]

// SECCIONES_NAV importado como SECCIONES_BASE desde SidebarNav
const SECCIONES_NAV = SECCIONES_BASE

// ════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES (asesor-específicos — los visuales vienen del import)
// ════════════════════════════════════════════════════════════════════

// ── Check item individual ───────────────────────────────────────────
function CheckItem({ label, ok, loading }) {
  if (loading) return (
    <div className="flex items-center gap-3 py-2.5">
      <Minus size={16} style={{ color: 'var(--nx-topo-xl)' }} />
      <span style={{ fontSize: 13, color: 'var(--nx-topo)' }}>{label}</span>
    </div>
  )
  return (
    <div className="flex items-center gap-3 py-2.5"
      style={{ borderBottom: '1px solid var(--nx-line)' }}>
      {ok
        ? <CheckCircle size={16} style={{ color: 'var(--nx-green)', flexShrink: 0 }} />
        : <XCircle    size={16} style={{ color: 'var(--nx-red)',   flexShrink: 0 }} />}
      <span style={{
        fontSize: 13,
        color: ok ? 'var(--nx-black)' : 'var(--nx-gray)',
        fontWeight: ok ? 500 : 400,
      }}>
        {label}
      </span>
    </div>
  )
}

// ── Lista de prerequisitos ──────────────────────────────────────────
function PrerequisiteCheckList({ checks, loading }) {
  const ITEMS = [
    { key: 'balance',              label: 'Balance subido y analizado'         },
    { key: 'cuestionario_cliente', label: 'Encuesta del cliente completada'    },
    { key: 'alma_empresa',         label: 'Alma de la empresa (5 dimensiones)' },
    { key: 'mapa_capital',         label: 'Mapa de capital (scoring SGR)'      },
  ]
  return (
    <div>
      {ITEMS.map(item => (
        <CheckItem
          key={item.key}
          label={item.label}
          ok={checks?.[item.key] ?? false}
          loading={loading}
        />
      ))}
    </div>
  )
}

// ── Pasos de generación animados ────────────────────────────────────
function LoadingSteps({ step }) {
  return (
    <div className="space-y-3 mt-4">
      {STEPS_GENERACION.map((s, i) => {
        const done    = i < step
        const current = i === step
        const pending = i > step
        return (
          <div key={i} className="flex items-center gap-3">
            {done && <CheckCircle size={16} style={{ color: 'var(--nx-green)', flexShrink: 0 }} />}
            {current && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--nx-amber)', flexShrink: 0 }} />}
            {pending && <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid var(--nx-topo-xl)', flexShrink: 0 }} />}
            <span style={{
              fontSize: 13,
              color: done ? 'var(--nx-gray)' : current ? 'var(--nx-black)' : 'var(--nx-topo-xl)',
              fontWeight: current ? 600 : 400,
            }}>
              {s}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Modal de confirmación ───────────────────────────────────────────
function ModalConfirm({ titulo, mensaje, onConfirmar, onCancelar, confirmarLabel = 'Confirmar', danger }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancelar} />
      <div className="relative bg-white w-full max-w-sm shadow-lg" style={{ borderRadius: 3, border: '1px solid var(--nx-line)' }}>
        <div className="px-5 pt-5 pb-4">
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--nx-black)', marginBottom: 8 }}>{titulo}</p>
          <p style={{ fontSize: 13, color: 'var(--nx-gray)', lineHeight: 1.6 }}>{mensaje}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-4">
          <button onClick={onCancelar} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={onConfirmar}
            style={{
              background: danger ? 'var(--nx-red)' : 'var(--nx-black)',
              color: 'white',
              padding: '8px 18px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 2,
              cursor: 'pointer',
            }}>
            {confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// InformeSection, Narrativa, HallazgoCard, InstrumentoCard,
// PlanTimeline, GlosarioAcordeon, PuntosVerificarCard, SidebarNav
// → importados desde @/components/informe-nexxo/

// ── Panel de acciones (columna derecha) ─────────────────────────────
function AccionesPanel({ informe, empresa, onPublicar, onDespublicar, onRegenerar, onDescargarPDF, publicando, generandoPDF }) {
  const publicado = empresa?.informe_publicado
  const fecha = informe?.fecha_generacion
    ? new Date(informe.fecha_generacion).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Estado */}
      <div style={{ padding: '14px 16px', border: '1px solid var(--nx-topo-xl)', borderRadius: 3, background: 'var(--nx-off)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 8 }}>
          Estado del informe
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <p style={{ fontSize: 12, color: 'var(--nx-gray)', margin: 0 }}>Generado: <strong style={{ color: 'var(--nx-black)' }}>{fecha}</strong></p>
          <p style={{ fontSize: 12, color: 'var(--nx-gray)', margin: 0 }}>Versión: <strong style={{ color: 'var(--nx-black)' }}>{informe?.version || 1}</strong></p>
          {publicado && empresa?.informe_publicado_at && (
            <p style={{ fontSize: 12, color: 'var(--nx-green)', margin: 0, fontWeight: 600 }}>
              Publicado el {new Date(empresa.informe_publicado_at).toLocaleDateString('es-AR')}
            </p>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div style={{ padding: '14px 16px', border: '1px solid var(--nx-topo-xl)', borderRadius: 3 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 12 }}>
          Acciones
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Publicar / Despublicar */}
          {!publicado ? (
            <button
              onClick={onPublicar}
              disabled={publicando}
              style={{
                padding: '10px 14px', borderRadius: 3, cursor: publicando ? 'not-allowed' : 'pointer',
                background: publicando ? 'var(--nx-topo-xl)' : 'var(--nx-indigo, #4F46E5)',
                color: 'white', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: publicando ? 0.7 : 1,
              }}>
              <Send size={13} />
              {publicando ? 'Publicando...' : 'Publicar para el cliente'}
            </button>
          ) : (
            <button
              onClick={onDespublicar}
              style={{
                padding: '10px 14px', borderRadius: 3, cursor: 'pointer',
                background: 'var(--nx-red-bg)', color: 'var(--nx-red)',
                border: '1px solid var(--nx-red-bd)',
                fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <EyeOff size={13} /> Despublicar
            </button>
          )}

          {/* Descargar PDF */}
          <button
            onClick={onDescargarPDF}
            disabled={generandoPDF || !informe?.contenido_json}
            style={{
              width: '100%', padding: '8px 14px', borderRadius: 3,
              border: '1px solid var(--nx-topo-xl)',
              background: generandoPDF ? 'var(--nx-off)' : 'var(--nx-white)',
              color: 'var(--nx-black)',
              fontSize: 12, fontWeight: 600,
              cursor: generandoPDF ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: (!informe?.contenido_json) ? 0.4 : 1,
              transition: 'all 0.15s',
            }}>
            {generandoPDF
              ? <><Loader2 size={13} className="animate-spin" /> Generando PDF...</>
              : <><Download size={13} /> Descargar PDF</>}
          </button>

          {/* Regenerar */}
          <button
            onClick={onRegenerar}
            style={{
              padding: '7px 14px', borderRadius: 3, cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--nx-topo-xl)',
              color: 'var(--nx-gray)', fontSize: 11.5, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
            <RefreshCw size={12} /> Regenerar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panel de trazabilidad (columna derecha) ─────────────────────────
function TrazabilidadPanel({ checks }) {
  const items = [
    { label: 'Balance analizado',      ok: checks?.balance              },
    { label: 'Encuesta completada',    ok: checks?.cuestionario_cliente  },
    { label: 'Alma (5 dimensiones)',   ok: checks?.alma_empresa          },
    { label: 'Scoring SGR calculado',  ok: checks?.mapa_capital          },
  ]
  return (
    <div style={{ padding: '14px 16px', border: '1px solid var(--nx-topo-xl)', borderRadius: 3, marginTop: 12 }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 10 }}>
        Trazabilidad de fuentes
      </p>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2.5" style={{ paddingBottom: 6 }}>
          {item.ok
            ? <CheckCircle size={13} style={{ color: 'var(--nx-green)', flexShrink: 0 }} />
            : <XCircle    size={13} style={{ color: 'var(--nx-red)',   flexShrink: 0 }} />}
          <span style={{ fontSize: 12, color: item.ok ? 'var(--nx-black)' : 'var(--nx-topo)', fontWeight: item.ok ? 500 : 400 }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Toast simple ────────────────────────────────────────────────────
function Toast({ mensaje, tipo }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 100,
      padding: '12px 18px', borderRadius: 4,
      background: tipo === 'error' ? 'var(--nx-red)' : tipo === 'success' ? '#16A34A' : 'var(--nx-black)',
      color: 'white', fontSize: 13, fontWeight: 600,
      boxShadow: 'var(--nx-shadow-md)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {tipo === 'success' && <CheckCircle size={15} />}
      {tipo === 'error' && <AlertTriangle size={15} />}
      {mensaje}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════

export default function InformeNexxoPage() {
  const { empresaActiva, profile } = useAuth()
  const empresaId = empresaActiva?.id || ''
  const asesorId  = profile?.id || ''

  // Estado principal
  const [checks,       setChecks]       = useState(null)
  const [informe,      setInforme]      = useState(null)   // fila de informes_nexxo
  const [empresa,      setEmpresa]      = useState(null)   // fila de empresas (para informe_publicado)
  const [loading,      setLoading]      = useState(true)
  const [generando,    setGenerando]    = useState(false)
  const [genStep,      setGenStep]      = useState(0)
  const [publicando,   setPublicando]   = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState(false)
  const [error,        setError]        = useState(null)
  const [toast,        setToast]        = useState(null)   // { mensaje, tipo }
  const [modal,        setModal]        = useState(null)   // { titulo, mensaje, onConfirmar, ... }
  const [activeSection, setActiveSection] = useState('carta')

  // ── Helpers ───────────────────────────────────────────────────────
  const showToast = useCallback((mensaje, tipo = 'success') => {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Carga inicial ─────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    if (!empresaId) return
    setLoading(true); setError(null)

    const [checkRes, informeRes, empresaRes] = await Promise.all([
      checkPrerequisitesInformeNexxo(empresaId),
      (adminDb || supabase)
        .from('informes_nexxo')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('fecha_generacion', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('empresas')
        .select('informe_publicado, informe_publicado_at')
        .eq('id', empresaId)
        .single(),
    ])

    setChecks(checkRes)
    setInforme(informeRes.data || null)
    setEmpresa(empresaRes.data || null)
    setLoading(false)
  }, [empresaId])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // ── Animación de pasos durante generación ─────────────────────────
  useEffect(() => {
    if (!generando) { setGenStep(0); return }
    setGenStep(0)
    const intervals = [0, 20000, 40000, 60000, 80000].map((delay, i) =>
      setTimeout(() => setGenStep(i), delay)
    )
    return () => intervals.forEach(clearTimeout)
  }, [generando])

  // ── Observer para sección activa ──────────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id) })
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    SECCIONES_NAV.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [informe])

  // ── Determinar vista ──────────────────────────────────────────────
  const vista = (() => {
    if (loading) return 'loading'
    if (generando) return 'B'
    if (!informe || informe.estado === 'error') return 'A'
    if (informe.estado === 'generando') return 'B'
    if (informe.estado === 'generado') return 'C'
    return 'A'
  })()

  const contenido = informe?.contenido_json

  // ── Acción: Generar ───────────────────────────────────────────────
  async function handleGenerar() {
    if (!checks?.puedeGenerar) return
    setGenerando(true); setError(null)
    try {
      await generarInformeNexxo({
        empresaId,
        asesorId,
        apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
      })
      await cargarDatos()
    } catch (e) {
      setError(e?.message || 'Error al generar el informe.')
      console.error('[InformeNexxo] Error generación:', e)
    } finally {
      setGenerando(false)
    }
  }

  // ── Acción: Publicar ──────────────────────────────────────────────
  function abrirModalPublicar() {
    setModal({
      titulo: 'Publicar Informe NEXXO',
      mensaje: 'El cliente podrá ver este informe en su portal y recibirá una notificación. ¿Confirmar la publicación?',
      confirmarLabel: 'Sí, publicar',
      onConfirmar: confirmarPublicar,
    })
  }

  async function confirmarPublicar() {
    setModal(null); setPublicando(true)
    try {
      await supabase.from('empresas').update({
        informe_publicado: true,
        informe_publicado_at: new Date().toISOString(),
        etapa_diagnostico: 4,
      }).eq('id', empresaId)

      await Promise.all([
        supabase.from('mensajes').insert({
          empresa_id:    empresaId,
          remitente_id:  asesorId,
          remitente_rol: 'asesor',
          contenido:     'Tu Informe NEXXO está listo. Lo encontrás en Mi Informe y en Mis Documentos.',
          leido:         false,
        }),
        supabase.from('alertas').insert({
          empresa_id: empresaId,
          tipo:       'general',
          nivel:      'info',
          mensaje:    'Tu Informe NEXXO está disponible',
          leida:      false,
          origen:     'asesor_manual',
        }),
      ])

      setEmpresa(prev => ({ ...prev, informe_publicado: true, informe_publicado_at: new Date().toISOString() }))
      showToast('Informe publicado. El cliente fue notificado.', 'success')
    } catch (e) {
      showToast('Error al publicar: ' + e?.message, 'error')
    } finally {
      setPublicando(false)
    }
  }

  // ── Acción: Despublicar ───────────────────────────────────────────
  function abrirModalDespublicar() {
    setModal({
      titulo: 'Despublicar informe',
      mensaje: 'El cliente ya no podrá ver el informe hasta que lo vuelvas a publicar.',
      confirmarLabel: 'Despublicar',
      danger: true,
      onConfirmar: confirmarDespublicar,
    })
  }

  async function confirmarDespublicar() {
    setModal(null)
    await supabase.from('empresas').update({ informe_publicado: false }).eq('id', empresaId)
    setEmpresa(prev => ({ ...prev, informe_publicado: false }))
    showToast('Informe despublicado.', 'success')
  }

  // ── Acción: Descargar PDF ─────────────────────────────────────────
  async function handleDescargarPDF() {
    if (!informe?.contenido_json || generandoPDF) return
    setGenerandoPDF(true)
    try {
      const blob = await generarPDFInformeNexxo(informe.contenido_json, empresaActiva)

      // Descarga inmediata al browser
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href    = url
      a.download = `Informe-NEXXO-${(empresaActiva?.nombre || 'empresa').replace(/\s+/g, '-')}-v${informe.version || 1}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      // Subir a Storage en background (no bloquea UX)
      guardarPDFEnStorage(informe.id, blob, empresaId, informe.version || 1)
        .then(() => showToast('PDF guardado en Storage.', 'success'))
        .catch(e => console.error('[PDF Storage]', e))
    } catch (e) {
      console.error('[PDF]', e)
      showToast(`Error al generar PDF: ${e?.message || e}`, 'error')
    } finally {
      setGenerandoPDF(false)
    }
  }

  // ── Acción: Regenerar ─────────────────────────────────────────────
  function abrirModalRegenerar() {
    const v = (informe?.version || 1) + 1
    setModal({
      titulo: 'Regenerar informe',
      mensaje: `Esto generará una versión ${v} del informe. El anterior queda en el historial. Si el informe estaba publicado, se despublicará hasta que confirmes el nuevo.`,
      confirmarLabel: 'Regenerar',
      onConfirmar: confirmarRegenerar,
    })
  }

  async function confirmarRegenerar() {
    setModal(null)
    if (empresa?.informe_publicado) {
      await supabase.from('empresas').update({ informe_publicado: false }).eq('id', empresaId)
      setEmpresa(prev => ({ ...prev, informe_publicado: false }))
    }
    await handleGenerar()
  }

  // ── Render ────────────────────────────────────────────────────────
  if (!empresaId) return (
    <div className="flex-1 flex items-center justify-center">
      <p style={{ fontSize: 13, color: 'var(--nx-topo)' }}>Seleccioná una empresa desde el panel lateral.</p>
    </div>
  )

  const faltantes = checks?.faltantes || []
  const puedeGenerar = checks?.puedeGenerar && !generando

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="Informe NEXXO"
        subtitle={empresaActiva?.nombre}
        actions={vista === 'C' && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
            padding: '4px 10px', borderRadius: 2,
            background: empresa?.informe_publicado ? 'var(--nx-green-bg)' : 'var(--nx-off)',
            color: empresa?.informe_publicado ? 'var(--nx-green)' : 'var(--nx-topo)',
            border: `1px solid ${empresa?.informe_publicado ? 'var(--nx-green-bd)' : 'var(--nx-topo-xl)'}`,
          }}>
            {empresa?.informe_publicado ? 'Publicado' : 'Borrador'}
          </span>
        )}
      />

      <div className="flex-1 overflow-hidden flex flex-col">

        {/* ── CARGANDO ───────────────────────────────────────────── */}
        {vista === 'loading' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-3" style={{ color: 'var(--nx-topo)' }}>
              <Loader2 size={18} className="animate-spin" />
              <span style={{ fontSize: 13 }}>Cargando...</span>
            </div>
          </div>
        )}

        {/* ── VISTA A — Sin informe ───────────────────────────────── */}
        {vista === 'A' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div style={{ maxWidth: 520, margin: '0 auto' }}>

              {/* Título editorial */}
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, background: 'var(--nx-black)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={16} color="white" />
                  </div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--nx-black)', margin: 0 }}>Informe NEXXO</h1>
                </div>
                <p style={{ fontSize: 13, color: 'var(--nx-topo)', margin: 0 }}>
                  La carta de presentación final para tu cliente
                </p>
              </div>

              {/* Error */}
              {(error || informe?.estado === 'error') && (
                <div style={{
                  padding: '12px 16px', marginBottom: 20,
                  background: 'var(--nx-red-bg)', border: '1px solid var(--nx-red-bd)',
                  borderLeft: '4px solid var(--nx-red)', borderRadius: 3,
                }}>
                  <p style={{ fontSize: 12.5, color: 'var(--nx-red)', fontWeight: 600, marginBottom: 2 }}>Error al generar</p>
                  <p style={{ fontSize: 12, color: 'var(--nx-red)', margin: 0 }}>
                    {error || informe?.error_mensaje || 'Ocurrió un error. Intentá de nuevo.'}
                  </p>
                </div>
              )}

              {/* Card prerequisitos */}
              <div style={{
                padding: '20px 22px',
                border: '1px solid var(--nx-topo-xl)',
                borderRadius: 3, background: 'white',
                boxShadow: 'var(--nx-shadow-sm)',
                marginBottom: 20,
              }}>
                <p style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: 'var(--nx-topo)', marginBottom: 14,
                }}>
                  Estado de prerrequisitos
                </p>
                <PrerequisiteCheckList checks={checks?.checks} loading={!checks} />
              </div>

              {/* Botón generar */}
              <div style={{ marginBottom: 16 }}>
                {faltantes.length > 0 && (
                  <div style={{
                    padding: '10px 14px', marginBottom: 10,
                    background: 'var(--nx-amber-bg)', border: '1px solid var(--nx-amber-bd)',
                    borderRadius: 3,
                  }}>
                    <p style={{ fontSize: 12, color: 'var(--nx-amber)', fontWeight: 600, marginBottom: 4 }}>Falta completar:</p>
                    <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                      {faltantes.map((f, i) => (
                        <li key={i} style={{ fontSize: 12, color: 'var(--nx-amber)', lineHeight: 1.6 }}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  onClick={handleGenerar}
                  disabled={!puedeGenerar}
                  style={{
                    width: '100%', padding: '12px 20px',
                    borderRadius: 3, cursor: puedeGenerar ? 'pointer' : 'not-allowed',
                    background: puedeGenerar ? 'var(--nx-amber)' : 'var(--nx-topo-xl)',
                    color: puedeGenerar ? 'white' : 'var(--nx-topo)',
                    fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    border: 'none', transition: 'all 0.15s',
                  }}>
                  <FileText size={15} />
                  Generar Informe NEXXO
                </button>
              </div>

              <p style={{ fontSize: 12, color: 'var(--nx-topo)', textAlign: 'center', lineHeight: 1.7, margin: 0 }}>
                El informe se genera con análisis automático y demora entre 60 y 90 segundos.<br />
                Una vez generado, podés revisarlo antes de publicarlo para el cliente.
              </p>
            </div>
          </div>
        )}

        {/* ── VISTA B — Generando ─────────────────────────────────── */}
        {vista === 'B' && (
          <div className="flex-1 flex items-center justify-center">
            <div style={{
              maxWidth: 420, width: '100%', margin: '0 32px',
              padding: '28px 28px',
              border: '1px solid var(--nx-topo-xl)',
              borderRadius: 3, background: 'white',
              boxShadow: 'var(--nx-shadow-md)',
            }}>
              <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--nx-amber)' }} />
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--nx-black)', margin: 0 }}>Generando informe</p>
                  <p style={{ fontSize: 12, color: 'var(--nx-topo)', margin: 0 }}>Esto puede tardar hasta 90 segundos</p>
                </div>
              </div>
              <LoadingSteps step={genStep} />
            </div>
          </div>
        )}

        {/* ── VISTA C — Informe generado ──────────────────────────── */}
        {vista === 'C' && contenido && (
          <div className="flex-1 overflow-hidden flex">

            {/* Columna izquierda — sticky */}
            <div style={{
              width: 220, flexShrink: 0,
              borderRight: '1px solid var(--nx-line)',
              overflowY: 'auto', padding: '20px 16px',
              background: 'var(--nx-off)',
            }}>
              <SidebarNav
                contenidoJson={informe?.contenido_json}
                activeSection={activeSection}
                mode="asesor"
                onRegenerar={abrirModalRegenerar}
              />
            </div>

            {/* Columna central — contenido del informe */}
            <div className="flex-1 overflow-y-auto" style={{ padding: '28px 36px' }}>

              {/* Portada */}
              <div style={{
                padding: '20px 24px', marginBottom: 28,
                background: 'var(--nx-black)', borderRadius: 3,
              }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 4 }}>
                  NEXXO CAPITAL — Informe Diagnóstico
                </p>
                <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--nx-font-serif)', color: 'white', margin: '0 0 4px' }}>
                  {contenido.portada?.empresa}
                </h1>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--nx-topo)' }}>CUIT {contenido.portada?.cuit}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--nx-topo)' }}>Período {contenido.portada?.periodo}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--nx-topo)' }}>{contenido.portada?.fecha_emision}</span>
                </div>
              </div>

              {/* Carta inicial */}
              <InformeSection id="carta" titulo="Carta inicial">
                <div style={{
                  padding: '18px 20px', background: 'var(--nx-off)',
                  borderRadius: 3, borderLeft: '3px solid var(--nx-amber)',
                }}>
                  <Narrativa texto={contenido.carta_inicial} />
                </div>
              </InformeSection>

              {/* Resumen ejecutivo */}
              <InformeSection id="resumen" titulo="Resumen ejecutivo">
                <div style={{
                  display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16,
                  padding: '14px 16px', background: 'var(--nx-off)',
                  borderRadius: 3, marginBottom: 12,
                }}>
                  <div style={{ textAlign: 'center', padding: '8px 16px' }}>
                    <p style={{ fontSize: 48, fontWeight: 700, fontFamily: 'var(--nx-font-serif)', color: 'var(--nx-black)', lineHeight: 1, margin: 0 }}>
                      {contenido.resumen_ejecutivo?.score_sgr}
                    </p>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--nx-amber)', marginTop: 2, margin: '2px 0 0' }}>
                      {contenido.resumen_ejecutivo?.categoria_sgr}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--nx-topo)', margin: 0 }}>/ 100</p>
                  </div>
                  <div style={{ borderLeft: '1px solid var(--nx-line)', paddingLeft: 16 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 8 }}>
                      Puntos clave
                    </p>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(contenido.resumen_ejecutivo?.puntos_clave || []).map((p, i) => (
                        <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--nx-amber)', marginTop: 5, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: 'var(--nx-black)', lineHeight: 1.5 }}>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </InformeSection>

              {/* Quiénes son hoy */}
              <InformeSection id="quienes" titulo="Quiénes son hoy">
                <Narrativa texto={contenido.quienes_son_hoy} />
              </InformeSection>

              {/* Qué dicen los números */}
              <InformeSection id="numeros" titulo="Qué dicen los números">
                <div style={{ marginBottom: 20 }}>
                  <Narrativa texto={contenido.que_dicen_los_numeros?.narrativa} />
                </div>
                {contenido.que_dicen_los_numeros?.hallazgos?.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {contenido.que_dicen_los_numeros.hallazgos.map((h, i) => (
                      <HallazgoCard key={i} hallazgo={h} />
                    ))}
                  </div>
                )}
              </InformeSection>

              {/* Voz de la empresa */}
              <InformeSection id="voz" titulo="Voz de la empresa">
                <div style={{ padding: '16px 18px', background: 'var(--nx-indigo-bg, #EEF2FF)', borderRadius: 3, borderLeft: '3px solid var(--nx-indigo, #4F46E5)' }}>
                  <Narrativa texto={contenido.voz_de_la_empresa} />
                </div>
              </InformeSection>

              {/* Mapa de capital */}
              <InformeSection id="capital" titulo="Mapa de capital">
                {contenido.mapa_de_capital?.que_es_mercado_capitales && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 8 }}>
                      El mercado de capitales
                    </p>
                    <Narrativa texto={contenido.mapa_de_capital.que_es_mercado_capitales} />
                  </div>
                )}
                {contenido.mapa_de_capital?.introduccion_sgr && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 8 }}>
                      Qué es una SGR
                    </p>
                    <Narrativa texto={contenido.mapa_de_capital.introduccion_sgr} />
                  </div>
                )}
                {contenido.mapa_de_capital?.lectura_categoria && (
                  <div style={{ padding: '12px 16px', background: 'var(--nx-off)', border: '1px solid var(--nx-topo-xl)', borderRadius: 3, marginBottom: 20 }}>
                    <Narrativa texto={contenido.mapa_de_capital.lectura_categoria} />
                  </div>
                )}
                {contenido.mapa_de_capital?.instrumentos_disponibles?.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 12 }}>
                      Instrumentos disponibles
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {contenido.mapa_de_capital.instrumentos_disponibles.map((inst, i) => (
                        <InstrumentoCard key={i} instrumento={inst} />
                      ))}
                    </div>
                  </div>
                )}
                {contenido.mapa_de_capital?.tipos_operatoria_recomendada?.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 12 }}>
                      Operatorias recomendadas
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {contenido.mapa_de_capital.tipos_operatoria_recomendada.map((op, i) => (
                        <div key={i} style={{ padding: '12px 14px', border: '1px solid var(--nx-topo-xl)', borderRadius: 3 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--nx-black)', marginBottom: 4 }}>
                            <span style={{
                              display: 'inline-block', padding: '1px 7px', borderRadius: 2,
                              background: 'var(--nx-indigo-bg, #EEF2FF)', color: 'var(--nx-indigo, #4F46E5)',
                              fontSize: 10, fontWeight: 700, marginRight: 8,
                            }}>
                              {op.categoria}
                            </span>
                            {op.descripcion_simple}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--nx-gray)', margin: 0 }}>{op.justificacion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </InformeSection>

              {/* Plan 90 días */}
              <InformeSection id="plan" titulo="Plan 90 días">
                <PlanTimeline acciones={contenido.plan_90_dias} />
              </InformeSection>

              {/* Cierre */}
              <InformeSection id="cierre" titulo="Cierre">
                {contenido.cierre?.mensaje_final && (
                  <div style={{
                    padding: '18px 20px', marginBottom: 20,
                    background: 'var(--nx-black)', borderRadius: 3,
                  }}>
                    <Narrativa texto={contenido.cierre.mensaje_final} />
                  </div>
                )}
                {contenido.cierre?.glosario?.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 10 }}>
                      Glosario
                    </p>
                    <GlosarioAcordeon terminos={contenido.cierre.glosario} />
                  </div>
                )}
                {contenido.cierre?.disclaimer && (
                  <p style={{ fontSize: 11, color: 'var(--nx-topo)', lineHeight: 1.6, marginTop: 16, fontStyle: 'italic' }}>
                    {contenido.cierre.disclaimer}
                  </p>
                )}
              </InformeSection>

              {/* Puntos a verificar — privado */}
              {contenido.puntos_a_verificar_interno?.length > 0 && (
                <InformeSection id="verificar" titulo="Puntos a verificar antes de publicar">
                  <PuntosVerificarCard puntos={contenido.puntos_a_verificar_interno} />
                </InformeSection>
              )}

            </div>

            {/* Columna derecha — sticky */}
            <div style={{
              width: 260, flexShrink: 0,
              borderLeft: '1px solid var(--nx-line)',
              overflowY: 'auto', padding: '20px 16px',
            }}>
              <AccionesPanel
                informe={informe}
                empresa={empresa}
                onPublicar={abrirModalPublicar}
                onDespublicar={abrirModalDespublicar}
                onRegenerar={abrirModalRegenerar}
                onDescargarPDF={handleDescargarPDF}
                publicando={publicando}
                generandoPDF={generandoPDF}
              />
              <TrazabilidadPanel checks={checks?.checks} />
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <ModalConfirm
          titulo={modal.titulo}
          mensaje={modal.mensaje}
          confirmarLabel={modal.confirmarLabel}
          danger={modal.danger}
          onConfirmar={modal.onConfirmar}
          onCancelar={() => setModal(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}
    </div>
  )
}
