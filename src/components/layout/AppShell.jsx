import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, FileSearch, BarChart3, TrendingUp,
  FileText, Building2, BellRing, LogOut, ChevronRight,
  BookOpen, ClipboardList, Brain, Compass,
  Users, FolderOpen, MessageCircle, ShieldCheck,
  ChevronDown, CheckCircle, Activity,
} from 'lucide-react'
import clsx from 'clsx'

// ── Navegación por rol ──────────────────────────────────────────────
const ADMIN_NAV = [
  { to: '/admin',              label: 'Panel admin',          icon: ShieldCheck },
  { to: '/admin/asesores',     label: 'Asesores',             icon: Users       },
  { to: '/admin/empresas',     label: 'Empresas',             icon: Building2   },
  { to: '/admin/asignaciones', label: 'Asignaciones',         icon: LayoutDashboard },
  { to: '/admin/mercado',      label: 'Indicadores mercado',  icon: Activity    },
]

const ASESOR_NAV = [
  { to: '/asesor',               label: 'Panel general',       icon: LayoutDashboard, section: 'panel'      },
  { to: '/balance',              label: 'Análisis de balance', icon: BookOpen,        section: 'diagnostico' },
  { to: '/diagnostico-profundo', label: 'Alma de la empresa',  icon: Brain,           section: 'diagnostico' },
  { to: '/informe-final',        label: 'Mapa de capital',     icon: Compass,         section: 'diagnostico' },
  { to: '/informe-nexxo',        label: 'Informe diagnóstico', icon: FileText,        section: 'diagnostico' },
  { to: '/cfo',                  label: 'CFO — Gestión',       icon: BarChart3,       section: 'gestion'    },
  { to: '/documentos',           label: 'Documentos',          icon: FolderOpen,      section: 'gestion'    },
  { to: '/mensajes',             label: 'Mensajes',            icon: MessageCircle,   section: 'gestion', badge: true },
]

const CLIENTE_NAV = [
  { to: '/',            label: 'Dashboard',            icon: LayoutDashboard, end: true },
  { to: '/mi-perfil',  label: 'Mi perfil financiero', icon: ClipboardList   },
  { to: '/mi-informe', label: 'Mi informe',           icon: FileText        },
  { to: '/mi-ruta',    label: 'Mi ruta al mercado',   icon: TrendingUp      },
  { to: '/documentos', label: 'Mis documentos',       icon: FolderOpen      },
  { to: '/mensajes',   label: 'Mensajes',             icon: MessageCircle, badge: true },
]

// ── Selector de empresa ─────────────────────────────────────────────
const ETAPA_LABEL_MAP = { 1:'Onboarding', 2:'Diagnóstico', 3:'CFO activo', 4:'Mercado', 5:'Estratégico' }

function EmpresaSelectorSidebar({ asesorId, empresaActiva, setEmpresaActiva }) {
  const [open,     setOpen]     = useState(false)
  const [empresas, setEmpresas] = useState([])

  useEffect(() => {
    if (!asesorId) return
    supabase.from('asignaciones')
      .select('empresa_id, empresas(id, nombre, rubro, etapa_numero)')
      .eq('asesor_id', asesorId)
      .then(({ data }) => setEmpresas((data || []).map(a => a.empresas).filter(Boolean)))
  }, [asesorId])

  return (
    <div className="px-3 pb-3 relative" style={{ borderBottom: '1px solid var(--nx-line)' }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full text-left px-3 py-2.5 transition-colors"
        style={{ background: 'var(--nx-off)', border: '1px solid var(--nx-light)', borderRadius: 2 }}>
        {empresaActiva ? (
          <div>
            <p className="text-[11px] font-bold truncate" style={{ color: 'var(--nx-black)' }}>{empresaActiva.nombre}</p>
            <p className="text-[9px] mt-0.5 truncate" style={{ color: 'var(--nx-topo)' }}>{empresaActiva.rubro || 'Sin rubro'}</p>
          </div>
        ) : (
          <span className="text-[10px] font-semibold" style={{ color: 'var(--nx-amber)' }}>Seleccioná una empresa</span>
        )}
      </button>
      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-white z-50 overflow-hidden max-h-64 overflow-y-auto"
          style={{ border: '1px solid var(--nx-light)', boxShadow: 'var(--nx-shadow-md)' }}>
          {empresas.map(emp => (
            <button key={emp.id}
              onClick={() => { setEmpresaActiva({ id: emp.id, nombre: emp.nombre, rubro: emp.rubro, etapa_numero: emp.etapa_numero }); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors"
              style={{ borderBottom: '1px solid var(--nx-off)', background: empresaActiva?.id === emp.id ? 'var(--nx-black)' : 'white' }}>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold truncate" style={{ color: empresaActiva?.id === emp.id ? 'white' : 'var(--nx-black)' }}>{emp.nombre}</p>
                <p className="text-[9px] truncate" style={{ color: empresaActiva?.id === emp.id ? 'var(--nx-topo)' : 'var(--nx-gray)' }}>{emp.rubro || '—'}</p>
              </div>
              <span className="text-[8px] font-bold uppercase tracking-wider ml-2 flex-shrink-0" style={{ color: empresaActiva?.id === emp.id ? 'var(--nx-topo)' : 'var(--nx-topo-lt)' }}>
                {ETAPA_LABEL_MAP[emp.etapa_numero] || 'Onboarding'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── CompanySelector (topbar) ────────────────────────────────────────
function CompanySelector({ asesorId, empresaActiva, setEmpresaActiva }) {
  const [open, setOpen]       = useState(false)
  const [empresas, setEmpresas] = useState([])
  const ref = useRef(null)

  useEffect(() => {
    if (!asesorId) return
    supabase.from('asignaciones')
      .select('empresa_id, empresas(id, nombre, rubro, etapa_numero)')
      .eq('asesor_id', asesorId)
      .then(({ data }) => setEmpresas((data || []).map(a => a.empresas).filter(Boolean)))
  }, [asesorId])

  useEffect(() => {
    if (!open) return
    function onOut(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  const initials = empresaActiva?.nombre
    ? empresaActiva.nombre.slice(0, 2).toUpperCase()
    : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '5px 10px', cursor: 'pointer',
          border: empresaActiva
            ? '1px solid var(--nx-line)'
            : '1px dashed var(--nx-amber)',
          background: empresaActiva ? 'white' : 'var(--nx-amber-bg)',
          borderRadius: 6, transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (empresaActiva) e.currentTarget.style.background = 'var(--nx-off)' }}
        onMouseLeave={e => { if (empresaActiva) e.currentTarget.style.background = 'white' }}
      >
        {/* Avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: 5, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: empresaActiva ? 'var(--nx-indigo-bg)' : 'var(--nx-light)',
        }}>
          {empresaActiva
            ? <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--nx-indigo)' }}>{initials}</span>
            : <Building2 size={13} style={{ color: 'var(--nx-topo)' }} />}
        </div>

        {/* Nombre + sub — se oculta en mobile */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}
          className="hidden md:flex">
          {empresaActiva ? (
            <>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--nx-black)', lineHeight: 1.25,
                maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {empresaActiva.nombre}
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--nx-gray)', lineHeight: 1.1 }}>
                {[empresaActiva.rubro, ETAPA_LABEL_MAP[empresaActiva.etapa_numero]].filter(Boolean).join(' · ')}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--nx-amber)' }}>
              Seleccionar empresa
            </span>
          )}
        </div>

        <ChevronDown size={13} style={{ color: empresaActiva ? 'var(--nx-topo)' : 'var(--nx-amber)', flexShrink: 0 }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          minWidth: 320, maxHeight: 280, overflowY: 'auto', zIndex: 200,
          background: 'white', borderRadius: 8,
          border: '1px solid var(--nx-line)', boxShadow: 'var(--nx-shadow-md)',
        }}>
          {empresas.length === 0 ? (
            <p style={{ padding: '16px 14px', fontSize: 12, color: 'var(--nx-topo)', textAlign: 'center' }}>
              No tenés empresas asignadas
            </p>
          ) : (
            empresas.map(emp => {
              const isActive = empresaActiva?.id === emp.id
              const ini = emp.nombre.slice(0, 2).toUpperCase()
              return (
                <button key={emp.id}
                  onClick={() => { setEmpresaActiva({ id: emp.id, nombre: emp.nombre, rubro: emp.rubro, etapa_numero: emp.etapa_numero }); setOpen(false) }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px', cursor: 'pointer', textAlign: 'left',
                    background: isActive ? 'var(--nx-off)' : 'white',
                    borderBottom: '1px solid var(--nx-off)', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--nx-off)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'white' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 5, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive ? 'var(--nx-indigo-bg)' : 'var(--nx-off)',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? 'var(--nx-indigo)' : 'var(--nx-topo)' }}>
                      {ini}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--nx-black)', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {emp.nombre}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--nx-gray)', margin: 0 }}>
                      {[emp.rubro, ETAPA_LABEL_MAP[emp.etapa_numero]].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  {isActive && <CheckCircle size={14} style={{ color: 'var(--nx-indigo)', flexShrink: 0 }} />}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ── NavItem rediseñado ──────────────────────────────────────────────
function NavItem({ to, label, icon: Icon, end, badge, unread }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => clsx(
        'flex items-center gap-2 px-2 py-1.5 transition-colors',
        isActive
          ? 'text-white font-semibold'
          : 'font-normal'
      )}
      style={({ isActive }) => isActive
        ? { background: 'var(--nx-black)', borderRadius: 2, color: 'white', fontSize: 11 }
        : { color: 'var(--nx-gray)', fontSize: 11, borderRadius: 2 }
      }
    >
      <Icon size={13} className="flex-shrink-0 opacity-80" />
      <span className="flex-1">{label}</span>
      {badge && unread > 0 && (
        <span className="w-4 h-4 rounded-full text-white text-[8px] flex items-center justify-center font-bold flex-shrink-0"
          style={{ background: 'var(--nx-red)' }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </NavLink>
  )
}

// ── NavSection ──────────────────────────────────────────────────────
function NavSection({ title, children }) {
  return (
    <div className="mb-1">
      <p className="px-2 py-2 font-bold uppercase"
        style={{ fontSize: 8, letterSpacing: '0.22em', color: 'var(--nx-topo-lt)' }}>
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

// ── Topbar ──────────────────────────────────────────────────────────
const BREADCRUMB_MAP = {
  '/':             ['Dashboard'],
  '/mi-perfil':    ['Mi perfil financiero'],
  '/mi-informe':   ['Mi informe'],
  '/mi-ruta':      ['Mi ruta al mercado'],
  '/documentos':   ['Documentos'],
  '/mensajes':     ['Mensajes'],
  '/asesor':       ['Panel de asesor'],
  '/balance':      ['Análisis de balance'],
  '/informe-final': ['Mapa de capital'],
  '/informe-nexxo': ['Informe diagnóstico'],
  '/admin':         ['Administración'],
}

function Topbar({ empresa, etapa, showCompanySelector, asesorId, empresaActiva, setEmpresaActiva }) {
  const { pathname } = useLocation()
  const crumbs = BREADCRUMB_MAP[pathname] || [pathname.replace('/', '').replace(/-/g, ' ')]
  const fecha  = new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' })

  const ETAPA_LABELS = { 1:'Onboarding', 2:'Diagnóstico', 3:'CFO Activo', 4:'Mercado', 5:'Estratégico' }
  const etLabel = ETAPA_LABELS[etapa] || 'Onboarding'

  return (
    <div className="flex items-center justify-between px-6 flex-shrink-0 bg-white"
      style={{ height: 52, borderBottom: '1px solid var(--nx-line)' }}>

      {/* Izquierda: breadcrumb + separator + company selector */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 flex-shrink-0"
          style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <span style={{ color: 'var(--nx-topo-lt)' }}>NEXXO</span>
          <span style={{ color: 'var(--nx-topo-xl)' }}>›</span>
          {crumbs.map((c, i) => (
            <span key={i} style={{ color: i === crumbs.length - 1 ? 'var(--nx-black)' : 'var(--nx-topo-lt)' }}>{c}</span>
          ))}
        </div>

        {/* Separator + Company selector (solo asesor) */}
        {showCompanySelector && (
          <>
            <div style={{ width: 1, height: 20, background: 'var(--nx-line)', flexShrink: 0 }} />
            <CompanySelector
              asesorId={asesorId}
              empresaActiva={empresaActiva}
              setEmpresaActiva={setEmpresaActiva}
            />
          </>
        )}
      </div>

      {/* Derecha: fecha + etapa badge */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="font-mono" style={{ fontSize: 9, color: 'var(--nx-topo)' }}>{fecha}</span>
        {etapa > 0 && (
          <span className="font-bold uppercase px-2.5 py-1"
            style={{ fontSize: 8, letterSpacing: '0.12em',
              background: 'var(--nx-indigo-bg)', color: 'var(--nx-indigo)',
              border: '1px solid var(--nx-indigo-bd)', borderRadius: 2 }}>
            {etLabel}
          </span>
        )}
      </div>
    </div>
  )
}

// ── AppShell principal ──────────────────────────────────────────────
export default function AppShell() {
  const { profile, empresa, isAdmin, isAsesor, isImpersonating, stopImpersonating, signOut, empresaActiva, setEmpresaActiva } = useAuth()
  const navigate = useNavigate()
  const [unreadMsgs, setUnreadMsgs] = useState(0)

  useEffect(() => { document.title = 'NEXXO CAPITAL' }, [])

  useEffect(() => {
    const empId = empresa?.id
    if (!empId) { setUnreadMsgs(0); return }
    const rolOtro = (isAsesor || isAdmin) ? 'cliente' : 'asesor'
    supabase.from('mensajes').select('id', { count:'exact', head:true })
      .eq('empresa_id', empId).eq('remitente_rol', rolOtro).eq('leido', false)
      .then(({ count }) => setUnreadMsgs(count || 0))
  }, [empresa?.id, isAsesor, isAdmin])

  async function handleSignOut() { await signOut(); navigate('/login') }
  function handleStopImpersonating() { stopImpersonating(); navigate(isAdmin ? '/admin' : '/asesor') }

  const navItems = isAdmin && !isImpersonating ? ADMIN_NAV
    : (isAsesor && !isImpersonating) ? ASESOR_NAV : CLIENTE_NAV
  const renderAsesorNav = isAsesor && !isImpersonating

  // Iniciales para el avatar
  const empNombre = isImpersonating ? empresa?.nombre : (isAsesor ? (empresaActiva?.nombre || '') : empresa?.nombre || '')
  const initials  = empNombre ? empNombre.slice(0, 2).toUpperCase() : (profile?.nombre || '?').slice(0, 2).toUpperCase()

  const displayName = isImpersonating ? empresa?.nombre : isAdmin ? profile?.nombre : isAsesor ? profile?.nombre : empresa?.nombre || 'Mi empresa'
  const rolLabel    = isImpersonating ? 'Vista cliente' : isAdmin ? 'Administración' : isAsesor ? 'Asesor financiero' : 'Portal cliente'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--nx-off)' }}>

      {/* ── Sidebar NEXXO ── */}
      <aside className="w-[210px] bg-white flex flex-col flex-shrink-0 relative"
        style={{ borderRight: '1px solid var(--nx-line)' }}>

        {/* Acento izquierdo degradado */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px] z-10"
          style={{ background: 'linear-gradient(to bottom, #4F46E5 0%, #A8A093 60%, transparent 100%)' }} />

        {/* Logo */}
        <div className="flex items-center gap-3 pl-[22px] pr-4"
          style={{ paddingTop: 22, paddingBottom: 18, borderBottom: '1px solid var(--nx-line)' }}>
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 8L20 24L6 40"  stroke="#111417" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 8L28 24L14 40" stroke="#111417" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M42 8L28 24L42 40" stroke="#A8A093" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="w-px h-[30px] bg-[var(--nx-light)]" />
          <div className="flex flex-col leading-tight">
            <span style={{ fontSize: 11.5, fontWeight: 900, letterSpacing: '0.2em', color: 'var(--nx-black)' }}>NEXXO</span>
            <span style={{ fontSize: 7.5, fontWeight: 500, letterSpacing: '0.38em', color: 'var(--nx-topo)' }}>CAPITAL</span>
          </div>
        </div>

        {/* Avatar + empresa */}
        {!isAdmin && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--nx-line)' }}>
            <div className="w-8 h-8 rounded-sm flex items-center justify-center mb-2 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #1e1b4b, #4F46E5)' }}>
              <span className="text-[11px] font-black text-white">{initials}</span>
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--nx-black)' }} className="truncate">{displayName}</p>
            <p style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--nx-topo)' }}>{rolLabel}</p>
          </div>
        )}

        {/* Selector empresa movido al topbar */}

        {/* Banner impersonando */}
        {isImpersonating && (
          <div className="mx-3 my-2 px-3 py-2 flex items-center justify-between"
            style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 2 }}>
            <span style={{ fontSize: 9, color: '#92400e', fontWeight: 600 }} className="truncate">Viendo: {empresa?.nombre}</span>
            <button onClick={handleStopImpersonating} style={{ fontSize: 8, color: '#92400e', fontWeight: 700 }}>✕</button>
          </div>
        )}

        {/* Navegación */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          {renderAsesorNav ? (
            <>
              <NavSection title="Panel">
                {navItems.filter(i => i.section === 'panel').map(item => (
                  <NavItem key={item.to} {...item} unread={item.badge ? unreadMsgs : 0} />
                ))}
              </NavSection>
              <NavSection title="Diagnóstico">
                {navItems.filter(i => i.section === 'diagnostico').map(item => (
                  <NavItem key={item.to} {...item} unread={item.badge ? unreadMsgs : 0} />
                ))}
              </NavSection>
              <NavSection title="Gestión">
                {navItems.filter(i => i.section === 'gestion').map(item => (
                  <NavItem key={item.to} {...item} unread={item.badge ? unreadMsgs : 0} />
                ))}
              </NavSection>
            </>
          ) : (
            <>
              <p className="px-2 py-2 font-bold uppercase"
                style={{ fontSize: 8, letterSpacing: '0.22em', color: 'var(--nx-topo-lt)' }}>
                Navegación
              </p>
              <div className="space-y-0.5">
                {navItems.map(item => (
                  <NavItem key={item.to} {...item} unread={item.badge ? unreadMsgs : 0} />
                ))}
              </div>
            </>
          )}
        </nav>

        {/* Tagline + Sign out */}
        <div className="px-4 py-4" style={{ borderTop: '1px solid var(--nx-line)' }}>
          <p className="italic mb-3" style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: 'var(--nx-topo)' }}>
            Orden financiero. Acceso a capital.
          </p>
          <button onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-2 py-1.5 transition-colors"
            style={{ fontSize: 11, color: 'var(--nx-gray)', borderRadius: 2 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--nx-off)'; e.currentTarget.style.color = 'var(--nx-black)' }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--nx-gray)' }}>
            <LogOut size={12} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar — clientes, asesor (con company selector) e impersonando */}
        {(!isAdmin || isImpersonating) && (
          <Topbar
            empresa={empresa}
            etapa={empresa?.etapa_numero || 1}
            showCompanySelector={isAsesor && !isImpersonating}
            asesorId={profile?.id}
            empresaActiva={empresaActiva}
            setEmpresaActiva={setEmpresaActiva}
          />
        )}

        <main className="flex-1 overflow-hidden flex flex-col">
          <Outlet />
        </main>
      </div>

    </div>
  )
}
