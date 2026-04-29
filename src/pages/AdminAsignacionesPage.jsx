import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/shared/PageHeader'

export default function AdminAsignacionesPage() {
  const [asesores,    setAsesores]    = useState([])
  const [empresas,    setEmpresas]    = useState([])
  const [asignaciones,setAsignaciones] = useState(new Set()) // "asesorId|empresaId"
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('usuarios').select('id, nombre').eq('rol','asesor').order('nombre'),
      supabase.from('empresas').select('id, nombre').order('nombre'),
      supabase.from('asignaciones').select('asesor_id, empresa_id'),
    ]).then(([{ data:a }, { data:e }, { data:asig }]) => {
      setAsesores(a || [])
      setEmpresas(e || [])
      const set = new Set((asig || []).map(x => `${x.asesor_id}|${x.empresa_id}`))
      setAsignaciones(set)
      setLoading(false)
    })
  }, [])

  async function toggle(asesorId, empresaId) {
    const key = `${asesorId}|${empresaId}`
    setSaving(key)
    if (asignaciones.has(key)) {
      await supabase.from('asignaciones').delete()
        .eq('asesor_id', asesorId).eq('empresa_id', empresaId)
      setAsignaciones(prev => { const n = new Set(prev); n.delete(key); return n })
    } else {
      await supabase.from('asignaciones')
        .upsert({ asesor_id: asesorId, empresa_id: empresaId }, { onConflict:'asesor_id,empresa_id' })
      setAsignaciones(prev => new Set([...prev, key]))
    }
    setSaving(null)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader title="Asignaciones" subtitle="Asesor — empresa: marcá para asignar" />
      <div className="flex-1 overflow-auto p-6 animate-slide-up">
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-12">Cargando...</p>
        ) : (
          <div className="card overflow-auto">
            <table className="text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="sticky left-0 bg-white z-10 px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-36 border-r border-slate-100">
                    Asesor
                  </th>
                  {empresas.map(e => (
                    <th key={e.id} className="px-3 py-3 text-center font-medium text-slate-500 min-w-28 max-w-36">
                      <span className="block truncate max-w-28 mx-auto" title={e.nombre}>{e.nombre}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {asesores.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="sticky left-0 bg-white z-10 px-4 py-3 font-medium text-navy-800 border-r border-slate-100 whitespace-nowrap">
                      {a.nombre}
                    </td>
                    {empresas.map(e => {
                      const key = `${a.id}|${e.id}`
                      const checked = asignaciones.has(key)
                      return (
                        <td key={e.id} className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={saving === key}
                            onChange={() => toggle(a.id, e.id)}
                            className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 cursor-pointer"
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
