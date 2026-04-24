import clsx from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function MetricCard({ label, value, sub, trend, trendLabel, color }) {
  const trendIcon = trend === 'up'
    ? <TrendingUp size={13} className="text-brand-600" />
    : trend === 'down'
    ? <TrendingDown size={13} className="text-red-500" />
    : <Minus size={13} className="text-slate-400" />

  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500 mb-1.5">{label}</p>
      <p className={clsx(
        'text-2xl font-semibold tracking-tight',
        color === 'red' ? 'text-red-600' :
        color === 'amber' ? 'text-amber-600' :
        color === 'green' ? 'text-brand-700' : 'text-navy-800'
      )}>
        {value}
      </p>
      {(sub || trendLabel) && (
        <div className="flex items-center gap-1.5 mt-1.5">
          {trend && trendIcon}
          <span className="text-xs text-slate-400">{sub || trendLabel}</span>
        </div>
      )}
    </div>
  )
}
