/**
 * InformeRenderer — renderiza el contenido completo del Informe NEXXO.
 * Usado por la vista del cliente (MiInformePage) en layout 2 columnas.
 * La vista del asesor (InformeNexxoPage) tiene su propia lógica de layout 3 columnas.
 */

import { useEffect, useState } from 'react'
import InformeSection from './InformeSection'
import Narrativa       from './Narrativa'
import HallazgoCard    from './HallazgoCard'
import InstrumentoCard from './InstrumentoCard'
import PlanTimeline    from './PlanTimeline'
import GlosarioAcordeon from './GlosarioAcordeon'
import PuntosVerificarCard from './PuntosVerificarCard'
import SidebarNav      from './SidebarNav'

export default function InformeRenderer({ contenidoJson, mode = 'cliente' }) {
  const [activeSection, setActiveSection] = useState('carta')
  const c = contenidoJson || {}
  const mc = c.mapa_de_capital || {}

  // IntersectionObserver para sección activa
  useEffect(() => {
    const ids = ['carta','resumen','quienes','numeros','voz','capital','plan','cierre','verificar']
    const observer = new IntersectionObserver(
      entries => { entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id) }) },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    ids.forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [contenidoJson])

  if (!contenidoJson) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: 'var(--nx-topo)' }}>Sin contenido disponible.</p>
    </div>
  )

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

      {/* Columna izquierda — sidebar nav */}
      <div style={{
        width: 220, flexShrink: 0,
        borderRight: '1px solid var(--nx-line)',
        overflowY: 'auto', padding: '20px 16px',
        background: 'var(--nx-off)',
      }}>
        <SidebarNav
          contenidoJson={c}
          activeSection={activeSection}
          mode={mode}
        />
      </div>

      {/* Columna central — contenido del informe */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>

        {/* Portada */}
        <div style={{ padding: '20px 24px', marginBottom: 28, background: 'var(--nx-black)', borderRadius: 3 }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 4 }}>
            NEXXO CAPITAL — Informe Diagnóstico
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--nx-font-serif)', color: 'white', margin: '0 0 4px' }}>
            {c.portada?.empresa}
          </h1>
          <div style={{ display: 'flex', gap: 16 }}>
            <span style={{ fontSize: 11.5, color: 'var(--nx-topo)' }}>CUIT {c.portada?.cuit}</span>
            <span style={{ fontSize: 11.5, color: 'var(--nx-topo)' }}>Período {c.portada?.periodo}</span>
            <span style={{ fontSize: 11.5, color: 'var(--nx-topo)' }}>{c.portada?.fecha_emision}</span>
          </div>
        </div>

        {/* Carta inicial */}
        <InformeSection id="carta" titulo="Carta inicial">
          <div style={{ padding: '18px 20px', background: 'var(--nx-off)', borderRadius: 3, borderLeft: '3px solid var(--nx-amber)' }}>
            <Narrativa texto={c.carta_inicial} />
          </div>
        </InformeSection>

        {/* Resumen ejecutivo */}
        <InformeSection id="resumen" titulo="Resumen ejecutivo">
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, padding: '14px 16px', background: 'var(--nx-off)', borderRadius: 3, marginBottom: 12 }}>
            <div style={{ textAlign: 'center', padding: '8px 16px' }}>
              <p style={{ fontSize: 48, fontWeight: 700, fontFamily: 'var(--nx-font-serif)', color: 'var(--nx-black)', lineHeight: 1, margin: 0 }}>
                {c.resumen_ejecutivo?.score_sgr}
              </p>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--nx-amber)', margin: '2px 0 0' }}>
                {c.resumen_ejecutivo?.categoria_sgr}
              </p>
              <p style={{ fontSize: 10, color: 'var(--nx-topo)', margin: 0 }}>/ 100</p>
            </div>
            <div style={{ borderLeft: '1px solid var(--nx-line)', paddingLeft: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 8 }}>Puntos clave</p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(c.resumen_ejecutivo?.puntos_clave || []).map((p, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--nx-amber)', marginTop: 5, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--nx-black)', lineHeight: 1.5 }}>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </InformeSection>

        {/* Quiénes son hoy */}
        <InformeSection id="quienes" titulo="Quiénes son hoy">
          <Narrativa texto={c.quienes_son_hoy} />
        </InformeSection>

        {/* Qué dicen los números */}
        <InformeSection id="numeros" titulo="Qué dicen los números">
          <div style={{ marginBottom: 20 }}>
            <Narrativa texto={c.que_dicen_los_numeros?.narrativa} />
          </div>
          {(c.que_dicen_los_numeros?.hallazgos || []).length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {c.que_dicen_los_numeros.hallazgos.map((h, i) => (
                <HallazgoCard key={i} hallazgo={h} />
              ))}
            </div>
          )}
        </InformeSection>

        {/* Voz de la empresa */}
        <InformeSection id="voz" titulo="Voz de la empresa">
          <div style={{ padding: '16px 18px', background: '#EEF2FF', borderRadius: 3, borderLeft: '3px solid var(--nx-indigo, #4F46E5)' }}>
            <Narrativa texto={c.voz_de_la_empresa} />
          </div>
        </InformeSection>

        {/* Mapa de capital */}
        <InformeSection id="capital" titulo="Mapa de capital">
          {mc.que_es_mercado_capitales && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 8 }}>El mercado de capitales</p>
              <Narrativa texto={mc.que_es_mercado_capitales} />
            </div>
          )}
          {mc.introduccion_sgr && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 8 }}>Qué es una SGR</p>
              <Narrativa texto={mc.introduccion_sgr} />
            </div>
          )}
          {mc.lectura_categoria && (
            <div style={{ padding: '12px 16px', background: 'var(--nx-off)', border: '1px solid var(--nx-topo-xl)', borderRadius: 3, marginBottom: 20 }}>
              <Narrativa texto={mc.lectura_categoria} />
            </div>
          )}
          {(mc.instrumentos_disponibles || []).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 12 }}>Instrumentos disponibles</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {mc.instrumentos_disponibles.map((inst, i) => <InstrumentoCard key={i} instrumento={inst} />)}
              </div>
            </div>
          )}
          {(mc.tipos_operatoria_recomendada || []).length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 12 }}>Operatorias recomendadas</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mc.tipos_operatoria_recomendada.map((op, i) => (
                  <div key={i} style={{ padding: '12px 14px', border: '1px solid var(--nx-topo-xl)', borderRadius: 3 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--nx-black)', marginBottom: 4 }}>
                      <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 2, background: '#EEF2FF', color: '#4F46E5', fontSize: 10, fontWeight: 700, marginRight: 8 }}>{op.categoria}</span>
                      {op.descripcion_simple}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--nx-gray)', margin: 0 }}>{op.justificacion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </InformeSection>

        {/* Plan 90 días */}
        <InformeSection id="plan" titulo="Plan 90 días">
          <PlanTimeline acciones={c.plan_90_dias} />
        </InformeSection>

        {/* Cierre */}
        <InformeSection id="cierre" titulo="Cierre">
          {c.cierre?.mensaje_final && (
            <div style={{ padding: '18px 20px', marginBottom: 20, background: 'var(--nx-black)', borderRadius: 3 }}>
              <Narrativa texto={c.cierre.mensaje_final} />
            </div>
          )}
          {(c.cierre?.glosario || []).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--nx-topo)', marginBottom: 10 }}>Glosario</p>
              <GlosarioAcordeon terminos={c.cierre.glosario} />
            </div>
          )}
          {c.cierre?.disclaimer && (
            <p style={{ fontSize: 11, color: 'var(--nx-topo)', lineHeight: 1.6, fontStyle: 'italic' }}>{c.cierre.disclaimer}</p>
          )}
        </InformeSection>

        {/* Puntos a verificar — solo asesor */}
        {mode === 'asesor' && (c.puntos_a_verificar_interno || []).length > 0 && (
          <InformeSection id="verificar" titulo="Puntos a verificar antes de publicar">
            <PuntosVerificarCard puntos={c.puntos_a_verificar_interno} />
          </InformeSection>
        )}

      </div>
    </div>
  )
}
