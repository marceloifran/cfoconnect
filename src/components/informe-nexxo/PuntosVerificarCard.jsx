export default function PuntosVerificarCard({ puntos }) {
  if (!puntos?.length) return null
  return (
    <div style={{
      padding: '16px 18px', background: 'var(--nx-amber-bg)',
      border: '1px solid var(--nx-amber-bd)', borderLeft: '4px solid var(--nx-amber)', borderRadius: 3,
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--nx-amber)', marginBottom: 10 }}>
        Solo visible para el asesor — Antes de publicar, verificar:
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {puntos.map((p, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', background: 'var(--nx-amber)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1,
            }}>
              {i + 1}
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--nx-black)', lineHeight: 1.6, margin: 0 }}>{p}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
