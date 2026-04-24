import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard, FileSearch, BarChart3, TrendingUp,
  FileText, Building2, BellRing, LogOut, ChevronRight
} from 'lucide-react'
import clsx from 'clsx'

// Nav items by role
const ASESOR_NAV = [
  { to: '/asesor',          label: 'Panel general',    icon: LayoutDashboard },
  { to: '/asesor/empresas', label: 'Empresas',         icon: Building2 },
  { to: '/asesor/alertas',  label: 'Alertas',          icon: BellRing },
]

const CLIENTE_NAV = [
  { to: '/',             label: 'Dashboard',          icon: LayoutDashboard, end: true },
  { to: '/diagnostico',  label: 'Diagnóstico',        icon: FileSearch },
  { to: '/cfo',          label: 'CFO — Gestión',      icon: BarChart3 },
  { to: '/mercado',      label: 'Mercado capitales',  icon: TrendingUp },
  { to: '/reportes',     label: 'Reportes',           icon: FileText },
]

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => clsx(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150',
        isActive
          ? 'bg-brand-50 text-brand-800 font-medium'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      )}
    >
      <Icon size={16} className="flex-shrink-0" />
      {label}
    </NavLink>
  )
}

export default function AppShell() {
  const { profile, empresa, isAsesor, signOut } = useAuth()
  const navigate = useNavigate()
  const navItems = isAsesor ? ASESOR_NAV : CLIENTE_NAV

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const displayName = isAsesor
    ? profile?.nombre || 'Asesor'
    : empresa?.nombre || 'Mi empresa'

  const subName = isAsesor
    ? 'Panel de asesor'
    : empresa?.rubro || ''

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center gap-2 px-4 border-b border-slate-200">
          <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={14} className="text-white" />
          </div>
          <span className="font-semibold text-navy-800 text-base tracking-tight">
            CFO<span className="text-brand-600">Connect</span>
          </span>
        </div>

        {/* Company/user info */}
        <div className="px-3 py-3 border-b border-slate-100">
          <div className="px-2 py-2 rounded-lg bg-slate-50">
            <p className="text-xs font-medium text-navy-700 truncate">{displayName}</p>
            <p className="text-xs text-slate-400 truncate">{subName}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          <p className="section-title px-2 pt-1">Navegación</p>
          {navItems.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-3 border-t border-slate-100">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm
                       text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
