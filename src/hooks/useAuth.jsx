import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

const LS_EMPRESA = 'cfoconnect_empresa_activa_asesor'

export function AuthProvider({ children }) {
  const [session,       setSession]  = useState(undefined)
  const [profile,       setProfile]  = useState(null)
  const [profileLoaded, setLoaded]   = useState(false)
  const [impersonatedEmpresa, setImpersonated] = useState(null)
  const [empresaActiva, _setEmpresaActiva] = useState(() => {
    try { const s = localStorage.getItem(LS_EMPRESA); return s ? JSON.parse(s) : null }
    catch { return null }
  })

  useEffect(() => {
    // Timeout de seguridad: si en 8s el perfil no cargó, desbloqueamos
    const safetyTimer = setTimeout(() => {
      console.warn('[useAuth] timeout de seguridad — desbloqueando loading')
      setLoaded(true)
    }, 8000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setLoaded(true); clearTimeout(safetyTimer) }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        setLoaded(false)
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoaded(true)
        setImpersonated(null)
      }
    })

    return () => { subscription.unsubscribe(); clearTimeout(safetyTimer) }
  }, [])

  async function fetchProfile(userId) {
    try {
      // Paso 1: traer datos del usuario
      const { data: usr, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) { console.warn('[useAuth] fetchProfile error:', error.message); setProfile(null); return }

      // Paso 2: si tiene empresa_id, traer la empresa por separado
      let empresa = null
      if (usr?.empresa_id) {
        const { data: emp } = await supabase
          .from('empresas')
          .select('*')
          .eq('id', usr.empresa_id)
          .single()
        empresa = emp || null
      }

      const perfil = usr ? { ...usr, empresas: empresa } : null
      console.log('[useAuth] profile:', perfil?.rol, perfil?.id)
      setProfile(perfil)
    } catch (e) {
      console.error('[useAuth] fetchProfile excepción:', e)
      setProfile(null)
    } finally {
      setLoaded(true)
    }
  }

  // Cuando el perfil carga y el usuario es asesor o admin, verificar impersonación
  useEffect(() => {
    if (!profile || !['asesor', 'admin'].includes(profile.rol)) { setImpersonated(null); return }
    const empId = localStorage.getItem('impersonating_empresa_id')
    if (!empId) { setImpersonated(null); return }
    supabase.from('empresas').select('*').eq('id', empId).single()
      .then(({ data }) => setImpersonated(data || null))
  }, [profile])

  function stopImpersonating() {
    localStorage.removeItem('impersonating_empresa_id')
    setImpersonated(null)
  }

  function setEmpresaActiva(emp) {
    _setEmpresaActiva(emp)
    if (emp) localStorage.setItem(LS_EMPRESA, JSON.stringify(emp))
    else localStorage.removeItem(LS_EMPRESA)
  }

  const isImpersonating = ['asesor', 'admin'].includes(profile?.rol) && !!impersonatedEmpresa

  const value = {
    session,
    profile,
    loading: session === undefined || !profileLoaded,
    isAdmin:   profile?.rol === 'admin',
    isAsesor:  profile?.rol === 'asesor',
    isCliente: profile?.rol === 'cliente',
    empresa: isImpersonating ? impersonatedEmpresa : profile?.empresas,
    isImpersonating,
    impersonatedEmpresa,
    stopImpersonating,
    empresaActiva,
    setEmpresaActiva,
    signOut: () => {
      stopImpersonating()
      setEmpresaActiva(null)
      return supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
