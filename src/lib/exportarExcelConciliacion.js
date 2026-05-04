// src/lib/exportarExcelConciliacion.js
import * as XLSX from 'xlsx'

export function exportarExcelMatriz(movimientos, extracto) {
  // Crear una hoja con el mismo formato del Excel del contador
  // Columnas = las 43 categorías del plan de cuentas
  // Filas = cada movimiento, con el monto en la columna correspondiente
  // Footer = totales por categoría

  const ws_data = [
    ['Fecha', 'Descripción', 'Monto', 'Categoría', 'Método Clasificación']
  ]

  movimientos.forEach(mov => {
    ws_data.push([
      mov.fecha,
      mov.descripcion_raw,
      (mov.credito || 0) - (mov.debito || 0),
      mov.cuenta_nombre || '',
      mov.metodo_clasificacion || ''
    ])
  })

  const ws = XLSX.utils.aoa_to_sheet(ws_data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `${extracto.periodo_hasta}`)
  XLSX.writeFile(wb, `Conciliacion_${extracto.periodo_hasta}.xlsx`)
}
