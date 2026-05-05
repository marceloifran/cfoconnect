import { useState } from 'react'
import { Upload, X, File, AlertCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { processExtractoWithAI } from '@/lib/parsers/extractorAI'

export default function ModalCargaExtractos({ isOpen, onClose, empresaId, onUploadComplete }) {
  const [archivos, setArchivos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  // Manejar selección de archivos (drag & drop o manual)
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    const nuevosArchivos = files.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      banco: 'galicia',
      cuenta: '',
      periodo: new Date().toISOString().slice(0, 7), // YYYY-MM
      estado: 'pending' // pending, uploading, success, error
    }))

    setArchivos(prev => [...prev, ...nuevosArchivos])
  }

  const handleRemove = (id) => {
    setArchivos(prev => prev.filter(a => a.id !== id))
  }

  const handleChangeField = (id, field, value) => {
    setArchivos(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a))
  }

  const handleUploadAll = async () => {
    if (archivos.length === 0) return
    setLoading(true)
    setError(null)

    let todoExito = true

    const actualizados = [...archivos]

    for (let i = 0; i < actualizados.length; i++) {
      const a = actualizados[i]
      if (a.estado === 'success') continue

      // Validar
      if (!a.cuenta.trim()) {
        a.estado = 'error'
        a.errorMsg = 'Falta N° de cuenta'
        todoExito = false
        setArchivos([...actualizados])
        continue
      }

      a.estado = 'uploading'
      setArchivos([...actualizados])

      try {
        const fileExt = a.file.name.split('.').pop()
        const fileName = `${empresaId}/${Date.now()}_${a.banco}_${a.id}.${fileExt}`

        // Subir al bucket
        const { error: uploadError } = await supabase.storage
          .from('extractos-bancarios')
          .upload(fileName, a.file)

        if (uploadError) throw uploadError

        // Registrar en BD
        const { data: dbData, error: dbError } = await supabase.from('conciliacion_extractos').insert({
          empresa_id: empresaId,
          banco: a.banco,
          cuenta_numero: a.cuenta,
          cuenta_tipo: 'cta_cte_pesos', // default simplificado
          periodo_desde: `${a.periodo}-01`,
          periodo_hasta: new Date(a.periodo.split('-')[0], a.periodo.split('-')[1], 0).toISOString().split('T')[0],
          archivo_url: fileName,
          estado: 'ingesta_pendiente',
          saldo_inicial: 0,
          saldo_final: 0
        }).select().single()

        if (dbError) throw dbError

        // LLAMAR A LA IA PARA EXTRAER MOVIMIENTOS EN SEGUNDO PLANO
        // No hacemos un await estricto para no frenar toda la UI,
        // pero como la experiencia del usuario espera verlos rápido, lo hacemos asincrónico.
        processExtractoWithAI(a.file, dbData.id, a.banco, supabase)
          .then(() => onUploadComplete()) // Refrescar cuando termine el procesamiento
          .catch(console.error)

        a.estado = 'success'
      } catch (err) {
        a.estado = 'error'
        a.errorMsg = err.message
        todoExito = false
      }
      setArchivos([...actualizados])
    }

    setLoading(false)

    if (todoExito) {
      setTimeout(() => {
        onUploadComplete()
        onClose()
      }, 1000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <h3 className="font-bold text-navy-900 text-lg">Subir Extractos Bancarios</h3>
          <button onClick={onClose} disabled={loading} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded flex items-center gap-2 border border-red-100">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Zona de Drop/Select */}
          <label className="border-2 border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
            <Upload size={32} className="text-slate-400 mb-3" />
            <p className="text-sm font-medium text-navy-800">Seleccioná o arrastrá uno o múltiples PDFs / Excels</p>
            <p className="text-xs text-slate-500 mt-1">Soporta múltiples bancos simultáneamente</p>
            <div className="mt-4 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-navy-700 pointer-events-none">
              Seleccionar archivos
            </div>
            <input 
              type="file" 
              multiple 
              className="hidden" 
              accept=".pdf,.xls,.xlsx"
              onChange={handleFileChange}
              disabled={loading}
            />
          </label>

          {/* Lista de archivos a subir */}
          {archivos.length > 0 && (
            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-semibold text-navy-900 border-b border-slate-100 pb-2">
                Archivos a procesar ({archivos.length})
              </h4>
              
              {archivos.map(a => (
                <div key={a.id} className="flex flex-col md:flex-row md:items-center gap-3 p-3 border border-slate-200 rounded-lg bg-white relative">
                  
                  {/* Info del archivo */}
                  <div className="flex items-center gap-3 w-full md:w-1/3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center flex-shrink-0">
                      <File size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy-900 truncate" title={a.file.name}>{a.file.name}</p>
                      <p className="text-xs text-slate-500">{(a.file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>

                  {/* Campos */}
                  <div className="flex flex-col sm:flex-row gap-2 flex-1 items-center">
                    <select 
                      value={a.banco}
                      onChange={(e) => handleChangeField(a.id, 'banco', e.target.value)}
                      disabled={loading || a.estado === 'success'}
                      className="input py-1.5 px-2 text-xs w-full sm:w-auto"
                    >
                      <option value="galicia">Banco Galicia</option>
                      <option value="santander">Banco Santander</option>
                      <option value="macro">Banco Macro</option>
                      <option value="frances">BBVA Francés</option>
                      <option value="mercadopago">Mercado Pago</option>
                      <option value="otro">Otro</option>
                    </select>

                    <input 
                      type="text" 
                      placeholder="N° Cuenta"
                      value={a.cuenta}
                      onChange={(e) => handleChangeField(a.id, 'cuenta', e.target.value)}
                      disabled={loading || a.estado === 'success'}
                      className={`input py-1.5 px-2 text-xs w-full sm:w-32 ${a.estado === 'error' && !a.cuenta ? 'border-red-400 focus:ring-red-500' : ''}`}
                    />

                    <input 
                      type="month" 
                      value={a.periodo}
                      onChange={(e) => handleChangeField(a.id, 'periodo', e.target.value)}
                      disabled={loading || a.estado === 'success'}
                      className="input py-1.5 px-2 text-xs w-full sm:w-32"
                    />
                  </div>

                  {/* Status / Botón eliminar */}
                  <div className="w-8 flex justify-end">
                    {a.estado === 'pending' || a.estado === 'error' ? (
                      <button onClick={() => handleRemove(a.id)} disabled={loading} className="text-slate-400 hover:text-red-500 transition-colors">
                        <X size={18} />
                      </button>
                    ) : a.estado === 'uploading' ? (
                      <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    ) : (
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    )}
                  </div>
                  
                  {a.estado === 'error' && (
                    <p className="absolute -bottom-5 left-0 text-[10px] text-red-500">{a.errorMsg}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0 bg-slate-50">
          <button 
            onClick={onClose} 
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button 
            onClick={handleUploadAll}
            disabled={archivos.length === 0 || loading}
            className="btn-primary flex items-center gap-2 py-2 px-5 disabled:opacity-50"
          >
            {loading ? 'Subiendo...' : 'Subir todos los extractos'}
          </button>
        </div>
      </div>
    </div>
  )
}
