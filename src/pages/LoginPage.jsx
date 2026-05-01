import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const navigate   = useNavigate()
  const { session, loading: authLoading } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    if (!authLoading && session) {
      navigate('/', { replace: true })
    }
  }, [session, authLoading])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Usuario o contraseña incorrectos.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F4F1] flex items-center justify-center p-4">

      <div className="relative w-full max-w-sm animate-fade-in">

        {/* ── Logo NEXXO CAPITAL ── */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
               xmlns="http://www.w3.org/2000/svg">
            <path d="M6 8L20 24L6 40"  stroke="#111417" strokeWidth="4"
                  strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 8L28 24L14 40" stroke="#111417" strokeWidth="4"
                  strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M42 8L28 24L42 40" stroke="#A8A093" strokeWidth="4"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="w-px h-10 bg-[#EDEDED]" />
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-black tracking-[0.18em] text-[#111417]">
              NEXXO
            </span>
            <span className="text-[9px] font-medium tracking-[0.35em] text-[#A8A093]">
              CAPITAL
            </span>
          </div>
        </div>

        {/* ── Card del formulario ── */}
        <div className="bg-white shadow-sm border border-[#EDEDED] rounded-sm px-6 sm:px-8 pt-6 sm:pt-8 pb-7">

          <h1 className="text-2xl font-light text-[#111417] mb-1"
              style={{ fontFamily: 'Georgia, serif' }}>
            Bienvenido
          </h1>
          <p className="text-xs text-[#A8A093] tracking-wide mb-7">
            Ingresá con tus credenciales
          </p>

          {error && (
            <div className="flex items-start gap-2.5 p-3 border-l-4 border-red-500 bg-red-50 mb-5">
              <span className="text-xs text-red-700">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B6B6B] mb-1.5">
                Email
              </label>
              <input
                type="email"
                placeholder="empresa@ejemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full border border-[#EDEDED] focus:border-[#111417] focus:ring-0
                           rounded-sm bg-white text-[#111417] text-sm px-3 py-2.5 outline-none
                           placeholder-[#C4B9AD] transition-colors duration-150"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B6B6B] mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full border border-[#EDEDED] focus:border-[#111417] focus:ring-0
                             rounded-sm bg-white text-[#111417] text-sm px-3 py-2.5 outline-none
                             placeholder-[#C4B9AD] transition-colors duration-150 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#A8A093] hover:text-[#111417] transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || authLoading}
              className="w-full py-3 text-xs font-bold uppercase tracking-wider rounded-sm
                         transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                         mt-2"
              style={{ backgroundColor: loading || authLoading ? '#A8A093' : '#111417', color: '#FFFFFF' }}
              onMouseEnter={e => { if (!loading && !authLoading) e.currentTarget.style.backgroundColor = '#A8A093' }}
              onMouseLeave={e => { if (!loading && !authLoading) e.currentTarget.style.backgroundColor = '#111417' }}
            >
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        {/* ── Texto y tagline ── */}
        <p className="text-center text-xs text-[#A8A093] mt-4">
          ¿Problemas para ingresar? Contactá a tu asesor.
        </p>

        <p className="text-xs italic text-[#A8A093] mt-6 text-center"
           style={{ fontFamily: 'Georgia, serif' }}>
          Orden financiero. Acceso a capital.
        </p>

      </div>
    </div>
  )
}
