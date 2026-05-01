import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/shared/PageHeader'
import {
  Users, Building2, FileText, MessageCircle,
  AlertTriangle, TrendingUp, ChevronRight,
  ShieldCheck, Zap, Clock,
} from 'lucide-react'

// ══════════════════════════════════════════════════════════════════════
// TOKENS LOCALES
// ══════════════════════════════════════════════════════════════════════
const T = {
  amber:   '#C8A86B',
  black:   '#111417',
  gray:    '#6B6B6B',
  topo:    '#A8A093',
  topoXl:  '#E0DAD2',
  off:     '#F5F4F1',
  line:    'rgba(17,20,23,0.08)',
  green:   '#3B6D11',
  greenBg: '#EAF3DE',
  amber2:  '#854F0B',
  amberBg: '#FAEEDA',
  red:     '#791F1F',
  redBg:   '#FCEBEB',
  redBd:   '#E24B4A',
  blueBg:  '#ECEAF7',
  blue:    '#534AB7',
}

// ── Card container con header de barra ámbar ──────────────────────────
function NxCard({ titulo, right, children }) {
  return (
    <div style={{ background: 'white', border: `1px solid ${T.topoXl}`, borderRadius: 4 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 16px', borderBottom: `1px solid ${T.line}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 3, height: 14, background: T.amber, borderRadius: 2, flexShrink: 0 }} />
          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.gray, margin: 0 }}>
            {titulo}
          </p>
        </div>
        {right}
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, alerta, to }) {
  const bg    = alerta && (value > 0) ? T.redBg   : T.off
  const lbClr = alerta && (value > 0) ? T.red     : T.topo
  const valClr= alerta && (value > 0) ? T.red     : T.black
  const subClr= alerta && (value > 0) ? '#A32D2D' : T.gray

  const inner = (
    <div style={{
      background: bg, borderRadius: 4, padding: '14px 16px',
      border: `1px solid ${alerta && value > 0 ? '#F5C6C6' : T.topoXl}`,
      cursor: to ? 'pointer' : 'default', height: '100%',
    }}>
      <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: lbClr, marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 500, color: valClr, lineHeight: 1, marginBottom: 4, fontFamily: 'var(--nx-font-sans)' }}>
        {value ?? '—'}
      </p>
      {sub && <p style={{ fontSize: 11, color: subClr }}>{sub}</p>}
    </div>
  )
  return to ? <Link to={to} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link> : inner
}

// ── Embudo con barras coloreadas ──────────────────────────────────────
function EmbudoEtapas({ empresas }) {
  const etapas = [
    { n: 1, label: 'Onboarding',       color: '#888780' },
    { n: 2, label: 'Diagnóstico',      color: '#888780' },
    { n: 3, label: 'CFO activo',       color: '#639922' },
    { n: 4, label: 'Mercado capitales',color: '#C8A86B' },
    { n: 5, label: 'Estratégico',      color: '#534AB7' },
  ]
  const counts  = etapas.map(e => empresas.filter(emp => emp.etapa_numero === e.n).length)
  const maxCount= Math.max(...counts, 1)

  return (
    <NxCard titulo="Embudo por etapa">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {etapas.map((etapa, i) => {
          const count = counts[i]
          const barW  = count > 0 ? Math.max((count / maxCount) * 100, 6) : 0
          return (
            <div key={etapa.n} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: T.gray, width: 130, flexShrink: 0, textAlign: 'right' }}>
                {etapa.label}
              </span>
              <div style={{ flex: 1, background: T.off, height: 8, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${barW}%`, height: '100%', borderRadius: 4,
                  background: count > 0 ? etapa.color : 'transparent',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: count > 0 ? T.black : T.topo, width: 20, textAlign: 'right', flexShrink: 0 }}>
                {count}
              </span>
            </div>
          )
        })}
      </div>
    </NxCard>
  )
}

// ── Alertas con colores por severidad ─────────────────────────────────
function AlertasSistema({ alertas }) {
  const SEV = {
    critico: { borderColor: '#E24B4A', bg: '#FCEBEB', titleColor: '#791F1F', msgColor: '#A32D2D' },
    alto:    { borderColor: '#EF9F27', bg: '#FAEEDA', titleColor: '#633806', msgColor: '#854F0B' },
    info:    { borderColor: T.topoXl,  bg: T.off,     titleColor: T.gray,    msgColor: T.gray    },
  }

  const badge = alertas.length > 0 && (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background: '#FCEBEB', color: '#791F1F', border: '1px solid #F5C6C6',
    }}>
      {alertas.length} {alertas.length === 1 ? 'abierta' : 'abiertas'}
    </span>
  )

  return (
    <NxCard titulo="Alertas del sistema" right={badge}>
      {alertas.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: T.gray }}>
          <ShieldCheck size={15} style={{ color: T.topo }} />
          <p style={{ fontSize: 12, margin: 0 }}>Sin alertas abiertas</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alertas.map(a => {
            const s = SEV[a.nivel] || SEV.info
            return (
              <div key={a.id} style={{
                borderLeft: `2px solid ${s.borderColor}`, background: s.bg,
                padding: '6px 10px', borderRadius: '0 4px 4px 0',
              }}>
                <p style={{ fontSize: 11.5, fontWeight: 600, color: s.titleColor, margin: '0 0 2px' }}>
                  {a.empresas?.nombre}
                </p>
                <p style={{ fontSize: 11, color: s.msgColor, lineHeight: 1.4, margin: 0 }}>{a.mensaje}</p>
              </div>
            )
          })}
        </div>
      )}
    </NxCard>
  )
}

// ── Asesores con avatar ───────────────────────────────────────────────
function AsesoresPanel({ asesores }) {
  return (
    <NxCard
      titulo="Asesores del sistema"
      right={
        <Link to="/admin/asesores" style={{ fontSize: 11, color: T.gray, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
          Ver todos <ChevronRight size={11} />
        </Link>
      }
    >
      {asesores.length === 0 ? (
        <p style={{ fontSize: 12, color: T.gray, textAlign: 'center', padding: '12px 0' }}>Sin asesores cargados.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {asesores.slice(0, 5).map(a => {
            const initials = (a.nombre || a.email || '?').slice(0, 2).toUpperCase()
            const activo   = a.activo !== false
            const cantEmps = a.asignaciones?.length || 0
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: `1px solid ${T.line}` }}>
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: '#2C3E60', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'white' }}>{initials}</span>
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: T.black, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.nombre || a.email || '—'}
                  </p>
                  <p style={{ fontSize: 11, color: T.gray, margin: 0 }}>
                    {cantEmps} empresa{cantEmps !== 1 ? 's' : ''} asignada{cantEmps !== 1 ? 's' : ''} · Asesor financiero
                  </p>
                </div>
                {/* Badge */}
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, flexShrink: 0,
                  background: activo ? T.greenBg : T.off,
                  color:      activo ? T.green   : '#5F5E5A',
                }}>
                  {activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </NxCard>
  )
}

// ── Actividad reciente con dots coloreados ────────────────────────────
function ActividadReciente({ docs, mensajes }) {
  const DOT = {
    doc:          '#639922',
    msg_asesor:   '#888780',
    msg_cliente:  '#534AB7',
  }
  const LABEL = {
    doc:          (d) => d.titulo || 'Documento subido',
    msg_asesor:   ()  => 'Mensaje de asesor',
    msg_cliente:  ()  => 'Mensaje de cliente',
  }

  const items = [
    ...docs.map(d => ({ id: d.id, tipo: 'doc', texto: LABEL.doc(d), empresa: d.empresa_nombre, fecha: d.created_at })),
    ...mensajes.map(m => ({
      id: m.id,
      tipo: m.remitente_rol === 'asesor' ? 'msg_asesor' : 'msg_cliente',
      texto: m.remitente_rol === 'asesor' ? LABEL.msg_asesor() : LABEL.msg_cliente(),
      empresa: m.empresa_nombre,
      fecha: m.created_at,
    })),
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5)

  return (
    <NxCard
      titulo="Actividad reciente"
      right={
        <Link to="/mensajes" style={{ fontSize: 11, color: T.gray, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
          Ver historial <ChevronRight size={11} />
        </Link>
      }
    >
      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: T.gray, textAlign: 'center', padding: '12px 0' }}>Sin actividad reciente</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(item => (
            <div key={`${item.tipo}-${item.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                background: DOT[item.tipo] || T.topo,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: T.black, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.texto}
                </p>
                {item.empresa && (
                  <p style={{ fontSize: 11, color: T.gray, margin: 0 }}>{item.empresa}</p>
                )}
              </div>
              <span style={{ fontSize: 11, color: T.topo, flexShrink: 0 }}>
                {new Date(item.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </NxCard>
  )
}

// ══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL — lógica de fetch idéntica a la original
// ══════════════════════════════════════════════════════════════════════

export default function AdminPage() {
  const [metrics,    setMetrics]    = useState({})
  const [empresas,   setEmpresas]   = useState([])
  const [asesores,   setAsesores]   = useState([])
  const [alertas,    setAlertas]    = useState([])
  const [docsRecent, setDocsRecent] = useState([])
  const [msgsRecent, setMsgsRecent] = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('rol', 'asesor').eq('activo', true),
      supabase.from('empresas').select('id', { count: 'exact', head: true }).eq('activa', true),
      supabase.from('documentos').select('id', { count: 'exact', head: true }),
      supabase.from('mensajes').select('id', { count: 'exact', head: true }).eq('leido', false),
      supabase.from('empresas').select('id, nombre, etapa_numero, scoring_sgr(score_total)').eq('activa', true).order('nombre'),
      supabase.from('usuarios').select('id, nombre, email, activo, created_at, asignaciones(empresa_id)').eq('rol', 'asesor').order('nombre'),
      supabase.from('alertas').select('*, empresas(nombre)').eq('leida', false).order('created_at', { ascending: false }).limit(10),
      supabase.from('documentos').select('id, titulo, created_at, empresas(nombre)').order('created_at', { ascending: false }).limit(5),
      supabase.from('mensajes').select('id, remitente_rol, created_at, empresas(nombre)').order('created_at', { ascending: false }).limit(5),
    ]).then(([asCount, empCount, docCount, msgCount, emps, asess, alts, docs, msgs]) => {
      setMetrics({ asesores: asCount.count ?? 0, empresas: empCount.count ?? 0, docs: docCount.count ?? 0, msgs: msgCount.count ?? 0 })
      setEmpresas(emps.data || [])
      setAsesores(asess.data || [])
      setAlertas(alts.data || [])
      setDocsRecent((docs.data || []).map(d => ({ ...d, empresa_nombre: d.empresas?.nombre })))
      setMsgsRecent((msgs.data || []).map(m => ({ ...m, empresa_nombre: m.empresas?.nombre })))
      setLoading(false)
    })
  }, [])

  const scoresValidos    = empresas.map(e => e.scoring_sgr?.[0]?.score_total).filter(s => s > 0)
  const scorePromedio    = scoresValidos.length ? Math.round(scoresValidos.reduce((a, b) => a + b, 0) / scoresValidos.length) : null
  const listasParaMercado= empresas.filter(e => (e.scoring_sgr?.[0]?.score_total || 0) >= 50).length

  if (loading) return (
    <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--nx-off)' }}>
      <p style={{ fontSize: 12, color: 'var(--nx-topo)' }}>Cargando panel de administración...</p>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--nx-off)' }}>
      <PageHeader
        title="Administración"
        subtitle="NEXXO Capital — Vista global del sistema"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/admin/empresas" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              fontSize: 11, fontWeight: 600, color: T.black, textDecoration: 'none',
              border: `1px solid ${T.topoXl}`, borderRadius: 3, background: 'white',
            }}>
              <Building2 size={12} style={{ color: T.topo }} /> Empresas
            </Link>
            <Link to="/admin/asesores" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              fontSize: 11, fontWeight: 600, color: T.black, textDecoration: 'none',
              border: `1px solid ${T.topoXl}`, borderRadius: 3, background: 'white',
            }}>
              <Users size={12} style={{ color: T.topo }} /> Asesores
            </Link>
            <Link to="/admin/asignaciones" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              fontSize: 11, fontWeight: 700, color: 'white', textDecoration: 'none',
              borderRadius: 3, background: T.black,
            }}>
              <ChevronRight size={12} style={{ color: T.topo }} /> Asignaciones
            </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-[1100px] mx-auto flex flex-col gap-4">

          {/* ── KPIs principales (4 columnas) ──────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Asesores activos"   value={metrics.asesores} sub="En el sistema"          to="/admin/asesores" />
            <KpiCard label="Empresas activas"   value={metrics.empresas} sub="En todas las etapas"    to="/admin/empresas" />
            <KpiCard label="Documentos subidos" value={metrics.docs}     sub="Total histórico" />
            <KpiCard label="Alertas abiertas"   value={alertas.length}   sub="Pendientes de revisión" alerta />
          </div>

          {/* ── KPIs secundarios (3 columnas) ──────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <KpiCard
              label="Score SGR promedio"
              value={scorePromedio !== null ? `${scorePromedio}/100` : '—'}
              sub="Promedio de empresas con score calculado"
            />
            <KpiCard
              label="Listas para mercado"
              value={listasParaMercado}
              sub="Score ≥ 50 — habilitadas para operar"
            />
            <KpiCard
              label="Mensajes sin leer"
              value={metrics.msgs ?? '—'}
              sub="Pendientes de atención"
            />
          </div>

          {/* ── Embudo + Alertas ────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <EmbudoEtapas empresas={empresas} />
            <AlertasSistema alertas={alertas} />
          </div>

          {/* ── Asesores ───────────────────────────────────────── */}
          <AsesoresPanel asesores={asesores} />

          {/* ── Actividad reciente ──────────────────────────────── */}
          <ActividadReciente docs={docsRecent} mensajes={msgsRecent} />

        </div>
      </div>
    </div>
  )
}
