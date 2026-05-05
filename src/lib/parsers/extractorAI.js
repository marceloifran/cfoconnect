import * as pdfjsLib from 'pdfjs-dist'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

// Configurar el worker de PDF.js (vital para que funcione en el navegador)
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let text = ''
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const strings = content.items.map(item => item.str)
    text += strings.join(' ') + '\n'
  }
  
  return text
}

async function extractTextFromExcel(file) {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'buffer' })
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]
  // Convertimos a CSV para pasarlo fácilmente al LLM
  return XLSX.utils.sheet_to_csv(worksheet)
}

export async function processExtractoWithAI(file, extractoId, banco, supabaseClient) {
  try {
    const fileExt = file.name.split('.').pop().toLowerCase()
    let rawText = ''
    
    if (fileExt === 'pdf') {
      rawText = await extractTextFromPDF(file)
    } else if (['xls', 'xlsx'].includes(fileExt)) {
      rawText = await extractTextFromExcel(file)
    } else {
      throw new Error('Formato no soportado')
    }

    // Limitamos a los primeros 8000 caracteres para no exceder tokens en caso de extractos gigantes
    const textTruncated = rawText.slice(0, 8000)

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('No se encontró VITE_ANTHROPIC_API_KEY')
    }

    const prompt = `
Eres un asistente experto en contabilidad.
A continuación te proporciono el texto extraído de un extracto bancario del banco "${banco}".
Tu tarea es encontrar todos los movimientos/transacciones y extraerlos en un JSON estricto.

Reglas:
1. Responde ÚNICAMENTE con un array en formato JSON puro.
2. Formato de cada objeto:
{
  "fecha": "YYYY-MM-DD",
  "descripcion": "Descripción del movimiento",
  "monto": numero (positivo si es crédito/ingreso, negativo si es débito/egreso),
  "referencia": "algún número de comprobante o dejar vacío"
}
3. Ignora encabezados, saldos iniciales y finales. Solo transacciones.

Texto del extracto:
${textTruncated}
`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      throw new Error('Error al llamar a Anthropic API')
    }

    const data = await response.json()
    const resultText = data.content[0].text
    
    console.log('--- RAW TEXT SENT TO CLAUDE ---')
    console.log(textTruncated)
    console.log('--- RESPONSE FROM CLAUDE ---')
    console.log(resultText)

    // Buscar el JSON en la respuesta (puede ser un array [] o un objeto {} que contenga el array)
    let jsonToParse = resultText
    
    // Si Claude devolvió markdown, intentamos extraerlo
    if (resultText.includes('```json')) {
      jsonToParse = resultText.split('```json')[1].split('```')[0].trim()
    } else {
      const match = resultText.match(/\[[\s\S]*\]/)
      if (match) {
        jsonToParse = match[0]
      }
    }

    let movimientos = []
    try {
      movimientos = JSON.parse(jsonToParse)
      // Si por alguna razón Claude devolvió un objeto { movimientos: [...] }
      if (!Array.isArray(movimientos) && movimientos.movimientos) {
        movimientos = movimientos.movimientos
      }
    } catch (e) {
      console.error('Failed to parse JSON:', jsonToParse)
      throw new Error('El LLM no devolvió un JSON válido. Ver consola.')
    }

    if (!Array.isArray(movimientos)) {
      throw new Error('El JSON devuelto no es una lista de movimientos.')
    }
    
    // Insertar en la BD
    let saldoCalc = 0
    let creditos = 0
    let debitos = 0

    for (const mov of movimientos) {
      const tipo = mov.monto >= 0 ? 'credito' : 'debito'
      const montoAbs = Math.abs(mov.monto)
      
      if (tipo === 'credito') creditos += montoAbs
      if (tipo === 'debito') debitos += montoAbs

      await supabaseClient.from('conciliacion_movimientos').insert({
        extracto_id: extractoId,
        fecha: mov.fecha,
        descripcion_raw: mov.descripcion,
        debito: tipo === 'debito' ? montoAbs : 0,
        credito: tipo === 'credito' ? montoAbs : 0
      })
    }

    // Actualizar el estado del extracto a validacion_pendiente
    await supabaseClient.from('conciliacion_extractos')
      .update({ 
        estado: 'validacion_pendiente',
        total_creditos: creditos,
        total_debitos: debitos
      })
      .eq('id', extractoId)

    return { success: true, count: movimientos.length }
  } catch (error) {
    console.error('Error en processExtractoWithAI:', error)
    
    // Marcar como error en BD
    await supabaseClient.from('conciliacion_extractos')
      .update({ estado: 'error' })
      .eq('id', extractoId)

    return { success: false, error: error.message }
  }
}

export async function reanalizarExtracto(extracto, supabaseClient) {
  try {
    // Cambiar estado a clasificando
    await supabaseClient.from('conciliacion_extractos').update({ estado: 'clasificando' }).eq('id', extracto.id)

    // Borrar movimientos anteriores si hubiera
    await supabaseClient.from('conciliacion_movimientos').delete().eq('extracto_id', extracto.id)

    const { data: blob, error } = await supabaseClient.storage.from('extractos-bancarios').download(extracto.archivo_url)
    if (error) throw error

    const ext = extracto.archivo_url.split('.').pop()
    const file = new File([blob], `archivo.${ext}`, { type: blob.type })

    return await processExtractoWithAI(file, extracto.id, extracto.banco, supabaseClient)
  } catch (err) {
    console.error('Error reanalizando:', err)
    await supabaseClient.from('conciliacion_extractos').update({ estado: 'error' }).eq('id', extracto.id)
    return { success: false, error: err.message }
  }
}
