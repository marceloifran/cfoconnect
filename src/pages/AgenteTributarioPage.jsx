import { useState } from 'react'
import PageHeader from '@/components/shared/PageHeader'
import { CalendarDays, AlertTriangle, FileText, CheckCircle, Calculator } from 'lucide-react'

export default function AgenteTributarioPage() {
  const [tab, setTab] = useState('calendario')

  const vencimientos = [
    { fecha: '12 May 2025', titulo: 'IVA - Declaración Jurada', monto: '$ 850.400', estado: 'vence_pronto' },
    { fecha: '15 May 2025', titulo: 'Cargas Sociales', monto: '$ 1.250.000', estado: 'pendiente' },
    { fecha: '20 May 2025', titulo: 'Ingresos Brutos', monto: '$ 450.000', estado: 'pendiente' },
    { fecha: '10 Jun 2025', titulo: 'Anticipo Ganancias', monto: '$ 950.000', estado: 'futuro' },
  ]

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-0">
      <PageHeader
        title="Agente Tributario Automatizado"
        subtitle="Calendario fiscal, proyección de impuestos y VEPs"
      />

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-navy-900 flex items-center gap-2 text-sm uppercase tracking-wider mb-2">
              <AlertTriangle size={16} className="text-amber-500" />
              Estado de Integración ARCA
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              La conexión directa con los sistemas de ARCA (AFIP) se encuentra en fase beta. 
              Actualmente los datos son proyectados basados en tu histórico de facturación y parametrización contable.
            </p>
            <button className="bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded border border-indigo-200 hover:bg-indigo-100 transition-colors">
              Vincular clave fiscal
            </button>
          </div>

          <div className="flex gap-2 p-1 bg-slate-200/50 rounded-lg w-full max-w-sm">
            <button
              onClick={() => setTab('calendario')}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${tab === 'calendario' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Calendario
            </button>
            <button
              onClick={() => setTab('simulador')}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${tab === 'simulador' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Simulador Flujo
            </button>
          </div>

          {tab === 'calendario' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <h3 className="font-bold text-navy-900 flex items-center gap-2">
                  <CalendarDays size={18} className="text-slate-500" />
                  Próximos Vencimientos
                </h3>
                <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded">
                  Mayo 2025
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {vencimientos.map((v, i) => (
                  <div key={i} className={`p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-slate-50 ${v.estado === 'vence_pronto' ? 'bg-red-50/30' : ''}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-lg border flex flex-col items-center justify-center flex-shrink-0 ${v.estado === 'vence_pronto' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-navy-900'}`}>
                        <span className="text-[10px] uppercase font-bold opacity-60">{v.fecha.split(' ')[1]}</span>
                        <span className="text-lg font-bold">{v.fecha.split(' ')[0]}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-navy-900 text-base">{v.titulo}</h4>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <FileText size={12} />
                          {v.estado === 'vence_pronto' ? 'Vence en menos de 5 días' : 'Vencimiento estándar'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:flex-col md:items-end gap-2">
                      <div className="text-xl font-mono font-bold text-slate-700">{v.monto}</div>
                      <button className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded hover:bg-indigo-100 transition-colors border border-indigo-100">
                        Generar VEP
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'simulador' && (
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
              <Calculator size={48} className="text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-navy-900 mb-2">Simulador de Flujo Impositivo</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                Calcula automáticamente el impacto de los próximos impuestos en tu caja. 
                El módulo T2 del Agente Tributario estará disponible en la próxima actualización.
              </p>
              <button disabled className="bg-slate-100 text-slate-400 text-sm font-semibold px-6 py-2 rounded-md cursor-not-allowed">
                Próximamente
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
