import { ars } from '@/lib/financials'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function SaldoCard({ label, value, color, prefix = '', badge }) {
  const colorClass = color === 'green' ? 'text-emerald-600' :
                     color === 'red' ? 'text-red-600' :
                     'text-slate-800'

  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-mono text-xl font-medium ${colorClass}`}>
          {prefix}{ars(value || 0)}
        </span>
        {badge && (
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
            badge.includes('✓') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  )
}
