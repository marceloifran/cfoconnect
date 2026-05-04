import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/shared/PageHeader'
import { Building2, Upload, FileDown, Activity } from 'lucide-react'

export default function ContadorPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!profile?.id) return
      setLoading(true)

      // Get assigned companies
      const { data: asig } = await supabase
        .from('asignaciones_contador')
        .select('empresa_id')
        .eq('contador_id', profile.id)
        .eq('activo', true)

      const ids = (asig || []).map(a => a.empresa_id)

      if (ids.length > 0) {
        const { data: emps } = await supabase
          .from('empresas')
          .select('id, nombre, cuit')
          .in('id', ids)
          .order('nombre')
        
        // Mock data for extractos state for MVP
        const enriched = (emps || []).map(e => ({
          ...e,
          estado_eerr: Math.random() > 0.5 ? 'EERR pendiente' : 'Al día',
          periodo: 'Mayo 2025'
        }))
        setEmpresas(enriched)
      } else {
        setEmpresas([])
      }
      setLoading(false)
    }

    loadData()
  }, [profile?.id])

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      <PageHeader 
        title={`Panel del Contador · ${profile?.nombre || 'Estudio'}`}
        subtitle={`${empresas.length} empresas asignadas`}
      />

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-navy-900 uppercase tracking-wider text-xs flex items-center gap-2">
                <Building2 size={16} className="text-slate-400" />
                Mis Empresas
              </h3>
            </div>
            
            {loading ? (
              <div className="p-12 text-center text-slate-500 text-sm">Cargando empresas...</div>
            ) : empresas.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">No tenés empresas asignadas aún.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {empresas.map(emp => (
                  <div key={emp.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div>
                      <h4 className="font-bold text-navy-900">{emp.nombre}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{emp.periodo} · 
                        <span className={`ml-1 font-semibold ${emp.estado_eerr === 'EERR pendiente' ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {emp.estado_eerr} {emp.estado_eerr === 'EERR pendiente' ? '⚠' : '✓'}
                        </span>
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <button 
                        onClick={() => navigate(`/conciliacion`)} 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded hover:bg-indigo-100 transition-colors"
                      >
                        <Upload size={14} /> Subir EERR
                      </button>
                      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 text-xs font-semibold rounded hover:bg-slate-100 transition-colors border border-slate-200">
                        <FileDown size={14} /> Descargar Excel
                      </button>
                      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 text-xs font-semibold rounded hover:bg-slate-100 transition-colors border border-slate-200">
                        <Activity size={14} /> Ver comparativo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
