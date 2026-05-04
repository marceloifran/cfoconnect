// src/components/conciliacion/MovimientoRow.jsx

export default function MovimientoRow({ movimiento, cuentas, onConfirmar, onCambiarCuenta, onAgregarNota }) {
  const confianzaColor = {
    alta: '#10b981', // green
    media: '#f59e0b', // amber
    baja: '#ef4444', // red
    manual: '#0ea5e9' // sky
  }

  const formatFecha = (f) => f ? new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit'}) : ''
  const formatARS = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0)

  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors px-4">
      {/* Fecha */}
      <span className="font-mono text-xs text-slate-500 w-16 flex-shrink-0">{formatFecha(movimiento.fecha)}</span>

      {/* Descripción */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-navy-900 truncate">{movimiento.descripcion_raw}</p>
        {movimiento.contraparte_nombre && (
          <p className="text-xs text-slate-500 truncate">{movimiento.contraparte_nombre} · {movimiento.contraparte_cuit}</p>
        )}
      </div>

      {/* Monto */}
      <span className={`w-32 text-right font-mono text-sm ${movimiento.debito ? 'text-red-600' : 'text-emerald-600'}`}>
        {movimiento.debito
          ? `- ${formatARS(movimiento.debito)}`
          : `+ ${formatARS(movimiento.credito)}`
        }
      </span>

      {/* Categoría sugerida + acciones */}
      <div className="flex items-center gap-3 w-80 flex-shrink-0 justify-end">
        <select 
          value={movimiento.cuenta_nombre || ''} 
          onChange={e => onCambiarCuenta(movimiento.id, e.target.value)}
          className="text-xs border border-slate-200 rounded-md bg-white w-32 truncate px-2 py-1 outline-none"
        >
          <option value="" disabled>Seleccionar...</option>
          {cuentas.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span 
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap" 
          style={{ 
            color: confianzaColor[movimiento.confianza] || '#64748b',
            backgroundColor: `${confianzaColor[movimiento.confianza] || '#64748b'}15`
          }}
        >
          {movimiento.metodo_clasificacion ? movimiento.metodo_clasificacion.replace('_', ' ') : 'Pendiente'}
        </span>
        <button 
          onClick={() => onConfirmar(movimiento.id)}
          className="flex-shrink-0 text-xs font-semibold px-2 py-1 bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors"
        >
          ✓ Confirmar
        </button>
      </div>
    </div>
  )
}
