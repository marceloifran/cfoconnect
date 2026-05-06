import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { cerrarExtracto } from '@/lib/conciliacion'
import { ars } from '@/lib/financials'
import { obtenerFamilia, calcularTotalesFamilia } from '@/lib/categoriasConciliacion'
import ExtractoHeader from '@/components/conciliacion/ExtractoHeader'
import MovimientoRow from '@/components/conciliacion/MovimientoRow'
import DesgloseTabla from '@/components/conciliacion/DesgloseTabla'
import AnalisisAutomatico from '@/components/conciliacion/AnalisisAutomatico'

export default function ConciliacionValidacionPage() {
  const { extractoId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  
  const [extracto, setExtracto] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('movimientos')
  const [subTab, setSubTab] = useState('pendientes')
  const [cerrando, setCerrando] = useState(false)

  const [siblings, setSiblings] = useState({ prev: null, next: null })

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const [extRes, movRes] = await Promise.all([
        supabase.from('conciliacion_extractos').select('*').eq('id', extractoId).single(),
        supabase.from('conciliacion_movimientos').select('*').eq('extracto_id', extractoId).order('fecha', { ascending: false })
      ])
      
      if (extRes.data) {
        setExtracto(extRes.data)
        
        // Cargar extractos hermanos para navegación (misma empresa, banco y cuenta)
        let query = supabase
          .from('conciliacion_extractos')
          .select('id, periodo_desde')
          .eq('empresa_id', extRes.data.empresa_id)
          .eq('banco', extRes.data.banco)
        
        if (extRes.data.cuenta_numero) {
          query = query.eq('cuenta_numero', extRes.data.cuenta_numero)
        }

        const { data: allExts } = await query.order('periodo_desde', { ascending: true })
        
        if (allExts) {
          const currentIndex = allExts.findIndex(e => e.id === extractoId)
          setSiblings({
            prev: allExts[currentIndex - 1] || null,
            next: allExts[currentIndex + 1] || null
          })
        }
      }
      if (movRes.data) setMovimientos(movRes.data)
      setLoading(false)
    }
    loadData()
  }, [extractoId])

  const handleConfirmar = async (id) => {
    setMovimientos(prev => prev.map(m => m.id === id ? { ...m, validado: true, validado_por: profile.id, confianza: 'manual' } : m))
    await supabase.from('conciliacion_movimientos')
      .update({ validado: true, validado_por: profile.id, validado_at: new Date().toISOString(), confianza: 'manual' })
      .eq('id', id)
  }

  const handleCambiarCuenta = async (id, nuevaCuenta) => {
    setMovimientos(prev => prev.map(m => m.id === id ? { ...m, cuenta_nombre: nuevaCuenta } : m))
    await supabase.from('conciliacion_movimientos').update({ cuenta_nombre: nuevaCuenta }).eq('id', id)
  }

  const handleAgregarNota = async (id, notas) => {
    setMovimientos(prev => prev.map(m => m.id === id ? { ...m, notas } : m))
    await supabase.from('conciliacion_movimientos').update({ notas }).eq('id', id)
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

  if (loading) return <div className="p-8 text-slate-500 text-sm font-sans">Cargando extracto...</div>
  if (!extracto) return <div className="p-8 text-slate-500 text-sm font-sans">Extracto no encontrado</div>

  const pendientes = movimientos.filter(m => !m.validado && m.confianza !== 'alta')
  const autoClasificados = movimientos.filter(m => !m.validado && m.confianza === 'alta')
  const validados = movimientos.filter(m => m.validado)
  const atipicos = movimientos.filter(m => m.es_atipico)

  const totalesFamilia = calcularTotalesFamilia(movimientos)

  const tabs = [
    { id: 'movimientos', label: 'Movimientos' },
    { id: 'desglose', label: 'Desglose por categoría' },
    { id: 'comparativo', label: 'Comparativo mensual' },
    { id: 'analisis', label: 'Análisis automático' }
  ]

  const isCerrado = extracto.estado === 'cerrado'

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F5F4F1] font-sans">
      <ExtractoHeader 
        extracto={extracto} 
        movimientos={movimientos} 
        onCerrar={handleCerrar} 
        isCerrando={cerrando} 
      />

      <div className="flex-1 flex min-h-0">
        {/* SIDEBAR IZQUIERDO */}
        <div className="w-72 bg-white border-r border-slate-200 flex flex-col overflow-y-auto shrink-0">
          <div className="p-6 flex flex-col gap-8">
            {/* Titulo mes */}
            <div>
              <h2 className="text-xl font-bold text-[#111417] font-serif capitalize">
                {new Date(extracto.periodo_desde).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
              </h2>
              <p className="text-xs text-slate-500 capitalize">{extracto.banco} · {extracto.cuenta_numero || 'CC Pesos'}</p>
            </div>

            {/* Familias */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Familias</h3>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Ingresos', val: totalesFamilia.ingresos, color: 'text-emerald-600' },
                  { label: 'Pagos', val: totalesFamilia.pagos, color: 'text-red-600' },
                  { label: 'Financiero', val: totalesFamilia.financiero, color: 'text-amber-600' },
                  { label: 'Impositivo', val: totalesFamilia.impositivo, color: 'text-slate-600' },
                  { label: 'Estructura', val: totalesFamilia.estructura, color: 'text-slate-600' },
                  { label: 'Bancario', val: totalesFamilia.bancario, color: 'text-slate-600' },
                ].map(f => (
                  <div key={f.label} className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">{f.label}</span>
                    <span className={`font-mono font-medium ${f.color}`}>{f.val >= 0 ? '+' : ''}{ars(f.val)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Estado */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Estado</h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-600 font-bold">✓ {validados.length} validados</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-600 font-bold">⚠ {pendientes.length} pendientes</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-indigo-600 font-bold">★ {atipicos.length} atípicos</span>
                </div>
              </div>
            </div>

            {/* Selector de mes */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              {siblings.prev ? (
                <button 
                  onClick={() => navigate(`/conciliacion/${siblings.prev.id}`)}
                  className="text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-1"
                >
                  ◀ {new Date(siblings.prev.periodo_desde).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}
                </button>
              ) : <div className="w-10"/>}

              <span className="font-bold bg-slate-100 px-2 py-1 rounded text-navy-900">
                {new Date(extracto.periodo_desde).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}
              </span>

              {siblings.next ? (
                <button 
                  onClick={() => navigate(`/conciliacion/${siblings.next.id}`)}
                  className="text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-1"
                >
                  {new Date(siblings.next.periodo_desde).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })} ▶
                </button>
              ) : <div className="w-10"/>}
            </div>
          </div>
        </div>

        {/* ÁREA PRINCIPAL */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-6 bg-white border-b border-slate-200 shrink-0">
            <nav className="flex gap-8">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'movimientos' && (
              <div className="flex-1 flex flex-col m-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-4 flex gap-6">
                  {[
                    { id: 'pendientes', label: `Pendientes (${pendientes.length})` },
                    { id: 'auto', label: `Auto-clasificados (${autoClasificados.length})` },
                    { id: 'validados', label: `Validados (${validados.length})` },
                    { id: 'atipicos', label: `Atípicos (${atipicos.length})` }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSubTab(t.id)}
                      className={`py-3 text-xs font-bold tracking-wide uppercase border-b-2 transition-colors ${subTab === t.id ? 'border-navy-900 text-navy-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {(subTab === 'pendientes' ? pendientes : subTab === 'auto' ? autoClasificados : subTab === 'validados' ? validados : atipicos).map(mov => (
                    <MovimientoRow 
                      key={mov.id}
                      movimiento={mov}
                      onConfirmar={handleConfirmar}
                      onCambiarCuenta={handleCambiarCuenta}
                      onAgregarNota={handleAgregarNota}
                    />
                  ))}
                  {(subTab === 'pendientes' && pendientes.length === 0) && <div className="p-12 text-center text-slate-500 text-sm">No hay movimientos pendientes</div>}
                  {(subTab === 'atipicos' && atipicos.length === 0) && <div className="p-12 text-center text-slate-500 text-sm">No hay movimientos atípicos detectados</div>}
                </div>
              </div>
            )}

            {activeTab === 'desglose' && (
              <DesgloseTabla movimientos={movimientos} />
            )}

            {activeTab === 'comparativo' && (
              <div className="p-12 text-center text-slate-500 text-sm bg-white m-6 rounded-xl border border-slate-200 shadow-sm">
                Módulo Comparativo Mensual (En desarrollo)
              </div>
            )}

            {activeTab === 'analisis' && (
              isCerrado ? (
                <AnalisisAutomatico extracto={extracto} movimientos={movimientos} />
              ) : (
                <div className="p-12 text-center text-slate-500 text-sm bg-white m-6 rounded-xl border border-slate-200 shadow-sm">
                  El extracto debe estar cerrado para ver el análisis inteligente.
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

