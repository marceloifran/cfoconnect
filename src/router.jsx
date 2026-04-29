import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import DiagnosticoPage from '@/pages/DiagnosticoPage'
import DiagnosticoResultados from '@/pages/DiagnosticoResultados'
import BalancePage from '@/pages/BalancePage'
import CFOPage from '@/pages/CFOPage'
import DiagnosticoProfundoPage from '@/pages/DiagnosticoProfundoPage'
import InformeFinalPage from '@/pages/InformeFinalPage'
import InformeNexxoPage from '@/pages/InformeNexxoPage'
import AsesorPage from '@/pages/AsesorPage'
import AdminPage from '@/pages/AdminPage'
import AdminAsesoresPage from '@/pages/AdminAsesoresPage'
import AdminEmpresasPage from '@/pages/AdminEmpresasPage'
import AdminAsignacionesPage from '@/pages/AdminAsignacionesPage'
import AdminMercadoPage from '@/pages/AdminMercadoPage'
import DocumentosPage from '@/pages/DocumentosPage'
import MensajesPage from '@/pages/MensajesPage'
import MiInformePage from '@/pages/MiInformePage'
import MiRutaPage from '@/pages/MiRutaPage'

// ── Placeholder ───────────────────────────────────────────────────────────────
function ComingSoon({ title }) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="h-14 flex items-center px-6 bg-white border-b border-slate-200">
        <h1 className="text-base font-semibold text-navy-800">{title}</h1>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🚧</span>
          </div>
          <p className="text-sm font-medium text-navy-700 mb-1">{title}</p>
          <p className="text-xs text-slate-400">Módulo en construcción — próxima fase</p>
        </div>
      </div>
    </div>
  )
}

// ── Guards ────────────────────────────────────────────────────────────────────
function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  return children
}

function RequireRole({ role, children }) {
  const { profile, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (profile?.rol !== role) return <Navigate to="/" replace />
  return children
}

function RoleRouter() {
  const { session, profile, loading } = useAuth()
  console.log('[RoleRouter] loading:', loading, 'session:', !!session, 'rol:', profile?.rol)
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  if (profile?.rol === 'admin')  return <Navigate to="/admin"   replace />
  if (profile?.rol === 'asesor') return <Navigate to="/asesor"  replace />
  return <Navigate to="/dashboard" replace />
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-sm text-slate-400">Cargando...</div>
    </div>
  )
}

// ── Rutas ─────────────────────────────────────────────────────────────────────
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — todas dentro del AppShell */}
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>

          {/* Root — redirige según rol */}
          <Route index element={<RoleRouter />} />

          {/* ── Admin ─────────────────────────────────────────── */}
          <Route path="admin" element={<RequireRole role="admin"><AdminPage /></RequireRole>} />
          <Route path="admin/asesores"     element={<RequireRole role="admin"><AdminAsesoresPage /></RequireRole>} />
          <Route path="admin/empresas"     element={<RequireRole role="admin"><AdminEmpresasPage /></RequireRole>} />
          <Route path="admin/asignaciones" element={<RequireRole role="admin"><AdminAsignacionesPage /></RequireRole>} />
          <Route path="admin/mercado"      element={<RequireRole role="admin"><AdminMercadoPage /></RequireRole>} />

          {/* ── Cliente ──────────────────────────────────────── */}
          <Route path="dashboard"      element={<DashboardPage />} />
          <Route path="mi-perfil"      element={<DiagnosticoPage />} />
          <Route path="mi-informe"     element={<MiInformePage />} />
          <Route path="mi-ruta"        element={<MiRutaPage />} />
          <Route path="documentos"     element={<DocumentosPage />} />
          <Route path="mensajes"       element={<MensajesPage />} />
          {/* Redirigir rutas viejas del cliente */}
          <Route path="diagnostico"              element={<Navigate to="/mi-perfil" replace />} />
          <Route path="diagnostico/resultados"   element={<Navigate to="/mi-perfil" replace />} />
          <Route path="mercado"                  element={<Navigate to="/mi-ruta"   replace />} />
          <Route path="reportes"                 element={<Navigate to="/mi-informe" replace />} />
          {/* CFO solo para asesor/admin */}
          <Route path="cfo" element={<RequireRole role="asesor"><CFOPage /></RequireRole>} />

          {/* ── Asesor ────────────────────────────────────────── */}
          <Route path="asesor"          element={<RequireRole role="asesor"><AsesorPage /></RequireRole>} />
          <Route path="asesor/empresas" element={<RequireRole role="asesor"><ComingSoon title="Gestión de empresas" /></RequireRole>} />
          <Route path="asesor/alertas"  element={<RequireRole role="asesor"><ComingSoon title="Alertas globales" /></RequireRole>} />
          <Route path="balance"         element={<RequireRole role="asesor"><BalancePage /></RequireRole>} />
          <Route path="diagnostico-profundo" element={<RequireRole role="asesor"><DiagnosticoProfundoPage /></RequireRole>} />
          <Route path="informe-final"   element={<RequireRole role="asesor"><InformeFinalPage /></RequireRole>} />
          <Route path="informe-nexxo"   element={<RequireRole role="asesor"><InformeNexxoPage /></RequireRole>} />

        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
