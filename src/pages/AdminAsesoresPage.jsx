import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import PageHeader from '@/components/shared/PageHeader'
import { Plus, X, Eye, KeyRound, UserMinus, AlertTriangle, CheckCircle } from 'lucide-react'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-800/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-navy-800">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

export default function AdminAsesoresPage() {
  const [asesores, setAsesores] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal,   setModal]     = useState(null) // 'nuevo' | 'password' | 'empresas'
  const [sel,     setSel]       = useState(null)
  const [form,    setForm]      = useState({ nombre:'', email:'', password:'' })
  const [saving,  setSaving]    = useState(false)
  const [error,   setError]     = useState(null)
  const [ok,      setOk]        = useState(null)
  const [empresasSel, setEmpresasSel] = useState([])

  async function cargar() {
    const { data } = await supabase
      .from('usuarios')
      .select('*, empresas:asignaciones(empresa_id)')
      .eq('rol', 'asesor')
      .order('nombre')
    setAsesores(data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  function abrirNuevo() {
    setForm({ nombre:'', email:'', password:'' })
    setError(null); setOk(null); setModal('nuevo')
  }

  async function handleCrear() {
    if (!form.nombre || !form.email || !form.password) {
      setError('Completá todos los campos.'); return
    }
    if (!supabaseAdmin) {
      setError('VITE_SUPABASE_SERVICE_KEY no configurada en .env.local'); return
    }
    setSaving(true); setError(null)
    try {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: form.email,
        password: form.password,
        email_confirm: true,
        user_metadata: { nombre: form.nombre, rol: 'asesor' },
      })
      if (authErr) throw authErr

      // El trigger on_auth_user_created crea la fila en usuarios.
      // Actualizamos rol y nombre para asegurarnos.
      await supabase.from('usuarios')
        .update({ rol: 'asesor', nombre: form.nombre })
        .eq('id', authData.user.id)

      setOk(`Asesor ${form.nombre} creado correctamente.`)
      cargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCambiarPassword() {
    if (!form.password) { setError('Ingresá la nueva contraseña.'); return }
    if (!supabaseAdmin) { setError('VITE_SUPABASE_SERVICE_KEY no configurada.'); return }
    setSaving(true); setError(null)
    try {
      const { error: e } = await supabaseAdmin.auth.admin.updateUserById(sel.id, { password: form.password })
      if (e) throw e
      setOk('Contraseña actualizada.')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDesactivar(asesor) {
    if (!confirm(`¿Desactivar a ${asesor.nombre}?`)) return
    await supabase.from('usuarios').update({ activo: false }).eq('id', asesor.id)
    cargar()
  }

  async function abrirEmpresas(asesor) {
    setSel(asesor)
    const { data } = await supabase
      .from('asignaciones')
      .select('*, empresas(nombre)')
      .eq('asesor_id', asesor.id)
    setEmpresasSel(data || [])
    setModal('empresas')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="Gestión de asesores"
        actions={
          <button onClick={abrirNuevo} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Nuevo asesor
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="card">
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Nombre','Email','Empresas asignadas','Alta','Estado','Acciones'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {asesores.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-navy-800">{a.nombre || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{a.id}</td>
                        <td className="px-4 py-3 text-center">{a.empresas?.length ?? 0}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{new Date(a.created_at).toLocaleDateString('es-AR')}</td>
                        <td className="px-4 py-3">
                          <span className={a.activo !== false ? 'badge-green' : 'badge-gray'}>
                            {a.activo !== false ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => abrirEmpresas(a)} title="Ver empresas"
                              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => { setSel(a); setForm({ password:'' }); setError(null); setOk(null); setModal('password') }} title="Cambiar contraseña"
                              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors">
                              <KeyRound size={14} />
                            </button>
                            {a.activo !== false && (
                              <button onClick={() => handleDesactivar(a)} title="Desactivar"
                                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                <UserMinus size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden flex flex-col divide-y divide-slate-100">
                {asesores.map(a => (
                  <div key={a.id} className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-semibold text-navy-800">{a.nombre || '—'}</p>
                        <p className="text-xs text-slate-500 mt-0.5 break-all">{a.id}</p>
                      </div>
                      <span className={`flex-shrink-0 ${a.activo !== false ? 'badge-green' : 'badge-gray'}`}>
                        {a.activo !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs mt-1">
                      <div>
                        <span className="text-slate-400 block mb-0.5 uppercase tracking-wide text-[10px]">Empresas</span>
                        <span className="font-medium text-navy-800">{a.empresas?.length ?? 0} asignadas</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block mb-0.5 uppercase tracking-wide text-[10px]">Alta</span>
                        <span className="text-slate-600">{new Date(a.created_at).toLocaleDateString('es-AR')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-1 pt-3 border-t border-slate-100">
                      <button onClick={() => abrirEmpresas(a)} className="flex-1 py-2 flex justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => { setSel(a); setForm({ password:'' }); setError(null); setOk(null); setModal('password') }} className="flex-1 py-2 flex justify-center text-amber-600 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200">
                        <KeyRound size={14} />
                      </button>
                      {a.activo !== false && (
                        <button onClick={() => handleDesactivar(a)} className="flex-1 py-2 flex justify-center text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200">
                          <UserMinus size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal nuevo asesor */}
      {modal === 'nuevo' && (
        <Modal title="Nuevo asesor" onClose={() => setModal(null)}>
          <div className="space-y-3">
            {['nombre','email','password'].map(k => (
              <div key={k}>
                <label className="label capitalize">{k === 'password' ? 'Contraseña inicial' : k}</label>
                <input type={k === 'password' ? 'password' : k === 'email' ? 'email' : 'text'}
                  value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                  className="input" placeholder={k === 'email' ? 'asesor@ejemplo.com' : ''} />
              </div>
            ))}
            {error && <p className="text-xs text-red-600">{error}</p>}
            {ok    && <p className="text-xs text-brand-600 flex items-center gap-1"><CheckCircle size={12}/>{ok}</p>}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setModal(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleCrear} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
              {saving ? 'Creando...' : 'Crear asesor'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal contraseña */}
      {modal === 'password' && (
        <Modal title={`Contraseña — ${sel?.nombre}`} onClose={() => setModal(null)}>
          <label className="label">Nueva contraseña</label>
          <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className="input mb-3" />
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          {ok    && <p className="text-xs text-brand-600 mb-2 flex items-center gap-1"><CheckCircle size={12}/>{ok}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleCambiarPassword} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
              {saving ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal empresas asignadas */}
      {modal === 'empresas' && (
        <Modal title={`Empresas de ${sel?.nombre}`} onClose={() => setModal(null)}>
          {empresasSel.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Sin empresas asignadas.</p>
          ) : (
            <ul className="space-y-1.5">
              {empresasSel.map(a => (
                <li key={a.empresa_id} className="text-sm text-navy-800 py-1.5 border-b border-slate-100 last:border-0">
                  {a.empresas?.nombre || a.empresa_id}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  )
}
