export default function InstrumentoCard({ instrumento }) {
  return (
    <div style={{ padding: '14px 16px', border: '1px solid var(--nx-topo-xl)', background: 'var(--nx-off)', borderRadius: 3 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--nx-black)', marginBottom: 2 }}>{instrumento.nombre}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--nx-black)', fontFamily: 'var(--nx-font-serif)', marginBottom: 8 }}>
        {instrumento.cupo_estimado}
      </p>
      <p style={{ fontSize: 12, color: 'var(--nx-gray)', marginBottom: 6, lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--nx-black)' }}>Para qué sirve:</strong> {instrumento.para_que_sirve}
      </p>
      <p style={{ fontSize: 12, color: 'var(--nx-gray)', lineHeight: 1.5, margin: 0 }}>
        <strong style={{ color: 'var(--nx-black)' }}>Por qué aplica:</strong> {instrumento.por_que_aplica}
      </p>
    </div>
  )
}
