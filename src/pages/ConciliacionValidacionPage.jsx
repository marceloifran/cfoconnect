import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import MovimientoRow from '@/components/conciliacion/MovimientoRow'
import { cerrarExtracto } from '@/lib/conciliacion'

export default function ConciliacionValidacionPage() {
  const { extractoId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  
  const [extracto, setExtracto] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pendientes')
  const [cerrando, setCerrando] = useState(false)
  
  // Fake list of cuentas for MVP
  const cuentas = [
    'Ingresos operativos', 'Cobro de clientes', 'Pagos a proveedores',
    'Sueldos', 'Cargas sociales', 'Impuestos', 'Cargas bancarias',
    'Intereses bancarios', 'Rescate FCI', 'Suscripción FCI'
  ]

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const [extRes, movRes] = await Promise.all([
        supabase.from('conciliacion_extractos').select('*').eq('id', extractoId).single(),
        supabase.from('conciliacion_movimientos').select('*').eq('extracto_id', extractoId).order('fecha', { ascending: false })
      ])
      
      if (extRes.data) setExtracto(extRes.data)
      if (movRes.data) setMovimientos(movRes.data)
      setLoading(false)
    }
    loadData()
  }, [extractoId])

  const handleConfirmar = async (id) => {
    // Optimistic UI update
    setMovimientos(prev => prev.map(m => m.id === id ? { ...m, validado: true, validado_por: profile.id, confianza: 'manual' } : m))
    
    // DB update
    await supabase.from('conciliacion_movimientos')
      .update({ validado: true, validado_por: profile.id, validado_at: new Date().toISOString(), confianza: 'manual' })
      .eq('id', id)
  }

  const handleCambiarCuenta = (id, nuevaCuenta) => {
    setMovimientos(prev => prev.map(m => m.id === id ? { ...m, cuenta_nombre: nuevaCuenta } : m))
  }

  const handleCerrar = async () => {
    try {
      setCerrando(true)
      await cerrarExtracto(extractoId, supabase)
      navigate('/conciliacion')
    } catch (err) {
      alert(err.message)
    } finally {
      setCerrando(false)
    }
  }

  if (loading) return <div className="p-8 text-slate-500 text-sm">Cargando extracto...</div>
  if (!extracto) return <div className="p-8 text-slate-500 text-sm">Extracto no encontrado</div>

  const pendientes = movimientos.filter(m => !m.validado && m.confianza !== 'alta')
  const autoClasificados = movimientos.filter(m => !m.validado && m.confianza === 'alta')
  const validados = movimientos.filter(m => m.validado)
  const atipicos = movimientos.filter(m => m.es_atipico)

  const tabs = [
    { id: 'pendientes', label: `Pendientes (${pendientes.length})` },
    { id: 'auto', label: `Auto-clasificados (${autoClasificados.length})` },
    { id: 'validados', label: `Validados (${validados.length})` },
    { id: 'atipicos', label: `Atípicos (${atipicos.length})` }
  ]

  const currentList = activeTab === 'pendientes' ? pendientes :
                      activeTab === 'auto' ? autoClasificados :
                      activeTab === 'validados' ? validados : atipicos

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Barra superior (sticky) */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/conciliacion')} className="text-slate-400 hover:text-slate-600 font-bold text-sm">← Volver</button>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-500">Ini: <span className="font-mono font-medium text-slate-800">${extracto.saldo_inicial?.toLocaleString()}</span></span>
            <span className="text-emerald-600 font-mono">+ ${extracto.total_creditos?.toLocaleString()}</span>
            <span className="text-red-600 font-mono">- ${extracto.total_debitos?.toLocaleString()}</span>
            <span className="text-slate-500">Fin: <span className="font-mono font-medium text-slate-800">${extracto.saldo_final?.toLocaleString()}</span></span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-slate-500">{pendientes.length} pendientes · {Math.round((validados.length + autoClasificados.length) / (movimientos.length || 1) * 100) || 0}% completado</span>
          <button 
            disabled={pendientes.length > 0 || cerrando}
            onClick={handleCerrar}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
          >
            {cerrando ? 'Cerrando...' : 'Cerrar extracto'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-slate-200 bg-white">
        <nav className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto bg-white m-6 rounded-xl border border-slate-200 shadow-sm">
        {currentList.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No hay movimientos en esta sección.</div>
        ) : (
          <div className="flex flex-col">
            {currentList.map(mov => (
              <MovimientoRow 
                key={mov.id}
                movimiento={mov}
                cuentas={cuentas}
                onCambiarCuenta={handleCambiarCuenta}
                onConfirmar={handleConfirmar}
                onAgregarNota={() => {}}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
