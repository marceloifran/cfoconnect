import * as XLSX from 'xlsx'

export async function parseEERRExcel(file) {
  const workbook = XLSX.read(await file.arrayBuffer())
  const sheet    = workbook.Sheets[workbook.SheetNames[0]]
  const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  const lineas = []

  for (const row of rows) {
    const rubro   = row.find(cell => typeof cell === 'string' && cell.trim().length > 2)
    const importe = row.find(cell => typeof cell === 'number' && Math.abs(cell) > 0)
    if (rubro && importe !== undefined) {
      lineas.push({ rubro: rubro.trim(), importe })
    }
  }

  return { lineas, formato_origen: 'excel', confianza_parseo: lineas.length > 0 ? 'alta' : 'baja' }
}
