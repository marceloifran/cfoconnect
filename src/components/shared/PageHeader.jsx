import { useAuth } from '@/hooks/useAuth'

export default function PageHeader({ title, subtitle, actions }) {
  const { isAsesor, isImpersonating, empresaActiva } = useAuth()
  const showEmpresa = isAsesor && !isImpersonating && empresaActiva

  return (
    <div className="h-14 flex items-center justify-between px-6 bg-white border-b border-slate-200 flex-shrink-0">
      <div>
        <h1 className="text-base font-semibold text-navy-800">{title}</h1>
        {showEmpresa ? (
          <p className="text-xs text-blue-600 font-medium">
            {empresaActiva.nombre}
            {empresaActiva.rubro && <span className="text-slate-400 font-normal"> · {empresaActiva.rubro}</span>}
          </p>
        ) : subtitle ? (
          <p className="text-xs text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
