import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/shared/PageHeader'
import InformeRenderer from '@/components/informe-nexxo/InformeRenderer'
import { generarPDFInformeNexxo } from '@/lib/informeNexxoPDF'
import { guardarPDFEnStorage } from '@/lib/informeNexxo'
import { Clock, MessageCircle, Download, Loader2 } from 'lucide-react'

export default function MiInformePage() {
  const { empresa } = useAuth()
  const [estado,       setEstado]       = useState('cargando') // 'cargando' | 'pendiente' | 'listo'
  const [informe,      setInforme]      = useState(null)  // fila de informes_nexxo
  const [empresaData,  setEmpresaData]  = useState(null)  // para fecha de publicación
  const [generandoPDF, setGenerandoPDF] = useState(false)

  useEffect(() => {
    if (!empresa?.id) return

    supabase.from('empresas')
      .select('informe_publicado, informe_publicado_at, nombre, cuit, rubro')
      .eq('id', empresa.id)
      .single()
      .then(({ data: emp }) => {
        setEmpresaData(emp)
        if (!emp?.informe_publicado) { setEstado('pendiente'); return }

        supabase.from('informes_nexxo')
          .select('*')
          .eq('empresa_id', empresa.id)
          .eq('estado', 'generado')
          .order('fecha_generacion', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data: inf }) => {
            setInforme(inf || null)
            setEstado(inf ? 'listo' : 'pendiente')
          })
      })
  }, [empresa?.id])

  async function handleDescargarPDF() {
    if (!informe?.contenido_json || generandoPDF) return
    setGenerandoPDF(true)
    try {
      if (informe.pdf_storage_path) {
        // PDF ya guardado en Storage → URL firmada
        const { data } = await supabase.storage
          .from('informes-nexxo')
          .createSignedUrl(informe.pdf_storage_path, 60)
        if (data?.signedUrl) {
          const a   = document.createElement('a')
          a.href    = data.signedUrl
          a.download = `Informe-NEXXO-${(empresaData?.nombre || 'empresa').replace(/\s+/g, '-')}.pdf`
          a.click()
        }
      } else {
        // Generar on the fly y guardar en Storage para la próxima vez
        const blob = await generarPDFInformeNexxo(informe.contenido_json, empresaData || empresa)
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `Informe-NEXXO-${(empresaData?.nombre || 'empresa').replace(/\s+/g, '-')}-v${informe.version || 1}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        guardarPDFEnStorage(informe.id, blob, empresa.id, informe.version || 1)
          .catch(e => console.error('[PDF Storage]', e))
      }
    } catch (e) {
      console.error('[PDF]', e)
    } finally {
      setGenerandoPDF(false)
    }
  }

  if (!empresa) return null

  if (estado === 'cargando') return (
    <div className="flex-1 flex items-center justify-center">
      <p style={{ fontSize: 12, color: 'var(--nx-topo)' }}>Cargando...</p>
    </div>
  )

  // ── VISTA PENDIENTE ───────────────────────────────────────────────
  if (estado === 'pendiente') return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader title="Diagnóstico Financiero" subtitle={empresa?.nombre} />
      <div className="flex-1 flex items-center justify-center p-6">
        <div style={{
          padding: '40px 36px', textAlign: 'center', maxWidth: 420,
          background: 'white', borderRadius: 4, border: '1px solid var(--nx-line)',
          boxShadow: 'var(--nx-shadow-sm)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12, margin: '0 auto 20px',
            background: 'var(--nx-amber-bg)', border: '1px solid var(--nx-amber-bd)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Clock size={24} style={{ color: 'var(--nx-amber)' }} />
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--nx-black)', marginBottom: 10 }}>
            Tu informe está en preparación
          </p>
          <p style={{ fontSize: 13.5, color: 'var(--nx-gray)', lineHeight: 1.65, marginBottom: 24 }}>
            Estamos terminando el análisis financiero de tu empresa. Te avisaremos en cuanto esté disponible.
          </p>
          <div style={{ height: 5, background: 'var(--nx-light)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
            <div className="animate-pulse"
              style={{ height: '100%', width: '60%', background: 'var(--nx-amber)', borderRadius: 3 }} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--nx-topo)', marginBottom: 22 }}>Te avisaremos cuando esté listo</p>
          <Link to="/mensajes"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', fontSize: 12.5, fontWeight: 600,
              color: 'var(--nx-black)', border: '1px solid var(--nx-topo-xl)',
              borderRadius: 3, textDecoration: 'none',
            }}>
            <MessageCircle size={14} /> Hablar con mi asesor
          </Link>
        </div>
      </div>
    </div>
  )

  // ── VISTA LISTO ───────────────────────────────────────────────────
  const fechaPublicado = empresaData?.informe_publicado_at
    ? new Date(empresaData.informe_publicado_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader title="Diagnóstico Financiero" subtitle={empresa?.nombre} />

      {/* Strip de acciones del cliente */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px', background: 'white',
        borderBottom: '1px solid var(--nx-line)', gap: 12, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {fechaPublicado && (
            <span style={{ fontSize: 12, color: 'var(--nx-topo)' }}>
              Publicado el{' '}
              <strong style={{ color: 'var(--nx-black)' }}>{fechaPublicado}</strong>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/mensajes"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', fontSize: 12, fontWeight: 600,
              color: 'var(--nx-black)', border: '1px solid var(--nx-topo-xl)',
              borderRadius: 3, textDecoration: 'none',
            }}>
            <MessageCircle size={13} /> Mi asesor
          </Link>
          <button
            onClick={handleDescargarPDF}
            disabled={generandoPDF}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', fontSize: 12, fontWeight: 700,
              background: 'var(--nx-black)', color: 'white',
              border: 'none', borderRadius: 3, cursor: generandoPDF ? 'not-allowed' : 'pointer',
              opacity: generandoPDF ? 0.7 : 1, transition: 'opacity 0.15s',
            }}>
            {generandoPDF
              ? <><Loader2 size={13} className="animate-spin" /> Generando...</>
              : <><Download size={13} /> Descargar PDF</>}
          </button>
        </div>
      </div>

      {/* Renderer del informe */}
      <InformeRenderer
        contenidoJson={informe?.contenido_json}
        mode="cliente"
      />
    </div>
  )
}
