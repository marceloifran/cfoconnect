import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export default function GlosarioAcordeon({ terminos }) {
  const [abiertos, setAbiertos] = useState(new Set())
  const toggle = (i) => setAbiertos(prev => {
    const s = new Set(prev)
    s.has(i) ? s.delete(i) : s.add(i)
    return s
  })
  return (
    <div style={{ border: '1px solid var(--nx-topo-xl)', borderRadius: 3, overflow: 'hidden' }}>
      {(terminos || []).map((t, i) => (
        <div key={i} style={{ borderBottom: i < terminos.length - 1 ? '1px solid var(--nx-topo-xl)' : 'none' }}>
          <button onClick={() => toggle(i)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--nx-black)' }}>{t.termino}</span>
            {abiertos.has(i)
              ? <ChevronDown size={14} style={{ color: 'var(--nx-topo)', flexShrink: 0 }} />
              : <ChevronRight size={14} style={{ color: 'var(--nx-topo)', flexShrink: 0 }} />}
          </button>
          {abiertos.has(i) && (
            <div style={{ padding: '0 16px 12px', background: 'var(--nx-off)' }}>
              <p style={{ fontSize: 12.5, color: 'var(--nx-gray)', lineHeight: 1.6, margin: 0 }}>{t.definicion}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
