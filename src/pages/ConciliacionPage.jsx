import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { FileSearch, Upload, ArrowRight, AlertCircle, CheckCircle2, Clock, RefreshCw, Trash2, Edit3 } from 'lucide-react'
import ModalCargaExtractos from '@/components/conciliacion/ModalCargaExtractos'
import { reanalizarExtracto } from '@/lib/parsers/extractorAI'

export default function ConciliacionPage() {
  const { profile, empresaActiva, isAsesor } = useAuth()
  const navigate = useNavigate()
  const [extractos, setExtractos] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [reanalizandoId, setReanalizandoId] = useState(null)
  const [editingExt, setEditingExt] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  // Empresa context
  const empresaId = isAsesor ? empresaActiva?.id : profile?.empresa_id

  useEffect(() => {
    if (!empresaId) {
      setExtractos([])
      setLoading(false)
      return
    }

    async function fetchExtractos() {
      setLoading(true)
      const { data, error } = await supabase
        .from('conciliacion_extractos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
      
      if (!error && data) {
        setExtractos(data)
      }
      setLoading(false)
    }

    fetchExtractos()
  }, [empresaId])

  const refreshExtractos = async () => {
    if (!empresaId) return
    const { data } = await supabase
      .from('conciliacion_extractos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
    if (data) setExtractos(data)
  }

  const handleReanalizar = async (ext) => {
    setReanalizandoId(ext.id)
    await reanalizarExtracto(ext, supabase)
    setReanalizandoId(null)
    refreshExtractos()
  }

  const handleDelete = async () => {
    if (!deletingId) return
    
    // Primero eliminar movimientos (por si no hay cascade)
    await supabase.from('conciliacion_movimientos').delete().eq('extracto_id', deletingId)
    // Luego eliminar extracto
    const { error } = await supabase.from('conciliacion_extractos').delete().eq('id', deletingId)
    
    if (error) {
      alert('Error al eliminar: ' + error.message)
    } else {
      refreshExtractos()
    }
    setDeletingId(null)
  }

  const estadoBadge = (estado) => {
    const badges = {
      ingesta_pendiente: { bg: 'bg-slate-100', text: 'text-slate-600', icon: Clock, label: 'Pendiente' },
      clasificando: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock, label: 'Clasificando' },
      validacion_pendiente: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertCircle, label: 'Validación pdte.' },
      cerrado: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2, label: 'Cerrado' },
      error: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle, label: 'Error' }
    }
    const b = badges[estado] || badges.ingesta_pendiente
    const Icon = b.icon
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${b.bg} ${b.text}`}>
        <Icon size={12} />
        {b.label}
      </span>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Header */}
      <div className="px-6 md:px-8 py-6 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-navy-900 tracking-tight">Conciliación Bancaria</h1>
          <p className="text-sm text-slate-500 mt-1">
            Validación y categorización de movimientos bancarios.
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          disabled={!empresaId}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload size={16} />
          Subir nuevo extracto
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        {!empresaId ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm">Selecciona una empresa para ver sus extractos.</p>
          </div>
        ) : loading ? (
          <div className="text-center py-12 text-sm text-slate-500">Cargando extractos...</div>
        ) : extractos.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <FileSearch size={32} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-base font-semibold text-navy-900">No hay extractos cargados</h3>
            <p className="text-sm text-slate-500 mt-1 mb-6">Comenzá subiendo el primer extracto bancario en PDF o Excel.</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-navy-800 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
            >
              <Upload size={16} />
              Subir extracto
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Período</th>
                  <th className="px-6 py-4">Banco y Cuenta</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Saldos</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {extractos.map(ext => (
                  <tr key={ext.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-navy-900">{ext.periodo_desde} - {ext.periodo_hasta}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-navy-900 capitalize">{ext.banco}</div>
                      <div className="text-xs text-slate-500">{ext.cuenta_numero}</div>
                    </td>
                    <td className="px-6 py-4">
                      {estadoBadge(ext.estado)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-slate-500">Ini: <span className="font-mono text-slate-700">${ext.saldo_inicial?.toLocaleString()}</span></div>
                      <div className="text-xs text-slate-500 mt-0.5">Fin: <span className="font-mono text-slate-700">${ext.saldo_final?.toLocaleString()}</span></div>
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingExt(ext)}
                        title="Editar datos del extracto"
                        className="p-1.5 text-slate-400 hover:text-navy-900 hover:bg-slate-100 rounded-md transition-colors"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => setDeletingId(ext.id)}
                        title="Eliminar extracto"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>

                      {(ext.estado === 'error' || ext.estado === 'ingesta_pendiente') && (
                        <button
                          onClick={() => handleReanalizar(ext)}
                          disabled={reanalizandoId === ext.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw size={14} className={reanalizandoId === ext.id ? "animate-spin" : ""} />
                          {reanalizandoId === ext.id ? 'Analizando...' : 'Reintentar IA'}
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/conciliacion/${ext.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
                      >
                        Ver detalle <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Edición Simple */}
      {editingExt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-navy-900">Editar Extracto</h3>
              <button onClick={() => setEditingExt(null)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Banco</label>
                <input 
                  type="text" 
                  value={editingExt.banco || ''} 
                  onChange={e => setEditingExt({...editingExt, banco: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Cuenta Nº</label>
                <input 
                  type="text" 
                  value={editingExt.cuenta_numero || ''} 
                  onChange={e => setEditingExt({...editingExt, cuenta_numero: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button 
                  onClick={() => setEditingExt(null)}
                  className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-50 rounded-lg"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    await supabase.from('conciliacion_extractos').update({ 
                      banco: editingExt.banco, 
                      cuenta_numero: editingExt.cuenta_numero 
                    }).eq('id', editingExt.id)
                    setEditingExt(null)
                    refreshExtractos()
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700"
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Eliminación */}
      {deletingId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-lg font-bold text-navy-900 mb-2">¿Eliminar conciliación?</h3>
              <p className="text-sm text-slate-500">
                Esta acción eliminará el extracto y todos sus movimientos clasificados. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setDeletingId(null)}
                className="flex-1 px-4 py-2 text-slate-600 text-sm font-semibold hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-bold hover:bg-red-700 rounded-lg transition-colors shadow-sm"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Multi-archivo Real */}
      <ModalCargaExtractos 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        empresaId={empresaId}
        onUploadComplete={refreshExtractos}
      />
    </div>
  )
}
