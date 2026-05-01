import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import PageHeader from '@/components/shared/PageHeader'
import { Plus, X, Edit2, KeyRound, UserCog, ExternalLink, CheckCircle, Copy, UserPlus } from 'lucide-react'

const PLANES = ['diagnostico','cfo_basico','cfo_medio','cfo_full']
const ETAPAS = [1,2,3,4,5]
const ETAPA_L = { 1:'Onboarding', 2:'Diagnóstico', 3:'CFO activo', 4:'Mercado', 5:'Estratégico' }

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-800/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-xl w-full animate-fade-in ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-navy-800">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

const EMPTY_EMP = { nombre:'', cuit:'', rubro:'', plan_servicio:'diagnostico', etapa_numero:1 }
const EMPTY_USR = { email:'', password:'' }

export default function AdminEmpresasPage() {
  const navigate = useNavigate()
  const [empresas,  setEmpresas]  = useState([])
  const [asesores,  setAsesores]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null)
  const [sel,       setSel]       = useState(null)
  const [empForm,   setEmpForm]   = useState(EMPTY_EMP)
  const [usrForm,   setUsrForm]   = useState(EMPTY_USR)
  const [asesorSel, setAsesorSel] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)
  const [credenciales, setCredenciales] = useState(null)

  async function cargar() {
    const [{ data: e }, { data: a }] = await Promise.all([
      // Incluir clientes vinculados para saber si ya tiene cuenta
      supabase.from('empresas')
        .select('*, asesor:asesor_id(nombre), clientes:usuarios!empresa_id(id, rol)')
        .order('nombre'),
      supabase.from('usuarios').select('id, nombre').eq('rol','asesor').order('nombre'),
    ])
    setEmpresas(e || [])
    setAsesores(a || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  // ── Crear empresa ──────────────────────────────────────────────
  async function handleCrear() {
    if (!empForm.nombre) { setError('El nombre es obligatorio.'); return }
    if (!usrForm.email || !usrForm.password) { setError('Completá email y contraseña del portal.'); return }
    if (!supabaseAdmin) { setError('VITE_SUPABASE_SERVICE_KEY no configurada.'); return }
    setSaving(true); setError(null)
    try {
      // 1. Crear empresa
      const { data: emp, error: eErr } = await supabase.from('empresas')
        .insert(empForm).select().single()
      if (eErr) throw eErr

      // 2. Crear usuario de auth
      const { data: auth, error: aErr } = await supabaseAdmin.auth.admin.createUser({
        email: usrForm.email,
        password: usrForm.password,
        email_confirm: true,
        user_metadata: { nombre: empForm.nombre, rol: 'cliente' },
      })
      if (aErr) throw aErr

      // 3. Vincular usuario → empresa
      await supabase.from('usuarios')
        .update({ rol:'cliente', empresa_id: emp.id, nombre: empForm.nombre })
        .eq('id', auth.user.id)

      setCredenciales({ email: usrForm.email, password: usrForm.password, empresa: empForm.nombre })
      cargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Editar empresa ────────────────────────────────────────────
  async function handleEditar() {
    setSaving(true); setError(null)
    const { error: e } = await supabase.from('empresas').update(empForm).eq('id', sel.id)
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null); cargar()
  }

  // ── Asignar asesor ────────────────────────────────────────────
  async function handleAsignar() {
    if (!asesorSel) { setError('Seleccioná un asesor.'); return }
    setSaving(true)
    await supabase.from('empresas').update({ asesor_id: asesorSel }).eq('id', sel.id)
    await supabase.from('asignaciones')
      .upsert({ asesor_id: asesorSel, empresa_id: sel.id }, { onConflict:'asesor_id,empresa_id' })
    setSaving(false); setModal(null); cargar()
  }

  // ── Crear cuenta cliente para empresa existente ───────────────
  async function handleCrearCuenta() {
    if (!usrForm.email || !usrForm.password) { setError('Completá email y contraseña.'); return }
    if (!supabaseAdmin) { setError('VITE_SUPABASE_SERVICE_KEY no configurada.'); return }
    setSaving(true); setError(null)
    try {
      // 1. Crear usuario auth
      const { data: auth, error: aErr } = await supabaseAdmin.auth.admin.createUser({
        email: usrForm.email,
        password: usrForm.password,
        email_confirm: true,
        user_metadata: { nombre: sel.nombre, rol: 'cliente' },
      })
      if (aErr) throw aErr

      // 2. Vincular usuario → empresa
      await supabase.from('usuarios')
        .update({ rol: 'cliente', empresa_id: sel.id, nombre: sel.nombre })
        .eq('id', auth.user.id)

      setCredenciales({ email: usrForm.email, password: usrForm.password, empresa: sel.nombre })
      cargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Cambiar contraseña ─────────────────────────────────────────
  async function handlePassword() {
    if (!usrForm.password) { setError('Ingresá la nueva contraseña.'); return }
    if (!supabaseAdmin) { setError('VITE_SUPABASE_SERVICE_KEY no configurada.'); return }
    // Buscar el usuario vinculado a esta empresa
    const { data: usr } = await supabase.from('usuarios').select('id').eq('empresa_id', sel.id).maybeSingle()
    if (!usr) { setError('No se encontró usuario vinculado.'); return }
    setSaving(true)
    const { error: e } = await supabaseAdmin.auth.admin.updateUserById(usr.id, { password: usrForm.password })
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null)
  }

  // ── Ver portal ────────────────────────────────────────────────
  function handleVerPortal(empresa) {
    localStorage.setItem('impersonating_empresa_id', empresa.id)
    navigate('/dashboard')
  }

  function abrirEditar(emp) {
    setSel(emp)
    setEmpForm({ nombre:emp.nombre, cuit:emp.cuit||'', rubro:emp.rubro||'', plan_servicio:emp.plan_servicio||'diagnostico', etapa_numero:emp.etapa_numero||1 })
    setError(null); setModal('editar')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="Gestión de empresas"
        actions={
          <button onClick={() => { setEmpForm(EMPTY_EMP); setUsrForm(EMPTY_USR); setCredenciales(null); setError(null); setModal('nuevo') }}
            className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Nueva empresa
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="card">
          {loading ? <p className="text-sm text-slate-400 text-center py-8">Cargando...</p> : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Empresa','CUIT','Rubro','Asesor','Etapa','Alta','Acciones'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {empresas.map(e => {
                      const clienteExiste = (e.clientes || []).some(c => c.rol === 'cliente')
                      return (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-navy-800">{e.nombre}</p>
                          {!clienteExiste && (
                            <span className="text-xs text-amber-600 font-medium">⚠ Sin cuenta cliente</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{e.cuit || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{e.rubro || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{e.asesor?.nombre || <span className="text-red-400">Sin asignar</span>}</td>
                        <td className="px-4 py-3"><span className="badge-gray">{ETAPA_L[e.etapa_numero] || '—'}</span></td>
                        <td className="px-4 py-3 text-xs text-slate-400">{new Date(e.created_at).toLocaleDateString('es-AR')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => abrirEditar(e)} title="Editar" className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => { setSel(e); setAsesorSel(e.asesor_id||''); setError(null); setModal('asesor') }} title="Asignar asesor"
                              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                              <UserCog size={13} />
                            </button>
                            {!clienteExiste ? (
                              <button onClick={() => { setSel(e); setUsrForm({ email:'', password:'' }); setCredenciales(null); setError(null); setModal('crear_cuenta') }}
                                title="Crear cuenta portal cliente"
                                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded">
                                <UserPlus size={13} />
                              </button>
                            ) : (
                              <button onClick={() => { setSel(e); setUsrForm({ password:'' }); setError(null); setModal('password') }} title="Cambiar contraseña"
                                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded">
                                <KeyRound size={13} />
                              </button>
                            )}
                            <button onClick={() => handleVerPortal(e)} title="Ver portal" className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-navy-600 hover:bg-navy-50 rounded">
                              <ExternalLink size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Mobile Cards */}
              <div className="md:hidden flex flex-col divide-y divide-slate-100">
                {empresas.map(e => {
                  const clienteExiste = (e.clientes || []).some(c => c.rol === 'cliente')
                  return (
                    <div key={e.id} className="p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-semibold text-navy-800">{e.nombre}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{e.cuit || 'Sin CUIT'} · {e.rubro || 'Sin rubro'}</p>
                        </div>
                        <span className="badge-gray flex-shrink-0">{ETAPA_L[e.etapa_numero] || '—'}</span>
                      </div>
                      
                      {!clienteExiste && (
                        <div className="bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-amber-200 w-fit">
                          ⚠ Sin cuenta cliente
                        </div>
                      )}

                      <div className="flex justify-between items-center text-xs mt-1">
                        <div>
                          <span className="text-slate-400 block mb-0.5 uppercase tracking-wide text-[10px]">Asesor</span>
                          <span className="font-medium text-navy-800">{e.asesor?.nombre || <span className="text-red-400">Sin asignar</span>}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block mb-0.5 uppercase tracking-wide text-[10px]">Alta</span>
                          <span className="text-slate-600">{new Date(e.created_at).toLocaleDateString('es-AR')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1 pt-3 border-t border-slate-100">
                        <button onClick={() => abrirEditar(e)} className="flex-1 py-2 flex justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => { setSel(e); setAsesorSel(e.asesor_id||''); setError(null); setModal('asesor') }} className="flex-1 py-2 flex justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200">
                          <UserCog size={14} />
                        </button>
                        {!clienteExiste ? (
                          <button onClick={() => { setSel(e); setUsrForm({ email:'', password:'' }); setCredenciales(null); setError(null); setModal('crear_cuenta') }} className="flex-1 py-2 flex justify-center text-brand-600 bg-brand-50 hover:bg-brand-100 rounded border border-brand-200">
                            <UserPlus size={14} />
                          </button>
                        ) : (
                          <button onClick={() => { setSel(e); setUsrForm({ password:'' }); setError(null); setModal('password') }} className="flex-1 py-2 flex justify-center text-amber-600 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200">
                            <KeyRound size={14} />
                          </button>
                        )}
                        <button onClick={() => handleVerPortal(e)} className="flex-1 py-2 flex justify-center text-navy-600 bg-navy-50 hover:bg-navy-100 rounded border border-navy-200">
                          <ExternalLink size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal nueva empresa */}
      {modal === 'nuevo' && (
        <Modal title="Nueva empresa" onClose={() => setModal(null)} wide>
          {credenciales ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={18} className="text-brand-500" />
                <p className="font-semibold text-navy-800">Empresa creada correctamente</p>
              </div>
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 mb-4">
                <p className="text-xs font-semibold text-amber-800 mb-2 uppercase tracking-wide">Credenciales del portal — entregá al cliente</p>
                <p className="text-sm text-amber-900"><strong>Empresa:</strong> {credenciales.empresa}</p>
                <p className="text-sm text-amber-900"><strong>Email:</strong> {credenciales.email}</p>
                <p className="text-sm text-amber-900"><strong>Contraseña:</strong> {credenciales.password}</p>
              </div>
              <button onClick={() => { setModal(null); setCredenciales(null) }} className="btn-primary w-full justify-center">Cerrar</button>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Datos de la empresa</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[['nombre','Nombre *'],['cuit','CUIT'],['rubro','Rubro']].map(([k,l]) => (
                  <div key={k} className={k === 'nombre' ? 'col-span-2' : ''}>
                    <label className="label">{l}</label>
                    <input type="text" value={empForm[k]||''} onChange={e => setEmpForm(p => ({ ...p, [k]: e.target.value }))} className="input" />
                  </div>
                ))}
                <div>
                  <label className="label">Plan de servicio</label>
                  <select value={empForm.plan_servicio} onChange={e => setEmpForm(p => ({ ...p, plan_servicio: e.target.value }))} className="input">
                    {PLANES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Etapa</label>
                  <select value={empForm.etapa_numero} onChange={e => setEmpForm(p => ({ ...p, etapa_numero: Number(e.target.value) }))} className="input">
                    {ETAPAS.map(n => <option key={n} value={n}>{n} — {ETAPA_L[n]}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Acceso al portal del cliente</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="label">Email</label>
                  <input type="email" value={usrForm.email} onChange={e => setUsrForm(p => ({ ...p, email: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="label">Contraseña inicial</label>
                  <input type="text" value={usrForm.password} onChange={e => setUsrForm(p => ({ ...p, password: e.target.value }))} className="input" />
                </div>
              </div>
              {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setModal(null)} className="btn-secondary text-sm">Cancelar</button>
                <button onClick={handleCrear} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
                  {saving ? 'Creando...' : 'Crear empresa y usuario'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Modal editar */}
      {modal === 'editar' && (
        <Modal title={`Editar — ${sel?.nombre}`} onClose={() => setModal(null)}>
          <div className="space-y-3">
            {[['nombre','Nombre'],['cuit','CUIT'],['rubro','Rubro']].map(([k,l]) => (
              <div key={k}>
                <label className="label">{l}</label>
                <input type="text" value={empForm[k]||''} onChange={e => setEmpForm(p => ({ ...p, [k]: e.target.value }))} className="input" />
              </div>
            ))}
            <div>
              <label className="label">Plan</label>
              <select value={empForm.plan_servicio} onChange={e => setEmpForm(p => ({ ...p, plan_servicio: e.target.value }))} className="input">
                {PLANES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Etapa</label>
              <select value={empForm.etapa_numero} onChange={e => setEmpForm(p => ({ ...p, etapa_numero: Number(e.target.value) }))} className="input">
                {ETAPAS.map(n => <option key={n} value={n}>{n} — {ETAPA_L[n]}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setModal(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleEditar} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal asignar asesor */}
      {modal === 'asesor' && (
        <Modal title={`Asignar asesor — ${sel?.nombre}`} onClose={() => setModal(null)}>
          <label className="label">Asesor</label>
          <select value={asesorSel} onChange={e => setAsesorSel(e.target.value)} className="input mb-4">
            <option value="">Sin asesor</option>
            {asesores.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleAsignar} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
              {saving ? 'Guardando...' : 'Asignar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal contraseña */}
      {modal === 'password' && (
        <Modal title={`Contraseña — ${sel?.nombre}`} onClose={() => setModal(null)}>
          <label className="label">Nueva contraseña del portal</label>
          <input type="text" value={usrForm.password} onChange={e => setUsrForm(p => ({ ...p, password: e.target.value }))} className="input mb-4" />
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handlePassword} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
              {saving ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal crear cuenta cliente */}
      {modal === 'crear_cuenta' && (
        <Modal title={`Crear portal cliente — ${sel?.nombre}`} onClose={() => { setModal(null); setCredenciales(null) }}>
          {credenciales ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={18} className="text-brand-500" />
                <p className="font-semibold text-navy-800">Cuenta creada correctamente</p>
              </div>
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 mb-4">
                <p className="text-xs font-semibold text-amber-800 mb-2 uppercase tracking-wide">
                  Credenciales del portal — entregá al cliente
                </p>
                <p className="text-sm text-amber-900"><strong>Empresa:</strong> {credenciales.empresa}</p>
                <p className="text-sm text-amber-900"><strong>Email:</strong> {credenciales.email}</p>
                <p className="text-sm text-amber-900"><strong>Contraseña:</strong> {credenciales.password}</p>
              </div>
              <button onClick={() => { setModal(null); setCredenciales(null) }} className="btn-primary w-full justify-center">
                Cerrar
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-500 mb-4">
                Vas a crear las credenciales de acceso al portal para <strong>{sel?.nombre}</strong>.
                El cliente va a poder ver su dashboard, documentos y mensajes con estas credenciales.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="label">Email del cliente</label>
                  <input type="email" value={usrForm.email}
                    onChange={e => setUsrForm(p => ({ ...p, email: e.target.value }))}
                    className="input" placeholder="cliente@empresa.com" />
                </div>
                <div>
                  <label className="label">Contraseña inicial</label>
                  <input type="text" value={usrForm.password}
                    onChange={e => setUsrForm(p => ({ ...p, password: e.target.value }))}
                    className="input" placeholder="Mínimo 8 caracteres" />
                </div>
              </div>
              {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setModal(null)} className="btn-secondary text-sm">Cancelar</button>
                <button onClick={handleCrearCuenta} disabled={saving}
                  className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60">
                  <UserPlus size={14} />
                  {saving ? 'Creando...' : 'Crear cuenta portal'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
