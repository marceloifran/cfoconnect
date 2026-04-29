export default function PlanTimeline({ acciones }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {(acciones || []).map((a, i) => (
        <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: 'var(--nx-black)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
            }}>
              {a.prioridad}
            </div>
            {i < (acciones.length - 1) && (
              <div style={{ width: 1, flex: 1, background: 'var(--nx-topo-xl)', marginTop: 6 }} />
            )}
          </div>
          <div style={{ flex: 1, paddingTop: 4 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--nx-black)', marginBottom: 6 }}>{a.accion}</p>
            <p style={{ fontSize: 12.5, color: 'var(--nx-gray)', lineHeight: 1.6, marginBottom: 8 }}>
              <strong style={{ color: 'var(--nx-black)' }}>Para qué:</strong> {a.para_que}
            </p>
            <div style={{ padding: '8px 12px', background: 'var(--nx-off)', borderLeft: '3px solid var(--nx-topo)', borderRadius: '0 3px 3px 0', marginBottom: 6 }}>
              <p style={{ fontSize: 12, color: 'var(--nx-black)', margin: 0 }}>
                <strong>Primer paso:</strong> {a.primer_paso}
              </p>
            </div>
            {a.herramienta_nexxo && (
              <p style={{ fontSize: 11, color: 'var(--nx-topo)', fontStyle: 'italic', margin: 0 }}>{a.herramienta_nexxo}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
