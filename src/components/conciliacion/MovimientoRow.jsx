import { useState } from 'react'
import { ars } from '@/lib/financials'
import CategoriaDropdown from './CategoriaDropdown'
import { obtenerFamilia } from '@/lib/categoriasConciliacion'
import { ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'

export default function MovimientoRow({ movimiento, onConfirmar, onCambiarCuenta, onAgregarNota }) {
  const [expanded, setExpanded] = useState(false)
  const [notaTemp, setNotaTemp] = useState(movimiento.notas || '')

  const confianzaColor = {
    alta: 'text-emerald-700 bg-emerald-100',
    media: 'text-amber-700 bg-amber-100',
    baja: 'text-red-700 bg-red-100',
    manual: 'text-sky-700 bg-sky-100'
  }

  const formatFecha = (f) => f ? new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : ''
  const familia = movimiento.cuenta_nombre ? obtenerFamilia(movimiento.cuenta_nombre) : null
  const badgeClass = confianzaColor[movimiento.confianza] || 'text-slate-600 bg-slate-100'

  const handleConfirmar = () => {
    if (notaTemp !== movimiento.notas) {
      onAgregarNota(movimiento.id, notaTemp)
    }
    onConfirmar(movimiento.id)
    setExpanded(false)
  }

  return (
    <div className={`border-b border-slate-100 transition-colors ${expanded ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}>
      {/* Fila colapsada */}
      <div 
        className="flex items-center gap-4 py-3 px-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Fecha */}
        <span className="font-mono text-xs text-slate-500 w-12 flex-shrink-0">{formatFecha(movimiento.fecha)}</span>

        {/* Descripción */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-navy-900 truncate">{movimiento.descripcion_raw}</p>
          {movimiento.cuenta_nombre && (
            <p className="text-xs text-slate-500 truncate mt-0.5 uppercase tracking-wide font-semibold">
              [{familia} · {movimiento.cuenta_nombre}]
            </p>
          )}
        </div>

        {/* Monto */}
        <span className={`w-32 text-right font-mono text-sm font-medium ${movimiento.debito ? 'text-red-600' : 'text-emerald-600'}`}>
          {movimiento.debito
            ? `- ${ars(movimiento.debito)}`
            : `+ ${ars(movimiento.credito)}`
          }
        </span>

        {/* Estado */}
        <div className="flex items-center gap-3 w-32 flex-shrink-0 justify-end">
          {movimiento.validado ? (
            <span className="text-emerald-600 flex items-center gap-1 text-xs font-bold"><CheckCircle2 size={16}/> OK</span>
          ) : (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm whitespace-nowrap ${badgeClass}`}>
              {movimiento.metodo_clasificacion ? movimiento.metodo_clasificacion.replace('_', ' ') : 'Pendiente'}
            </span>
          )}
          {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        </div>
      </div>

      {/* Panel expandido */}
      {expanded && (
        <div className="px-16 py-4 bg-white border-t border-slate-100 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-8">
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-slate-500 text-xs font-semibold uppercase">Descripción original</span>
              <span className="text-navy-900 font-mono text-xs">{movimiento.descripcion_raw}</span>
            </div>
            {movimiento.contraparte_nombre && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-slate-500 text-xs font-semibold uppercase">Contraparte identificada</span>
                <span className="text-navy-900">{movimiento.contraparte_nombre} {movimiento.contraparte_cuit ? `· ${movimiento.contraparte_cuit}` : ''}</span>
              </div>
            )}
          </div>

          <div className="flex items-end gap-6">
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-slate-500 text-xs font-semibold uppercase">Categoría</span>
              <CategoriaDropdown 
                value={movimiento.cuenta_nombre} 
                onChange={(val) => onCambiarCuenta(movimiento.id, val)}
              />
            </div>
            
            <div className="flex flex-col gap-1.5 flex-2 min-w-[300px]">
              <span className="text-slate-500 text-xs font-semibold uppercase">Nota interna</span>
              <input 
                type="text" 
                value={notaTemp}
                onChange={e => setNotaTemp(e.target.value)}
                placeholder="Ej: Pago anticipado proveedor XYZ..."
                className="text-sm border border-slate-200 rounded-md px-3 py-1.5 outline-none focus:border-indigo-500 w-full"
              />
            </div>

            <button 
              onClick={handleConfirmar}
              disabled={!movimiento.cuenta_nombre}
              className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              Confirmar clasificación
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
