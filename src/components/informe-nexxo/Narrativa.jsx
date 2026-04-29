export default function Narrativa({ texto }) {
  if (!texto) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {texto.split('\n\n').filter(Boolean).map((p, i) => (
        <p key={i} style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--nx-black)', margin: 0 }}>{p.trim()}</p>
      ))}
    </div>
  )
}
