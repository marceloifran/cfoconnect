import { useState } from 'react'
import { ars } from '@/lib/financials'
import CategoriaDropdown from './CategoriaDropdown'
import { obtenerFamilia } from '@/lib/categoriasConciliacion'
import { ChevronDown, ChevronRight, CheckCircle2, Pencil } from 'lucide-react'

// ── Configuración visual por estado ──────────────────────────────────────────
const ESTADO_CONFIG = {
  auto: {
    badge:   'bg-emerald-100 text-emerald-700 border border-emerald-200',
    icon:    '✓',
    label:   'ACEPTAR',
    btnCls:  'bg-emerald-600 hover:bg-emerald-700 text-white',
    btnTxt:  'Aceptar',
    tagCls:  'bg-emerald-50 border-emerald-200 text-emerald-800',
    dot:     'bg-emerald-400',
  },
  sugerido: {
    badge:   'bg-amber-100 text-amber-700 border border-amber-200',
    icon:    '?',
    label:   'REVISAR',
    btnCls:  'bg-amber-500 hover:bg-amber-600 text-white',
    btnTxt:  'Confirmar revisión',
    tagCls:  'bg-amber-50 border-amber-200 text-amber-800',
    dot:     'bg-amber-400',
  },
  pendiente: {
    badge:   'bg-slate-100 text-slate-500 border border-slate-200',
    icon:    '—',
    label:   'ASIGNAR',
    btnCls:  'bg-indigo-600 hover:bg-indigo-700 text-white',
    btnTxt:  'Asignar',
    tagCls:  '',
    dot:     'bg-slate-300',
  },
  validado: {
    badge:   'bg-slate-50 text-slate-400 border border-slate-100',
    icon:    '✓',
    label:   'VALIDADO',
    btnCls:  '',
    btnTxt:  '',
    tagCls:  '',
    dot:     'bg-slate-200',
  },
}

export default function MovimientoRow({ movimiento, onConfirmar, onCambiarCuenta, onAgregarNota }) {
  const [expanded, setExpanded]       = useState(false)
  const [notaTemp, setNotaTemp]       = useState(movimiento.notas || '')
  const [showDropdown, setShowDropdown] = useState(false)

  const estado  = movimiento.validado ? 'validado' : (movimiento.estado || 'pendiente')
  const cfg     = ESTADO_CONFIG[estado] || ESTADO_CONFIG.pendiente
  const isAuto  = estado === 'auto'
  const isSug   = estado === 'sugerido'
  const isPend  = estado === 'pendiente'
  const isValid = estado === 'validado'

  const formatFecha = (f) => f ? new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : ''

  // Familia: usar cuenta_familia del motor si existe, sino lookup legacy
  const familiaLabel = movimiento.cuenta_familia
    ? movimiento.cuenta_familia.charAt(0) + movimiento.cuenta_familia.slice(1).toLowerCase()
    : (movimiento.cuenta_nombre ? obtenerFamilia(movimiento.cuenta_nombre) : null)

  const handleConfirmar = () => {
    if (notaTemp !== movimiento.notas) onAgregarNota(movimiento.id, notaTemp)
    onConfirmar(movimiento.id)
    setExpanded(false)
    setShowDropdown(false)
  }

  const canConfirm = !isPend || !!movimiento.cuenta_nombre

  return (
    <div className={`border-b border-slate-100 transition-colors ${expanded ? 'bg-slate-50/60' : 'hover:bg-slate-50/40'}`}>

      {/* ── Fila colapsada ── */}
      <div className="flex items-center gap-3 py-3 px-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>

        {/* Dot de estado */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />

        {/* Fecha */}
        <span className="font-mono text-xs text-slate-400 w-12 flex-shrink-0">{formatFecha(movimiento.fecha)}</span>

        {/* Descripción + cuenta + familia */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-navy-900 truncate">{movimiento.descripcion_raw}</p>
          {movimiento.cuenta_nombre && (
            <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
              {familiaLabel && <span className="text-slate-300 mr-1">{familiaLabel} ·</span>}
              {movimiento.cuenta_nombre}
            </p>
          )}
        </div>

        {/* Monto */}
        <span className={`w-32 text-right font-mono text-sm font-semibold flex-shrink-0 ${movimiento.debito ? 'text-red-600' : 'text-emerald-600'}`}>
          {movimiento.debito ? `- ${ars(movimiento.debito)}` : `+ ${ars(movimiento.credito)}`}
        </span>

        {/* Badge de estado */}
        <div className="w-28 flex justify-end flex-shrink-0">
          {isValid ? (
            <span className="text-emerald-600 flex items-center gap-1 text-xs font-bold">
              <CheckCircle2 size={14} /> Validado
            </span>
          ) : (
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${cfg.badge}`}>
              {cfg.icon} {cfg.label}
            </span>
          )}
        </div>

        {expanded ? <ChevronDown size={15} className="text-slate-300 flex-shrink-0" /> : <ChevronRight size={15} className="text-slate-300 flex-shrink-0" />}
      </div>

      {/* ── Panel expandido ── */}
      {expanded && !isValid && (
        <div className="mx-4 mb-4 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">

          {/* Header del panel según estado */}
          <div className={`px-4 py-2.5 flex items-center justify-between text-xs font-semibold
            ${isAuto  ? 'bg-emerald-50 border-b border-emerald-100 text-emerald-700' : ''}
            ${isSug   ? 'bg-amber-50 border-b border-amber-100 text-amber-700'       : ''}
            ${isPend  ? 'bg-slate-50 border-b border-slate-100 text-slate-500'       : ''}
          `}>
            <span>
              {isAuto && '✓ Clasificado automáticamente con alta confianza'}
              {isSug  && '? Clasificación sugerida — revisá antes de confirmar'}
              {isPend && '— Sin clasificar — asigná una categoría'}
            </span>
            {movimiento.score > 0 && (
              <span className="font-mono opacity-60">score {Math.round(movimiento.score * 100)}%</span>
            )}
          </div>

          <div className="p-4 flex flex-col gap-4">

            {/* Descripción original */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descripción original</p>
              <p className="text-xs font-mono text-navy-800 bg-slate-50 px-3 py-2 rounded border border-slate-100">{movimiento.descripcion_raw}</p>
            </div>

            <div className="flex items-end gap-4 flex-wrap">

              {/* Categoría según estado */}
              <div className="flex flex-col gap-1.5 min-w-[220px] flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categoría</p>

                {/* AUTO: etiqueta verde con botón de editar visible */}
                {isAuto && !showDropdown && (
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 ${cfg.tagCls}`}>
                      <span className="text-xs font-bold flex-1">{movimiento.cuenta_nombre}</span>
                      <span className="text-[9px] opacity-40 uppercase tracking-wider">auto</span>
                    </div>
                    <button
                      onClick={() => setShowDropdown(true)}
                      title="Corregir categoría"
                      className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors text-xs font-semibold flex-shrink-0"
                    >
                      <Pencil size={12} />
                      Corregir
                    </button>
                  </div>
                )}

                {/* SUGERIDO: etiqueta ámbar con botón de editar */}
                {isSug && !showDropdown && (
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 ${cfg.tagCls}`}>
                      <span className="text-xs font-semibold flex-1">{movimiento.cuenta_nombre}</span>
                      <span className="text-[9px] opacity-40 uppercase tracking-wider">sugerido</span>
                    </div>
                    <button
                      onClick={() => setShowDropdown(true)}
                      title="Cambiar categoría"
                      className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-amber-600 hover:border-amber-300 transition-colors text-xs font-semibold flex-shrink-0"
                    >
                      <Pencil size={12} />
                      Cambiar
                    </button>
                  </div>
                )}

                {/* PENDIENTE o dropdown abierto: selector */}
                {(isPend || showDropdown) && (
                  <div className="flex flex-col gap-1">
                    <CategoriaDropdown
                      value={showDropdown ? '' : movimiento.cuenta_nombre}
                      onChange={(val) => {
                        onCambiarCuenta(movimiento.id, val)
                        setShowDropdown(false)
                      }}
                    />
                    {showDropdown && (
                      <button onClick={() => setShowDropdown(false)} className="text-[10px] text-slate-400 hover:text-slate-600 text-left">
                        ← Cancelar
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Nota */}
              <div className="flex flex-col gap-1.5 flex-[2] min-w-[240px]">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nota interna</p>
                <input
                  type="text"
                  value={notaTemp}
                  onChange={e => setNotaTemp(e.target.value)}
                  placeholder="Ej: Pago proveedor de materiales..."
                  className="text-sm border border-slate-200 rounded-md px-3 py-1.5 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 w-full"
                />
              </div>

              {/* Botón de acción */}
              <button
                onClick={handleConfirmar}
                disabled={!canConfirm}
                className={`px-5 py-2 text-sm font-bold rounded-lg transition-colors disabled:opacity-40 flex-shrink-0 ${cfg.btnCls}`}
              >
                {cfg.btnTxt}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel expandido para validados (solo lectura) */}
      {expanded && isValid && (
        <div className="mx-4 mb-4 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center gap-4 text-xs text-slate-500">
          <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
          <div>
            <span className="font-semibold text-slate-700">{movimiento.cuenta_nombre || '—'}</span>
            {movimiento.notas && <span className="ml-3 text-slate-400">· {movimiento.notas}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
