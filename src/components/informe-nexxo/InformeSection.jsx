export default function InformeSection({ id, titulo, children }) {
  return (
    <section id={id} style={{ marginBottom: 32, scrollMarginTop: 80 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 16, paddingBottom: 10,
        borderBottom: '1px solid var(--nx-line)',
      }}>
        <div style={{ width: 3, height: 20, background: 'var(--nx-amber)', borderRadius: 2, flexShrink: 0 }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--nx-black)', margin: 0 }}>{titulo}</h2>
      </div>
      {children}
    </section>
  )
}
