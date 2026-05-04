import { useState, useEffect } from 'react'

export default function EERRComparativo({ gestion, contable }) {
  const [brecha, setBrecha] = useState(null)

  useEffect(() => {
    if (!gestion || !contable) return
    const familias = [
      'ingresos_operativos',
      'costos_directos',
      'gastos_operativos',
      'resultado_financiero',
      'cargas_tributarias',
      'cargas_bancarias'
    ]
    const calculada = familias.reduce((acc, f) => {
      const g = gestion[f] || 0
      const c = contable[f] || 0
      const diferencia = c - g
      acc[f] = {
        gestion: g,
        contable: c,
        diferencia,
        pct: g !== 0 ? (Math.abs(diferencia) / Math.abs(g)) * 100 : null
      }
      return acc
    }, {})
    setBrecha(calculada)
  }, [gestion, contable])

  if (!brecha) return <div className="text-sm text-slate-500">Faltan datos para comparar.</div>

  const familiasLabels = {
    ingresos_operativos: 'Ingresos Operativos',
    costos_directos: 'Costos Directos',
    gastos_operativos: 'Gastos Operativos',
    resultado_financiero: 'Resultado Financiero',
    cargas_tributarias: 'Cargas Tributarias',
    cargas_bancarias: 'Cargas Bancarias'
  }

  const formatARS = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0)

  const brechaColor = (pct) => {
    if (pct === null) return 'text-slate-500'
    if (pct < 5) return 'text-slate-500'
    if (pct <= 15) return 'text-amber-600 font-semibold'
    return 'text-red-600 font-bold'
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
        <h3 className="font-bold text-navy-900">EERR COMPARATIVO</h3>
        <p className="text-xs text-slate-500 mt-1">Gestión (Banco) vs. Contable (Contador)</p>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
            <th className="px-6 py-3">Rubro</th>
            <th className="px-6 py-3 text-right">Gestión (Banco)</th>
            <th className="px-6 py-3 text-right">Contable (Contador)</th>
            <th className="px-6 py-3 text-right">Brecha</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Object.entries(brecha).map(([familia, datos]) => (
            <tr key={familia} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4 font-medium text-navy-900">{familiasLabels[familia]}</td>
              <td className="px-6 py-4 text-right font-mono text-slate-700">{formatARS(datos.gestion)}</td>
              <td className="px-6 py-4 text-right font-mono text-slate-700">{formatARS(datos.contable)}</td>
              <td className={`px-6 py-4 text-right font-mono ${brechaColor(datos.pct)}`}>
                {datos.diferencia > 0 ? '+' : ''}{formatARS(datos.diferencia)}
                {datos.pct !== null && <span className="text-[10px] ml-2 bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 inline-block w-12 text-center">({datos.pct.toFixed(1)}%)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
