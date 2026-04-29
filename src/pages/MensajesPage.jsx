import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/shared/PageHeader'
import { Send } from 'lucide-react'

export default function MensajesPage() {
  const { empresa, profile, isAsesor } = useAuth()
  const [mensajes, setMensajes] = useState([])
  const [texto,    setTexto]    = useState('')
  const [loading,  setLoading]  = useState(true)
  const [sending,  setSending]  = useState(false)
  const bottomRef = useRef(null)

  async function cargar() {
    if (!empresa?.id) return
    const { data } = await supabase.from('mensajes').select('*')
      .eq('empresa_id', empresa.id).order('created_at', { ascending: true })
    setMensajes(data || [])
    setLoading(false)
    // Marcar como leídos los mensajes del otro lado
    const rolOtro = isAsesor ? 'cliente' : 'asesor'
    await supabase.from('mensajes')
      .update({ leido: true })
      .eq('empresa_id', empresa.id)
      .eq('remitente_rol', rolOtro)
      .eq('leido', false)
  }

  useEffect(() => { cargar() }, [empresa?.id])

  // Suscripción real-time
  useEffect(() => {
    if (!empresa?.id) return
    const channel = supabase.channel(`mensajes-${empresa.id}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'mensajes',
        filter: `empresa_id=eq.${empresa.id}`,
      }, payload => {
        setMensajes(prev => [...prev, payload.new])
        // Marcar como leído si es del otro lado
        const rolOtro = isAsesor ? 'cliente' : 'asesor'
        if (payload.new.remitente_rol === rolOtro) {
          supabase.from('mensajes').update({ leido: true }).eq('id', payload.new.id)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [empresa?.id])

  // Scroll al fondo cuando llegan mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  async function handleEnviar(e) {
    e.preventDefault()
    if (!texto.trim() || !empresa?.id) return
    setSending(true)
    await supabase.from('mensajes').insert({
      empresa_id:    empresa.id,
      remitente_id:  profile?.id,
      remitente_rol: profile?.rol || (isAsesor ? 'asesor' : 'cliente'),
      contenido:     texto.trim(),
    })
    setTexto('')
    setSending(false)
  }

  const miRol = profile?.rol || (isAsesor ? 'asesor' : 'cliente')

  if (!empresa) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-slate-400">Sin empresa seleccionada.</p>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="Mensajes"
        subtitle={empresa.nombre}
      />

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {loading && <p className="text-center text-sm text-slate-400 py-8">Cargando mensajes...</p>}

        {!loading && mensajes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-slate-400">No hay mensajes todavía.</p>
            <p className="text-xs text-slate-300 mt-1">
              {isAsesor ? 'Podés enviar un mensaje al cliente.' : 'Tu asesor todavía no te escribió.'}
            </p>
          </div>
        )}

        {mensajes.map(msg => {
          const esMio = msg.remitente_rol === miRol
          const hora  = new Date(msg.created_at).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })
          const dia   = new Date(msg.created_at).toLocaleDateString('es-AR', { day:'2-digit', month:'short' })
          return (
            <div key={msg.id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[72%] rounded-2xl px-4 py-2.5 shadow-sm
                ${esMio
                  ? 'bg-brand-600 text-white rounded-br-sm'
                  : 'bg-white text-navy-800 border border-slate-100 rounded-bl-sm'}`}>
                {!esMio && (
                  <p className={`text-xs font-semibold mb-0.5 ${esMio ? 'text-brand-100' : 'text-brand-600'}`}>
                    {msg.remitente_rol === 'asesor' ? 'Tu asesor' : 'Empresa'}
                  </p>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.contenido}</p>
                <p className={`text-xs mt-1 text-right ${esMio ? 'text-brand-200' : 'text-slate-400'}`}>
                  {dia} {hora}
                  {esMio && (
                    <span className="ml-1">{msg.leido ? '✓✓' : '✓'}</span>
                  )}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleEnviar} className="flex items-center gap-3 px-4 py-3 bg-white border-t border-slate-200">
        <input
          type="text"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escribí un mensaje..."
          className="input flex-1"
          disabled={sending}
        />
        <button type="submit" disabled={!texto.trim() || sending}
          className="btn-primary flex items-center gap-2 flex-shrink-0 disabled:opacity-50">
          <Send size={15} />
        </button>
      </form>
    </div>
  )
}
