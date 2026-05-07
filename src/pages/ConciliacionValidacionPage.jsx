import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { cerrarExtracto } from '@/lib/conciliacion'
import { ars } from '@/lib/financials'
import { obtenerFamilia, calcularTotalesFamilia } from '@/lib/categoriasConciliacion'
import { clasificarExtracto } from '@/lib/conciliacion/motorMatching'
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
  const [reclasificando, setReclasificando] = useState(false)

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
    setMovimientos(prev => prev.map(m => m.id === id
      ? { ...m, validado: true, validado_por: profile.id, confianza: 'manual', estado: 'validado' }
      : m
    ))
    await supabase.from('conciliacion_movimientos')
      .update({
        validado: true,
        validado_por: profile.id,
        validado_at: new Date().toISOString(),
        confianza: 'manual',
        estado: 'validado'
      })
      .eq('id', id)
  }

  const handleCambiarCuenta = async (id, nuevaCuenta) => {
    const mov = movimientos.find(m => m.id === id)
    // Si era 'auto' y el usuario lo corrige manualmente, pasa a 'sugerido'
    const nuevoEstado = mov?.estado === 'auto' ? 'sugerido' : mov?.estado
    setMovimientos(prev => prev.map(m =>
      m.id === id ? { ...m, cuenta_nombre: nuevaCuenta, estado: nuevoEstado } : m
    ))
    const update = { cuenta_nombre: nuevaCuenta }
    if (nuevoEstado) update.estado = nuevoEstado
    await supabase.from('conciliacion_movimientos').update(update).eq('id', id)
  }

  const handleConfirmarTodosAuto = async () => {
    if (autoClasificados.length === 0) return
    setMovimientos(prev => prev.map(m =>
      m.estado === 'auto' ? { ...m, validado: true, estado: 'validado', confianza: 'manual' } : m
    ))
    await supabase.from('conciliacion_movimientos')
      .update({ validado: true, estado: 'validado', validado_por: profile.id, validado_at: new Date().toISOString() })
      .eq('extracto_id', extractoId)
      .eq('estado', 'auto')
  }

  const handleReclasificar = async () => {
    setReclasificando(true)
    try {
      const stats = await clasificarExtracto(extractoId, { usarLLM: true })
      const [extRes, movRes] = await Promise.all([
        supabase.from('conciliacion_extractos').select('*').eq('id', extractoId).single(),
        supabase.from('conciliacion_movimientos').select('*').eq('extracto_id', extractoId).order('fecha', { ascending: false })
      ])
      if (extRes.data) setExtracto(extRes.data)
      if (movRes.data) setMovimientos(movRes.data)
      alert(`Re-clasificación completa: ${stats.auto} auto, ${stats.sug} sugeridos, ${stats.pend} pendientes`)
    } catch (err) {
      alert('Error al re-clasificar: ' + err.message)
    } finally {
      setReclasificando(false)
    }
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

  const autoClasificados = movimientos.filter(m => !m.validado && m.estado === 'auto')
  const sugeridos        = movimientos.filter(m => !m.validado && m.estado === 'sugerido')
  const sinClasificar    = movimientos.filter(m => !m.validado && (m.estado === 'pendiente' || (!m.estado && !m.validado)))
  const validados        = movimientos.filter(m => m.validado || m.estado === 'validado')
  const atipicos         = movimientos.filter(m => m.es_atipico)
  const pendientes       = [...sugeridos, ...sinClasificar] // alias para compatibilidad

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
        onReclasificar={handleReclasificar}
        isReclasificando={reclasificando}
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
                <div className="bg-slate-50 border-b border-slate-200 px-4 flex gap-1 overflow-x-auto">
                  {[
                    { id: 'auto',    label: 'Aceptar',  count: autoClasificados.length, color: 'emerald' },
                    { id: 'sugerido',label: 'Revisar',  count: sugeridos.length,        color: 'amber'   },
                    { id: 'asignar', label: 'Asignar',  count: sinClasificar.length,    color: 'slate'   },
                    { id: 'validados',label:'Validados', count: validados.length,        color: 'slate'   },
                  ].map(t => {
                    const active = subTab === t.id
                    const dotColor = { emerald:'bg-emerald-400', amber:'bg-amber-400', slate:'bg-slate-300' }[t.color]
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSubTab(t.id)}
                        className={`flex items-center gap-2 py-3 px-3 text-xs font-bold tracking-wide uppercase border-b-2 transition-colors whitespace-nowrap
                          ${active ? 'border-navy-900 text-navy-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                        {t.label}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono
                          ${active ? 'bg-navy-900 text-white' : 'bg-slate-200 text-slate-500'}`}>
                          {t.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {/* Banner Aceptar todos */}
                  {subTab === 'auto' && autoClasificados.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 border-b border-emerald-100">
                      <span className="text-xs text-emerald-700 font-semibold">
                        {autoClasificados.length} movimientos con alta confianza — podés aprobarlos todos de una vez
                      </span>
                      <button onClick={handleConfirmarTodosAuto}
                        className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors">
                        ✓ Aceptar todos
                      </button>
                    </div>
                  )}
                  {/* Banner Revisar */}
                  {subTab === 'sugerido' && sugeridos.length > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border-b border-amber-100">
                      <span className="text-xs text-amber-700 font-semibold">
                        {sugeridos.length} movimientos con confianza media — revisá la categoría antes de confirmar
                      </span>
                    </div>
                  )}
                  {/* Banner Asignar */}
                  {subTab === 'asignar' && sinClasificar.length > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
                      <span className="text-xs text-slate-500 font-semibold">
                        {sinClasificar.length} movimientos sin categoría — asigná manualmente para entrenar el sistema
                      </span>
                    </div>
                  )}

                  {/* Lista de movimientos */}
                  {(subTab === 'auto'     ? autoClasificados
                  : subTab === 'sugerido' ? sugeridos
                  : subTab === 'asignar'  ? sinClasificar
                  : validados
                  ).map(mov => (
                    <MovimientoRow
                      key={mov.id}
                      movimiento={mov}
                      onConfirmar={handleConfirmar}
                      onCambiarCuenta={handleCambiarCuenta}
                      onAgregarNota={handleAgregarNota}
                    />
                  ))}

                  {subTab === 'auto'     && autoClasificados.length === 0 && <div className="p-12 text-center text-slate-400 text-sm">No hay movimientos auto-clasificados</div>}
                  {subTab === 'sugerido' && sugeridos.length === 0        && <div className="p-12 text-center text-slate-400 text-sm">No hay movimientos para revisar</div>}
                  {subTab === 'asignar'  && sinClasificar.length === 0    && <div className="p-12 text-center text-slate-400 text-sm">Todos los movimientos están clasificados</div>}
                  {subTab === 'validados'&& validados.length === 0         && <div className="p-12 text-center text-slate-400 text-sm">Todavía no hay movimientos validados</div>}
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

