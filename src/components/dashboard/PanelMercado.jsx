import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Helpers ──────────────────────────────────────────────────────────

function formatValor(valor, unidad) {
  if (!valor || valor === '—') return '—'
  if (valor.startsWith('CER + ')) return valor
  if (unidad === '$') return `$${valor}`
  if (unidad === '%') return `${valor}%`
  if (unidad === 'pb') return `${valor} pb`
  return valor
}

function tiempoRelativo(dateStr) {
  if (!dateStr) return null
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60)   return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return 'ayer'
}

const VAR_COLOR = {
  positiva: '#3B6D11',
  negativa: '#A32D2D',
  neutral:  'var(--nx-gray)',
}

// ── Config de grupos ──────────────────────────────────────────────────

const GRUPOS = [
  {
    key:    'dolar',
    titulo: 'DÓLAR',
    cols:   4,
    cardBg: 'var(--nx-off)',
    textColor:    'var(--nx-black)',
    captionColor: 'var(--nx-gray)',
  },
  {
    key:    'colocacion',
    titulo: 'COLOCACIÓN DE EXCEDENTES',
    cols:   3,
    cardBg: '#EAF3DE',
    textColor:    '#27500A',
    captionColor: '#3B6D11',
  },
  {
    key:    'financiamiento',
    titulo: 'FINANCIAMIENTO',
    cols:   3,
    cardBg: '#FAEEDA',
    textColor:    '#633806',
    captionColor: '#854F0B',
  },
  {
    key:    'macro',
    titulo: 'CONTEXTO MACRO',
    cols:   4,
    cardBg: 'var(--nx-off)',
    textColor:    'var(--nx-black)',
    captionColor: 'var(--nx-gray)',
  },
]

// ── Skeleton card ─────────────────────────────────────────────────────

function SkeletonCard({ bg = 'var(--nx-off)' }) {
  return (
    <div style={{
      background: bg, borderRadius: 3, padding: '10px 12px',
      border: '1px solid rgba(0,0,0,0.05)',
    }}>
      <div style={{ height: 9, width: '60%', background: 'rgba(0,0,0,0.07)', borderRadius: 2, marginBottom: 8 }} />
      <div style={{ height: 14, width: '40%', background: 'rgba(0,0,0,0.1)', borderRadius: 2, marginBottom: 6 }} />
      <div style={{ height: 8, width: '30%', background: 'rgba(0,0,0,0.05)', borderRadius: 2 }} />
    </div>
  )
}

// ── Card individual ───────────────────────────────────────────────────

function IndicadorCard({ ind, textColor, captionColor, cardBg }) {
  const valorFmt = formatValor(ind.valor, ind.unidad)
  const varColor = VAR_COLOR[ind.variacion_tipo] || VAR_COLOR.neutral
  const varPrefix = ind.variacion && !ind.variacion.startsWith('+') && !ind.variacion.startsWith('-') && !ind.variacion.startsWith('0')
    ? (ind.variacion_tipo === 'positiva' ? '↑ ' : ind.variacion_tipo === 'negativa' ? '↓ ' : '')
    : ''

  return (
    <div style={{
      background: cardBg, borderRadius: 3, padding: '10px 12px',
      border: '1px solid rgba(0,0,0,0.06)',
    }}>
      <p style={{ fontSize: 10, color: 'rgba(0,0,0,0.4)', marginBottom: 4, lineHeight: 1.2 }}>
        {ind.label}
      </p>
      <p style={{ fontSize: 15, fontWeight: 700, color: textColor, marginBottom: ind.variacion ? 3 : 0, lineHeight: 1.2 }}>
        {valorFmt}
      </p>
      {ind.variacion && (
        <p style={{ fontSize: 10, color: varColor, fontWeight: 600, marginBottom: ind.caption ? 3 : 0 }}>
          {varPrefix}{ind.variacion}
        </p>
      )}
      {ind.caption && (
        <p style={{ fontSize: 9.5, color: captionColor, lineHeight: 1.4, margin: 0 }}>
          {ind.caption}
        </p>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────

export default function PanelMercado() {
  const [indicadores, setIndicadores] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [ultimaAct,   setUltimaAct]   = useState(null)

  async function cargar() {
    setError(null); setLoading(true)
    const { data, error: err } = await supabase
      .from('indicadores_mercado')
      .select('*')
      .order('grupo').order('orden')
    if (err) { setError(err.message); setLoading(false); return }
    setIndicadores(data || [])
    const maxDate = (data || []).reduce((m, r) => r.updated_at > m ? r.updated_at : m, '')
    setUltimaAct(maxDate || null)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  const byGrupo = (key) => indicadores.filter(i => i.grupo === key)

  return (
    <div style={{ border: '1px solid var(--nx-line)', borderRadius: 3, overflow: 'hidden' }}>

      {/* Header negro */}
      <div style={{
        background: 'var(--nx-black)', padding: '9px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: '#97C459', flexShrink: 0,
            animation: 'panelMercadoPulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, fontWeight: 500, color: 'white', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Mercado en línea
          </span>
        </div>
        {ultimaAct && (
          <span style={{ fontSize: 9.5, color: 'var(--nx-topo)', fontFamily: 'var(--nx-font-mono)' }}>
            Actualizado {tiempoRelativo(ultimaAct)}
          </span>
        )}
      </div>

      {/* Animación del dot */}
      <style>{`
        @keyframes panelMercadoPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>

      {/* Body */}
      <div style={{ background: 'white', padding: '14px' }}>

        {/* Error */}
        {error && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ fontSize: 12, color: 'var(--nx-red)', marginBottom: 10 }}>No se pudieron cargar los indicadores</p>
            <button onClick={cargar}
              style={{ fontSize: 11, fontWeight: 600, color: 'var(--nx-black)', border: '1px solid var(--nx-topo-xl)', borderRadius: 3, padding: '5px 12px', cursor: 'pointer', background: 'white' }}>
              Reintentar
            </button>
          </div>
        )}

        {/* Empty */}
        {!error && !loading && indicadores.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--nx-topo)', padding: '24px 0' }}>
            Datos de mercado no disponibles
          </p>
        )}

        {/* Grupos */}
        {!error && GRUPOS.map((g, gi) => {
          const items = byGrupo(g.key)
          if (!loading && items.length === 0) return null
          return (
            <div key={g.key} style={{ marginBottom: gi < GRUPOS.length - 1 ? 14 : 0 }}>
              <p style={{
                fontSize: 8.5, fontWeight: 700, letterSpacing: '0.18em',
                textTransform: 'uppercase', color: 'var(--nx-topo)',
                marginBottom: 7,
              }}>
                {g.titulo}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${g.cols}, 1fr)`, gap: 6 }}>
                {loading
                  ? Array.from({ length: g.cols }).map((_, i) => (
                      <SkeletonCard key={i} bg={g.cardBg} />
                    ))
                  : items.map(ind => (
                      <IndicadorCard
                        key={ind.id}
                        ind={ind}
                        cardBg={g.cardBg}
                        textColor={g.textColor}
                        captionColor={g.captionColor}
                      />
                    ))
                }
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
