import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/shared/PageHeader'
import { Save, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'

const GRUPOS = [
  { key: 'dolar',          titulo: 'Dólar'                    },
  { key: 'colocacion',     titulo: 'Colocación de excedentes' },
  { key: 'financiamiento', titulo: 'Financiamiento'           },
  { key: 'macro',          titulo: 'Contexto macro'           },
]

const TIPOS = ['positiva', 'negativa', 'neutral']

function tiempoRelativo(dateStr) {
  if (!dateStr) return '—'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60)    return 'hace un momento'
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return new Date(dateStr).toLocaleDateString('es-AR')
}

// ── Fila editable ─────────────────────────────────────────────────────

function FilaIndicador({ ind, profileId, onSaved }) {
  const [form,    setForm]    = useState({ valor: ind.valor || '', unidad: ind.unidad || '', variacion: ind.variacion || '', variacion_tipo: ind.variacion_tipo || 'neutral', caption: ind.caption || '' })
  const [saving,  setSaving]  = useState(false)
  const [ok,      setOk]      = useState(false)
  const [err,     setErr]     = useState(null)

  function campo(k, v) { setForm(p => ({ ...p, [k]: v })); setOk(false); setErr(null) }

  async function guardar() {
    if (!form.valor.trim()) { setErr('El valor no puede estar vacío'); return }
    setSaving(true); setErr(null)
    const { error } = await supabase.from('indicadores_mercado').update({
      valor:          form.valor.trim(),
      unidad:         form.unidad.trim() || null,
      variacion:      form.variacion.trim() || null,
      variacion_tipo: form.variacion_tipo,
      caption:        form.caption.trim() || null,
      updated_by:     profileId,
    }).eq('id', ind.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setOk(true)
    onSaved()
  }

  const inputStyle = { fontSize: 12, padding: '5px 8px', border: '1px solid var(--nx-light)', borderRadius: 3, background: 'white', outline: 'none', width: '100%' }

  return (
    <tr style={{ borderBottom: '1px solid var(--nx-off)' }}>
      <td style={{ padding: '8px 10px', fontSize: 12, color: 'var(--nx-gray)', whiteSpace: 'nowrap' }}>{ind.label}</td>
      <td style={{ padding: '6px 6px' }}>
        <input value={form.valor} onChange={e => campo('valor', e.target.value)} style={{ ...inputStyle, width: 120 }} placeholder="valor" />
      </td>
      <td style={{ padding: '6px 6px' }}>
        <input value={form.unidad} onChange={e => campo('unidad', e.target.value)} style={{ ...inputStyle, width: 50 }} placeholder="$  %  pb" />
      </td>
      <td style={{ padding: '6px 6px' }}>
        <input value={form.variacion} onChange={e => campo('variacion', e.target.value)} style={{ ...inputStyle, width: 70 }} placeholder="+1,2%" />
      </td>
      <td style={{ padding: '6px 6px' }}>
        <select value={form.variacion_tipo} onChange={e => campo('variacion_tipo', e.target.value)}
          style={{ ...inputStyle, width: 100, cursor: 'pointer' }}>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td style={{ padding: '6px 6px', minWidth: 180 }}>
        <input value={form.caption} onChange={e => campo('caption', e.target.value)} style={{ ...inputStyle, width: '100%' }} placeholder="Descripción breve..." />
      </td>
      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
        <button onClick={guardar} disabled={saving}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
            background: ok ? 'var(--nx-green-bg)' : 'var(--nx-black)', color: ok ? 'var(--nx-green)' : 'white',
            border: ok ? '1px solid var(--nx-green-bd)' : 'none', borderRadius: 3, opacity: saving ? 0.6 : 1,
          }}>
          {saving ? <RefreshCw size={11} className="animate-spin" /> : ok ? <CheckCircle size={11} /> : <Save size={11} />}
          {saving ? 'Guardando' : ok ? 'Guardado' : 'Guardar'}
        </button>
        {err && <p style={{ fontSize: 10, color: 'var(--nx-red)', marginTop: 3 }}>{err}</p>}
      </td>
    </tr>
  )
}

// ── Componente principal ──────────────────────────────────────────────

export default function AdminMercadoPage() {
  const { profile } = useAuth()
  const [indicadores, setIndicadores] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [ultimaAct,   setUltimaAct]   = useState(null)

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('indicadores_mercado').select('*').order('grupo').order('orden')
    setIndicadores(data || [])
    const maxDate = (data || []).reduce((m, r) => r.updated_at > m ? r.updated_at : m, '')
    setUltimaAct(maxDate || null)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  const byGrupo = (key) => indicadores.filter(i => i.grupo === key)

  const thStyle = { padding: '7px 10px', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--nx-topo)', textAlign: 'left', borderBottom: '1px solid var(--nx-line)', background: 'var(--nx-off)', whiteSpace: 'nowrap' }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="Indicadores de mercado"
        subtitle={ultimaAct ? `Última actualización: ${tiempoRelativo(ultimaAct)}` : 'Cargando...'}
        actions={
          <button onClick={cargar} disabled={loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              background: 'var(--nx-black)', color: 'white', borderRadius: 3, border: 'none',
              opacity: loading ? 0.6 : 1,
            }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refrescar
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {loading && (
            <p style={{ fontSize: 13, color: 'var(--nx-topo)', textAlign: 'center', padding: '32px 0' }}>Cargando indicadores...</p>
          )}

          {!loading && GRUPOS.map(g => {
            const items = byGrupo(g.key)
            if (!items.length) return null
            return (
              <div key={g.key}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 10 }}>
                  {g.titulo}
                </p>
                <div style={{ border: '1px solid var(--nx-line)', borderRadius: 3, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Indicador</th>
                        <th style={thStyle}>Valor</th>
                        <th style={thStyle}>Unidad</th>
                        <th style={thStyle}>Variación</th>
                        <th style={thStyle}>Tipo</th>
                        <th style={thStyle}>Caption</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(ind => (
                        <FilaIndicador key={ind.id} ind={ind} profileId={profile?.id} onSaved={cargar} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

        </div>
      </div>
    </div>
  )
}
