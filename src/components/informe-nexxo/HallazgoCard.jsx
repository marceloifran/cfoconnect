import { CheckCircle, AlertTriangle } from 'lucide-react'

export default function HallazgoCard({ hallazgo }) {
  const esFortaleza = hallazgo.tipo === 'fortaleza'
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 3,
      border: `1px solid ${esFortaleza ? 'var(--nx-green-bd)' : 'var(--nx-red-bd)'}`,
      background: esFortaleza ? 'var(--nx-green-bg)' : 'var(--nx-red-bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {esFortaleza
          ? <CheckCircle size={14} style={{ color: 'var(--nx-green)', marginTop: 2, flexShrink: 0 }} />
          : <AlertTriangle size={14} style={{ color: 'var(--nx-red)', marginTop: 2, flexShrink: 0 }} />}
        <div>
          <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.05em',
            color: esFortaleza ? 'var(--nx-green)' : 'var(--nx-red)',
            textTransform: 'uppercase', marginBottom: 3 }}>
            {esFortaleza ? 'Fortaleza' : 'Alerta'}
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--nx-black)', marginBottom: 4 }}>{hallazgo.titulo}</p>
          <p style={{ fontSize: 12.5, color: 'var(--nx-gray)', lineHeight: 1.6, margin: 0 }}>{hallazgo.detalle}</p>
        </div>
      </div>
    </div>
  )
}
