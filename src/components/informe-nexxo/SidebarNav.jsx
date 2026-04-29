import { RefreshCw } from 'lucide-react'

const SECCIONES_BASE = [
  { id: 'carta',     label: 'Carta inicial'        },
  { id: 'resumen',   label: 'Resumen ejecutivo'     },
  { id: 'quienes',   label: 'Quiénes son hoy'       },
  { id: 'numeros',   label: 'Qué dicen los números' },
  { id: 'voz',       label: 'Voz de la empresa'     },
  { id: 'capital',   label: 'Mapa de capital'       },
  { id: 'plan',      label: 'Plan 90 días'          },
  { id: 'cierre',    label: 'Cierre'                },
  // solo asesor:
  { id: 'verificar', label: 'Puntos a verificar', asesorOnly: true },
]

export { SECCIONES_BASE }

export default function SidebarNav({ contenidoJson, activeSection, mode = 'cliente', onRegenerar }) {
  const secciones = SECCIONES_BASE.filter(s => mode === 'asesor' || !s.asesorOnly)
  const re = contenidoJson?.resumen_ejecutivo

  return (
    <div>
      {re && (
        <div style={{
          padding: '10px 12px', marginBottom: 16,
          background: 'var(--nx-off)', borderRadius: 3, border: '1px solid var(--nx-topo-xl)',
        }}>
          <p style={{ fontSize: 11, color: 'var(--nx-topo)', marginBottom: 2 }}>Categoría SGR</p>
          <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--nx-font-serif)', color: 'var(--nx-black)', lineHeight: 1 }}>
            {re.categoria_sgr}
          </p>
          <p style={{ fontSize: 11, color: 'var(--nx-topo)', marginTop: 2 }}>Score {re.score_sgr}/100</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {secciones.map(s => (
          <a key={s.id} href={`#${s.id}`}
            style={{
              display: 'block', padding: '6px 10px', borderRadius: 3, textDecoration: 'none',
              fontSize: 12.5, fontWeight: activeSection === s.id ? 600 : 400,
              color: activeSection === s.id ? 'var(--nx-black)' : 'var(--nx-gray)',
              background: activeSection === s.id ? 'var(--nx-off)' : 'transparent',
              borderLeft: activeSection === s.id ? '2px solid var(--nx-amber)' : '2px solid transparent',
              transition: 'all 0.1s',
            }}>
            {s.label}
          </a>
        ))}
      </div>

      {onRegenerar && (
        <button onClick={onRegenerar}
          style={{
            marginTop: 16, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '8px 0', fontSize: 11, fontWeight: 600, color: 'var(--nx-topo)',
            background: 'transparent', border: '1px solid var(--nx-topo-xl)', borderRadius: 3, cursor: 'pointer',
          }}>
          <RefreshCw size={12} /> Regenerar
        </button>
      )}
    </div>
  )
}
