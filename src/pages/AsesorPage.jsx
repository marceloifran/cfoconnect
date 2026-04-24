import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/shared/PageHeader'
import { Building2, AlertTriangle, TrendingUp, Plus, ExternalLink } from 'lucide-react'
import { ars } from '@/lib/financials'

const ETAPA_MAP = {
  1: { label: 'Onboarding',        badge: 'badge-gray'  },
  2: { label: 'Diagnóstico',       badge: 'badge-amber' },
  3: { label: 'CFO activo',        badge: 'badge-green' },
  4: { label: 'Mercado capitales', badge: 'badge-blue'  },
  5: { label: 'Estratégico',       badge: 'badge-navy'  },
}

function EmpresaRow({ empresa, onAcceder }) {
  const etapa = ETAPA_MAP[empresa.etapa_numero] || ETAPA_MAP[1]
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-navy-50 border border-navy-100 flex items-center justify-center flex-shrink-0">
            <Building2 size={14} className="text-navy-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-navy-800">{empresa.nombre}</p>
            <p className="text-xs text-slate-400">{empresa.cuit} · {empresa.rubro}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={etapa.badge}>{etapa.label}</span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{empresa.plan_servicio || '—'}</td>
      <td className="px-4 py-3 text-sm text-slate-500">{empresa.asesor_nombre || '—'}</td>
      <td className="px-4 py-3">
        <button
          onClick={() => onAcceder(empresa)}
          className="btn-secondary text-xs py-1 px-2.5"
        >
          <ExternalLink size={12} />
          Acceder
        </button>
      </td>
    </tr>
  )
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-navy-800">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  )
}

export default function AsesorPage() {
  const [empresas, setEmpresas] = useState([])
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('empresas').select('*').order('nombre'),
      supabase.from('alertas').select('*, empresas(nombre)').eq('leida', false).order('created_at', { ascending: false }).limit(8),
    ]).then(([emp, ale]) => {
      setEmpresas(emp.data || [])
      setAlertas(ale.data || [])
      setLoading(false)
    })
  }, [])

  function handleAcceder(empresa) {
    // In production: set impersonation context and navigate to client view
    alert(`Acceder al portal de: ${empresa.nombre}\n(Implementar impersonación en Fase 2)`)
  }

  const stats = {
    total: empresas.length,
    activas: empresas.filter(e => e.etapa_numero >= 3).length,
    diagnostico: empresas.filter(e => e.etapa_numero === 2).length,
    alertasAbiertas: alertas.length,
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="Panel de asesor"
        subtitle="Vista consolidada de todas las empresas"
        actions={
          <button className="btn-primary text-sm">
            <Plus size={15} />
            Nueva empresa
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="Empresas totales"    value={stats.total}          icon={Building2}    color="bg-navy-600" />
          <StatCard label="CFO activo"           value={stats.activas}        icon={TrendingUp}   color="bg-brand-600" />
          <StatCard label="En diagnóstico"       value={stats.diagnostico}    icon={Building2}    color="bg-amber-500" />
          <StatCard label="Alertas abiertas"     value={stats.alertasAbiertas} icon={AlertTriangle} color="bg-red-500" />
        </div>

        {/* Companies table */}
        <div className="card mb-5">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-sm font-medium text-navy-800">Empresas asesoradas</h2>
          </div>
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
          ) : empresas.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              Todavía no hay empresas. Creá la primera con el botón de arriba.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Empresa', 'Etapa', 'Servicio', 'Asesor', ''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {empresas.map(e => (
                    <EmpresaRow key={e.id} empresa={e} onAcceder={handleAcceder} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alerts */}
        {alertas.length > 0 && (
          <div className="card">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-medium text-navy-800">Alertas recientes</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {alertas.map(a => (
                <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                  <AlertTriangle size={14} className={`flex-shrink-0 mt-0.5 ${
                    a.nivel === 'critico' ? 'text-red-500' :
                    a.nivel === 'alto'    ? 'text-amber-500' : 'text-blue-400'
                  }`} />
                  <div>
                    <p className="text-xs font-medium text-navy-600">{a.empresas?.nombre}</p>
                    <p className="text-sm text-slate-600">{a.mensaje}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
