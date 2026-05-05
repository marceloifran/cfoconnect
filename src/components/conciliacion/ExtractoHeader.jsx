import SaldoCard from './SaldoCard'

export default function ExtractoHeader({ extracto, movimientos, onCerrar, isCerrando }) {
  if (!extracto) return null

  const creditos = movimientos.reduce((acc, m) => acc + (m.credito || 0), 0)
  const debitos = movimientos.reduce((acc, m) => acc + (m.debito || 0), 0)
  
  const validados = movimientos.filter(m => m.validado).length
  const total = movimientos.length || 1
  const progress = Math.round((validados / total) * 100)
  const pendientes = total - validados

  const saldoFinalCalculado = extracto.saldo_inicial + creditos - debitos
  const diferencia = Math.abs(saldoFinalCalculado - (extracto.saldo_final || 0))
  const cuadra = diferencia < 1

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-4 sticky top-0 z-10 shadow-sm">
      
      {/* Primer fila: Saldos */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <SaldoCard label="Saldo inicial" value={extracto.saldo_inicial} />
          <SaldoCard label="Créditos" value={creditos} color="green" prefix="+" />
          <SaldoCard label="Débitos" value={debitos} color="red" prefix="−" />
          <SaldoCard 
            label="Saldo final" 
            value={saldoFinalCalculado} 
            color={cuadra ? 'green' : 'red'} 
            badge={cuadra ? '✓ CUADRA' : `⚠ DIF $${diferencia.toLocaleString('es-AR')}`} 
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-500 mb-1">{pendientes} pendientes · {progress}% completado</span>
            <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
          {pendientes === 0 && cuadra && extracto.estado !== 'cerrado' && (
            <button 
              onClick={onCerrar}
              disabled={isCerrando}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 hover:bg-emerald-700 transition-colors ml-4"
            >
              {isCerrando ? 'Cerrando...' : 'Cerrar extracto →'}
            </button>
          )}
          {extracto.estado === 'cerrado' && (
            <span className="px-4 py-2 bg-emerald-100 text-emerald-800 text-sm font-bold rounded-lg ml-4">
              ✓ Extracto Cerrado
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
