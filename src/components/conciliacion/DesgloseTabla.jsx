import { useState } from 'react'
import { FAMILIAS_CATEGORIAS } from '@/lib/categoriasConciliacion'
import { ars } from '@/lib/financials'
import { ChevronRight, ChevronDown } from 'lucide-react'

export default function DesgloseTabla({ movimientos }) {
  const [expandedCats, setExpandedCats] = useState({})

  // Agrupar movimientos
  const validados = movimientos.filter(m => m.validado)
  const totalesCr = validados.reduce((acc, m) => acc + (m.credito || 0), 0)
  const totalesDb = validados.reduce((acc, m) => acc + (m.debito || 0), 0)
  const resultadoNeto = totalesCr - totalesDb

  const toggleCat = (cat) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }))

  // Agrupar data por familia -> categoria
  const agrupacion = FAMILIAS_CATEGORIAS.map(f => {
    const catsData = f.categorias.map(cat => {
      const movs = validados.filter(m => m.cuenta_nombre === cat)
      const creditos = movs.reduce((acc, m) => acc + (m.credito || 0), 0)
      const debitos = movs.reduce((acc, m) => acc + (m.debito || 0), 0)
      const neto = creditos - debitos
      return { nombre: cat, movs, neto, creditos, debitos }
    }).filter(c => c.movs.length > 0)
    
    return { ...f, catsData, netoTotal: catsData.reduce((acc, c) => acc + c.neto, 0) }
  }).filter(f => f.catsData.length > 0)

  return (
    <div className="flex flex-col flex-1 p-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-semibold">
              <th className="px-6 py-3 w-1/3">Categoría</th>
              <th className="px-6 py-3">Movimientos</th>
              <th className="px-6 py-3 text-right">Monto Neto</th>
              <th className="px-6 py-3 text-right">vs Mes ant.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agrupacion.map(familia => (
              <React.Fragment key={familia.id}>
                {/* Cabecera Familia */}
                <tr className="bg-slate-50/50">
                  <td colSpan={4} className="px-6 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {familia.label}
                  </td>
                </tr>
                {/* Filas de Categorias */}
                {familia.catsData.map(cat => (
                  <React.Fragment key={cat.nombre}>
                    <tr 
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => toggleCat(cat.nombre)}
                    >
                      <td className="px-6 py-3 font-medium text-navy-900 flex items-center gap-2">
                        {expandedCats[cat.nombre] ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                        {cat.nombre}
                      </td>
                      <td className="px-6 py-3 text-slate-500">{cat.movs.length} movimientos</td>
                      <td className={`px-6 py-3 text-right font-mono font-medium ${cat.neto >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {cat.neto >= 0 ? '+' : ''}{ars(cat.neto)}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-400 text-xs">— primer mes</td>
                    </tr>
                    {/* Filas expandidas (movimientos individuales) */}
                    {expandedCats[cat.nombre] && (
                      <tr className="bg-slate-50/30">
                        <td colSpan={4} className="p-0">
                          <div className="pl-12 pr-6 py-3 space-y-1">
                            {cat.movs.map(m => (
                              <div key={m.id} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                                <div className="flex flex-col">
                                  <span className="text-xs text-navy-900 font-medium">{m.descripcion_raw}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">{new Date(m.fecha).toLocaleDateString('es-AR')}</span>
                                </div>
                                <span className={`text-xs font-mono ${m.credito ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {m.credito ? `+${ars(m.credito)}` : `-${ars(m.debito)}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {/* Totales Pie */}
        <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between font-mono text-sm">
          <div className="flex gap-8">
            <span>TOTAL CRÉDITOS: <span className="text-emerald-400">+{ars(totalesCr)}</span></span>
            <span>TOTAL DÉBITOS: <span className="text-red-400">-{ars(totalesDb)}</span></span>
          </div>
          <span className="font-bold">
            RESULTADO NETO: <span className={resultadoNeto >= 0 ? 'text-emerald-400' : 'text-red-400'}>{resultadoNeto >= 0 ? '+' : ''}{ars(resultadoNeto)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
