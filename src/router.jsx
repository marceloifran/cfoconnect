import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import DiagnosticoPage from '@/pages/DiagnosticoPage'
import AsesorPage from '@/pages/AsesorPage'

// ── Placeholder pages (se reemplazan en fases siguientes) ──────────────────
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

// ── Route guards ───────────────────────────────────────────────────────────
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
  const { isAsesor, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return isAsesor
    ? <Navigate to="/asesor" replace />
    : <Navigate to="/dashboard" replace />
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-sm text-slate-400">Cargando...</div>
    </div>
  )
}

// ── App routes ─────────────────────────────────────────────────────────────
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected */}
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          {/* Root redirect by role */}
          <Route index element={<RoleRouter />} />

          {/* Client routes */}
          <Route path="dashboard"   element={<DashboardPage />} />
          <Route path="diagnostico" element={<DiagnosticoPage />} />
          <Route path="cfo"         element={<ComingSoon title="CFO — Gestión mensual" />} />
          <Route path="mercado"     element={<ComingSoon title="Mercado de capitales" />} />
          <Route path="reportes"    element={<ComingSoon title="Reportes" />} />

          {/* Advisor routes */}
          <Route
            path="asesor"
            element={
              <RequireRole role="asesor">
                <AsesorPage />
              </RequireRole>
            }
          />
          <Route
            path="asesor/empresas"
            element={
              <RequireRole role="asesor">
                <ComingSoon title="Gestión de empresas" />
              </RequireRole>
            }
          />
          <Route
            path="asesor/alertas"
            element={
              <RequireRole role="asesor">
                <ComingSoon title="Alertas globales" />
              </RequireRole>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
