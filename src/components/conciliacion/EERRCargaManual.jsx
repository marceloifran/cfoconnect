import { useState } from 'react'

export default function EERRCargaManual({ onGuardar }) {
  const [lineas, setLineas] = useState([{ id: Date.now(), rubro: '', importe: '', familia: '' }])

  const familias = [
    'ingresos_operativos', 'costos_directos', 'gastos_operativos',
    'resultado_financiero', 'cargas_tributarias', 'cargas_bancarias'
  ]

  const addLinea = () => setLineas([...lineas, { id: Date.now(), rubro: '', importe: '', familia: '' }])
  const removeLinea = (id) => setLineas(lineas.filter(l => l.id !== id))
  
  const updateLinea = (id, field, value) => {
    setLineas(lineas.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const handleSave = () => {
    const data = lineas.filter(l => l.rubro && l.importe !== '').map(l => ({
      rubro: l.rubro,
      importe: parseFloat(l.importe) || 0,
      familia: l.familia || 'sin_clasificar'
    }))
    onGuardar({ lineas: data, formato_origen: 'carga_manual' })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <h3 className="font-bold text-navy-900 mb-4 text-sm uppercase tracking-wider">Carga Manual de EERR Contable</h3>
      <div className="space-y-3 mb-4">
        {lineas.map((linea) => (
          <div key={linea.id} className="flex gap-3 items-center">
            <input 
              type="text" placeholder="Ej. Ventas Netas" value={linea.rubro}
              onChange={e => updateLinea(linea.id, 'rubro', e.target.value)}
              className="flex-1 text-sm border border-slate-200 rounded-md py-2 px-3 outline-none focus:border-indigo-500"
            />
            <input 
              type="number" placeholder="Importe" value={linea.importe}
              onChange={e => updateLinea(linea.id, 'importe', e.target.value)}
              className="w-32 text-sm border border-slate-200 rounded-md py-2 px-3 outline-none focus:border-indigo-500"
            />
            <select 
              value={linea.familia} 
              onChange={e => updateLinea(linea.id, 'familia', e.target.value)}
              className="w-48 text-sm border border-slate-200 rounded-md py-2 px-3 text-slate-600 outline-none focus:border-indigo-500"
            >
              <option value="">Clasificar familia...</option>
              {familias.map(f => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}
            </select>
            <button onClick={() => removeLinea(linea.id)} className="text-slate-400 hover:text-red-500 px-2 font-bold transition-colors">✕</button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
        <button onClick={addLinea} className="text-indigo-600 text-sm font-semibold hover:text-indigo-800 transition-colors">+ Agregar fila</button>
        <button onClick={handleSave} className="bg-indigo-600 text-white text-sm font-semibold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors">Guardar EERR</button>
      </div>
    </div>
  )
}
