import clsx from 'clsx'

const COLOR_MAP = {
  green: { dot: 'dot-green', badge: 'badge-green' },
  amber: { dot: 'dot-amber', badge: 'badge-amber' },
  red:   { dot: 'dot-red',   badge: 'badge-red'   },
  gray:  { dot: 'dot-gray',  badge: 'badge-gray'  },
}

export function SemaforoRow({ label, color = 'gray', badge, desc }) {
  const cls = COLOR_MAP[color] || COLOR_MAP.gray
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className={cls.dot} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-navy-700">{label}</p>
        {desc && <p className="text-xs text-slate-400 truncate">{desc}</p>}
      </div>
      {badge && <span className={cls.badge}>{badge}</span>}
    </div>
  )
}

export function SemaforoGrid({ areas }) {
  return (
    <div className="space-y-0">
      {areas.map((area, i) => (
        <SemaforoRow key={i} {...area} />
      ))}
    </div>
  )
}
