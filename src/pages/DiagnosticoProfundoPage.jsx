import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/shared/PageHeader'
import {
  ChevronLeft, ChevronRight, Save, Sparkles,
  Plus, X, CheckCircle, AlertTriangle,
  Building2, TrendingUp, Wallet, Target, Brain,
} from 'lucide-react'

// ── Dimensiones del cuestionario ───────────────────────────────────
const DIMS = [
  { n: 1, label: 'Identidad',      icon: Building2  },
  { n: 2, label: 'Negocio',        icon: TrendingUp },
  { n: 3, label: 'Costos',         icon: Wallet     },
  { n: 4, label: 'Finanzas',       icon: Wallet     },
  { n: 5, label: 'Visión',         icon: Target     },
]

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ── Estado inicial por dimensión ───────────────────────────────────
const EMPTY_D1 = {
  industria: '', propuesta_valor: '', alcance: '', competencia_por: '',
  antiguedad: '', etapa: '', forma_juridica: '',
  cantidad_socios: '', socios_gestion: false, empresas_vinculadas: false,
  // ✅ NUEVOS — críticos para scoring y árbol de decisiones
  es_epyme: false, inscripta_registro_pyme: false,
  cuit: '', condicion_afip: '', provincia_fiscal: '',
}

const EMPTY_D2 = {
  lineas_negocio: [{ nombre: '', pct: '' }],
  tipo_ingresos: '', estacionalidad: '',
  meses_buenos: [], meses_malos: [], financiamiento_meses_malos: '',
  concentracion_top3: '', contratos_firmados: false,
  clientes_publicos: false, pct_clientes_publicos: '',
  // ✅ NUEVO — canales de venta
  canales_venta: [],
  exporta: false, importa: false, moneda: '',
  // ✅ NUEVO — certificaciones
  tiene_certificaciones: false, certificaciones: [],
}

const EMPTY_D3 = {
  principal_costo: '', pct_fijos: '', costos_dolarizados: false,
  dias_pago_proveedores: '', descuentos_pronto_pago: false,
  forma_pago: [], tiene_stock: false, dias_rotacion: '',
  produce_revende: '',
  // ✅ NUEVO — empleados
  empleados_formales: '', empleados_informales: '',
}

const EMPTY_D4 = {
  bancos: '', lineas_credito: false, tasa_credito: '',
  rechazos_credito: false, usa_descubierto: false,
  cheques_rechazados: false, deuda_financiera: false,
  monto_deuda: '', tasa_deuda: '',
  deuda_afip: false, deuda_informal: false,
  manejo_excedente: [], dias_cobertura_caja: '',
  // ✅ CRÍTICOS — árbol de decisiones nodos 3 y 4
  tiene_aval_sgr: false, sgr_nombre: '', sgr_cupo_disponible: '',
  tiene_cuenta_comitente: false, alyc_nombre: '',
  // ✅ NUEVO — activos como garantía (scoring 10%)
  inmuebles_propios: false, valor_inmuebles: '',
  maquinaria_relevante: false, valor_maquinaria: '',
}

const EMPTY_D5 = {
  problema_financiero: '', decision_pendiente: '',
  perdio_oportunidad: false, descripcion_oportunidad: '',
  objetivo_12meses: '', inversion_planeada: false,
  descripcion_inversion: '', monto_inversion: '',
  objetivo_largo_plazo: '',
  // ✅ NUEVO — intención societaria
  planea_vender_empresa: false, planea_sumar_socios: false,
  expectativa_cfoconnect: '',
  // Mercado capitales
  conoce_mercado: false, opero_bolsa: false,
  cuenta_comitente: false, conoce_on_echeq: false, miedos_bolsa: '',
}

const EMPTY_FORM = { d1: EMPTY_D1, d2: EMPTY_D2, d3: EMPTY_D3, d4: EMPTY_D4, d5: EMPTY_D5 }

// ── Prompt de IA mejorado ──────────────────────────────────────────
const SYSTEM_DP = `Sos un CFO senior y estructurador financiero experto en el mercado de capitales argentino, especializado en PyMEs.
Analizá el diagnóstico profundo de la empresa y generá un informe estructurado usando exactamente estos títulos:

PERFIL DE LA EMPRESA:
[Descripción del negocio, modelo, posicionamiento, idiosincrasia del sector en Argentina]

SEMAFORO FINANCIERO:
[Una línea por dimensión con formato: Dimensión: VERDE/AMARILLO/ROJO — motivo concreto]

FORTALEZAS:
[3 a 5 puntos concretos de la empresa]

RIESGOS Y DEBILIDADES:
[3 a 5 puntos concretos con impacto real]

OPORTUNIDADES DE MEJORA:
[Acciones específicas y realizables en el contexto PyME argentino]

PRODUCTOS BEAT VALORES RECOMENDADOS:
Tesorería: RECOMENDAR/NO APLICA — [razón concreta]
Financiamiento: RECOMENDAR/NO APLICA — [razón concreta]
Cobertura: RECOMENDAR/NO APLICA — [razón concreta]
Portafolio: RECOMENDAR/NO APLICA — [razón concreta]

RUTA AL MERCADO DE CAPITALES:
[Indicar en qué etapa está (1 a 6) y qué necesita para avanzar a la siguiente]
Etapa actual: [número]
Próximo paso: [acción concreta]

HOJA DE RUTA:
Inmediato (0-30 días): [acciones]
Corto plazo (1-3 meses): [acciones]
Mediano plazo (3-6 meses): [acciones]
Largo plazo (6-12 meses): [acciones]

Escribí con el vocabulario del mercado financiero argentino. Sin markdown, sin asteriscos, texto plano.`

// ── Builder de prompt ──────────────────────────────────────────────
const yn = v => v ? 'Sí' : 'No'

function buildPrompt(empresa, { d1, d2, d3, d4, d5 }) {
  const lineas = d2.lineas_negocio.filter(l => l.nombre)
    .map(l => `${l.nombre}${l.pct ? ` (${l.pct}%)` : ''}`).join(', ') || '—'

  return `EMPRESA: ${empresa?.nombre || 'PyME'} | Rubro: ${empresa?.rubro || d1.industria}

BLOQUE 1 — IDENTIDAD:
Industria: ${d1.industria} | Alcance: ${d1.alcance} | Competencia por: ${d1.competencia_por}
Antigüedad: ${d1.antiguedad} años | Etapa empresaria: ${d1.etapa}
Forma jurídica: ${d1.forma_juridica} | Socios: ${d1.cantidad_socios} | Gestión: ${yn(d1.socios_gestion)}
ePyME: ${yn(d1.es_epyme)} | Inscripta Registro PyME: ${yn(d1.inscripta_registro_pyme)}
CUIT: ${d1.cuit || '—'} | Condición AFIP: ${d1.condicion_afip || '—'} | Provincia: ${d1.provincia_fiscal || '—'}
Propuesta de valor: ${d1.propuesta_valor}
Empresas vinculadas: ${yn(d1.empresas_vinculadas)}

BLOQUE 2 — MODELO DE NEGOCIO:
Líneas de negocio: ${lineas}
Tipo de ingresos: ${d2.tipo_ingresos} | Estacionalidad: ${d2.estacionalidad}
Meses buenos: ${d2.meses_buenos.join(', ') || '—'} | Meses malos: ${d2.meses_malos.join(', ') || '—'}
Financiamiento meses malos: ${d2.financiamiento_meses_malos || '—'}
Concentración top 3 clientes: ${d2.concentracion_top3 || '—'}% | Contratos firmados: ${yn(d2.contratos_firmados)}
Clientes públicos: ${yn(d2.clientes_publicos)}${d2.clientes_publicos ? ` (${d2.pct_clientes_publicos}%)` : ''}
Canales de venta: ${d2.canales_venta?.join(', ') || '—'}
Exporta: ${yn(d2.exporta)} | Importa: ${yn(d2.importa)} | Moneda: ${d2.moneda || 'Pesos'}
Certificaciones: ${d2.tiene_certificaciones ? (d2.certificaciones?.join(', ') || 'Sí, sin especificar') : 'No'}

BLOQUE 3 — COSTOS Y OPERACIONES:
Principal costo: ${d3.principal_costo} | Fijos: ${d3.pct_fijos}% | Variables: ${100 - Number(d3.pct_fijos)}%
Costos dolarizados: ${yn(d3.costos_dolarizados)} | Días pago proveedores: ${d3.dias_pago_proveedores || '—'}
Descuentos pronto pago: ${yn(d3.descuentos_pronto_pago)} | Forma de pago: ${d3.forma_pago?.join(', ') || '—'}
Stock: ${yn(d3.tiene_stock)}${d3.tiene_stock ? ` (rotación ${d3.dias_rotacion} días)` : ''}
Produce/revende: ${d3.produce_revende || '—'}
Empleados formales: ${d3.empleados_formales || '—'} | Informales: ${d3.empleados_informales || '—'}

BLOQUE 4 — SITUACIÓN FINANCIERA:
Bancos con los que opera: ${d4.bancos || '—'}
Líneas de crédito activas: ${yn(d4.lineas_credito)}${d4.lineas_credito ? ` (${d4.tasa_credito}% TNA)` : ''}
Rechazos de crédito: ${yn(d4.rechazos_credito)} | Descubierto: ${yn(d4.usa_descubierto)}
Cheques rechazados: ${yn(d4.cheques_rechazados)} | Deuda AFIP: ${yn(d4.deuda_afip)}
Deuda financiera: ${yn(d4.deuda_financiera)}${d4.deuda_financiera ? ` ($${d4.monto_deuda} al ${d4.tasa_deuda}% TNA)` : ''}
Manejo de excedentes: ${d4.manejo_excedente?.join(', ') || '—'} | Días cobertura caja: ${d4.dias_cobertura_caja || '—'}
AVAL SGR: ${yn(d4.tiene_aval_sgr)}${d4.tiene_aval_sgr ? ` — SGR: ${d4.sgr_nombre}, cupo: $${d4.sgr_cupo_disponible}` : ''}
Cuenta comitente: ${yn(d4.tiene_cuenta_comitente)}${d4.tiene_cuenta_comitente ? ` — ALYC: ${d4.alyc_nombre}` : ''}
Activos garantía: inmuebles ${yn(d4.inmuebles_propios)}${d4.inmuebles_propios ? ` ($${d4.valor_inmuebles})` : ''}, maquinaria ${yn(d4.maquinaria_relevante)}${d4.maquinaria_relevante ? ` ($${d4.valor_maquinaria})` : ''}

BLOQUE 5 — VISIÓN Y OBJETIVOS:
Problema financiero principal: ${d5.problema_financiero || '—'}
Decisión pendiente: ${d5.decision_pendiente || '—'}
Perdió oportunidad: ${yn(d5.perdio_oportunidad)}${d5.perdio_oportunidad ? ` — ${d5.descripcion_oportunidad}` : ''}
Objetivo 12 meses: ${d5.objetivo_12meses || '—'}
Inversión planeada: ${yn(d5.inversion_planeada)}${d5.inversion_planeada ? ` — ${d5.descripcion_inversion} ($${d5.monto_inversion})` : ''}
Objetivo largo plazo: ${d5.objetivo_largo_plazo || '—'}
Planea vender empresa: ${yn(d5.planea_vender_empresa)} | Planea sumar socios: ${yn(d5.planea_sumar_socios)}
Expectativa de CFOConnect: ${d5.expectativa_cfoconnect || '—'}
Conoce mercado capitales: ${yn(d5.conoce_mercado)} | Operó en bolsa: ${yn(d5.opero_bolsa)}
Cuenta comitente propia: ${yn(d5.cuenta_comitente)} | Conoce ON/ECHEQ: ${yn(d5.conoce_on_echeq)}
Miedos/dudas sobre bolsa: ${d5.miedos_bolsa || '—'}`
}

// ── Componentes UI ─────────────────────────────────────────────────
function SiNo({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map(({ v, l }) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)}
          className={`px-5 py-1.5 rounded-lg text-sm font-medium border transition-colors
            ${value === v
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
          {l}
        </button>
      ))}
    </div>
  )
}

function Campo({ label, hint, children, optional, desdeBalance }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-navy-800 mb-1.5">
        {label}
        {optional && <span className="text-slate-400 font-normal text-xs ml-1">(opcional)</span>}
        {desdeBalance && (
          <span className="ml-1.5 bg-nexxo-off text-nexxo-topo border border-nexxo-topo text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5">
            Desde balance
          </span>
        )}
      </label>
      {hint && <p className="text-xs text-slate-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

function Radios({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ v, l }) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors
            ${value === v
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
          {l}
        </button>
      ))}
    </div>
  )
}

function MultiToggle({ options, value = [], onChange }) {
  const toggle = item => onChange(value.includes(item)
    ? value.filter(x => x !== item)
    : [...value, item])
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors
            ${value.includes(opt)
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
          {opt}
        </button>
      ))}
    </div>
  )
}

function Col2({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">{children}</div>
}

function InfoBox({ children }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 mb-4">
      <AlertTriangle size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-blue-700 leading-relaxed">{children}</p>
    </div>
  )
}

function CriticoBox({ children }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-4">
      <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 leading-relaxed font-medium">{children}</p>
    </div>
  )
}

// ── Barra de progreso ──────────────────────────────────────────────
function ProgressBar({ current }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {DIMS.map((d, i) => {
        const done   = d.n < current
        const active = d.n === current
        return (
          <div key={d.n} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all
                ${done   ? 'bg-brand-600 text-white' :
                  active ? 'bg-brand-600 text-white ring-4 ring-brand-100' :
                           'bg-white border-2 border-slate-200 text-slate-400'}`}>
                {done ? <CheckCircle size={14} /> : d.n}
              </div>
              <span className={`text-xs mt-1 font-medium
                ${active ? 'text-brand-700' : done ? 'text-brand-500' : 'text-slate-400'}`}>
                {d.label}
              </span>
            </div>
            {i < DIMS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mt-[-14px] transition-colors
                ${done ? 'bg-brand-500' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── DIMENSIÓN 1: Identidad ─────────────────────────────────────────
// ── Header de dimensión Nexxo ────────────────────────────────────────
function DimHeader({ n, titulo }) {
  return (
    <div className="mb-5">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="font-serif text-4xl font-light text-nexxo-topoXl italic leading-none">{n}</span>
        <h3 className="font-sans font-bold text-nexxo-black uppercase tracking-wide text-sm">{titulo}</h3>
      </div>
      <div className="border-b border-nexxo-light" />
    </div>
  )
}

function Dim1({ d, set, cb = [] }) {
  return (
    <div className="card p-6 space-y-1">
      <DimHeader n="01" titulo="Identidad de la empresa" />

      {/* ✅ ePyME — NUEVO, crítico para ruta al mercado */}
      <CriticoBox>
        Los datos de ePyME y Registro PyME son críticos para acceder al mercado de capitales.
        Determinan si la empresa puede descontar cheques y facturas en el MAV.
      </CriticoBox>

      <Col2>
        <Campo label="¿Es ePyME? (inscripta en AFIP como PyME)">
          <SiNo value={d.es_epyme} onChange={v => set('d1', 'es_epyme', v)} />
        </Campo>
        <Campo label="¿Inscripta en el Registro PyME?" hint="Separado de la categoría ePyME">
          <SiNo value={d.inscripta_registro_pyme} onChange={v => set('d1', 'inscripta_registro_pyme', v)} />
        </Campo>
      </Col2>

      <Col2>
        <Campo label="CUIT" optional desdeBalance={cb.includes('cuit')}>
          <input className="input" value={d.cuit} onChange={e => set('d1', 'cuit', e.target.value)}
            placeholder="30-00000000-0" />
        </Campo>
        <Campo label="Condición frente a AFIP" optional>
          <Radios value={d.condicion_afip} onChange={v => set('d1', 'condicion_afip', v)}
            options={[
              { v: 'responsable_inscripto', l: 'Resp. Inscripto' },
              { v: 'monotributo',           l: 'Monotributo'     },
              { v: 'exento',                l: 'Exento'          },
            ]} />
        </Campo>
      </Col2>

      <Col2>
        <Campo label="Industria / sector" desdeBalance={cb.includes('industria')}>
          <input className="input" value={d.industria} onChange={e => set('d1', 'industria', e.target.value)}
            placeholder="Ej: Agroindustria, Manufactura, Servicios..." />
        </Campo>
        <Campo label="Antigüedad en el mercado (años)" desdeBalance={cb.includes('antiguedad')}>
          <input className="input" type="number" min="0" value={d.antiguedad}
            onChange={e => set('d1', 'antiguedad', e.target.value)} placeholder="Ej: 12" />
        </Campo>
      </Col2>

      <Col2>
        <Campo label="Forma jurídica">
          <Radios value={d.forma_juridica} onChange={v => set('d1', 'forma_juridica', v)}
            options={[
              { v: 'SA',          l: 'SA'          },
              { v: 'SRL',         l: 'SRL'         },
              { v: 'SAS',         l: 'SAS'         },
              { v: 'unipersonal', l: 'Unipersonal' },
            ]} />
        </Campo>
        <Campo label="Etapa de la empresa">
          <Radios value={d.etapa} onChange={v => set('d1', 'etapa', v)}
            options={[
              { v: 'startup',      l: 'Startup'       },
              { v: 'crecimiento',  l: 'Crecimiento'   },
              { v: 'consolidada',  l: 'Consolidada'   },
              { v: 'madura',       l: 'Madura'        },
            ]} />
        </Campo>
      </Col2>

      <Col2>
        <Campo label="Cantidad de socios / accionistas">
          <input className="input" type="number" min="1" value={d.cantidad_socios}
            onChange={e => set('d1', 'cantidad_socios', e.target.value)} placeholder="Ej: 2" />
        </Campo>
        <Campo label="¿Los socios participan en la gestión diaria?">
          <SiNo value={d.socios_gestion} onChange={v => set('d1', 'socios_gestion', v)} />
        </Campo>
      </Col2>

      <Campo label="¿Tiene empresas vinculadas o relacionadas?">
        <SiNo value={d.empresas_vinculadas} onChange={v => set('d1', 'empresas_vinculadas', v)} />
      </Campo>

      <Campo label="¿Cómo compite? ¿Cuál es su diferencial?">
        <Radios value={d.competencia_por} onChange={v => set('d1', 'competencia_por', v)}
          options={[
            { v: 'precio',    l: 'Precio'    },
            { v: 'calidad',   l: 'Calidad'   },
            { v: 'servicio',  l: 'Servicio'  },
            { v: 'velocidad', l: 'Velocidad' },
            { v: 'marca',     l: 'Marca'     },
          ]} />
      </Campo>

      <Campo label="Alcance geográfico">
        <Radios value={d.alcance} onChange={v => set('d1', 'alcance', v)}
          options={[
            { v: 'local',      l: 'Local'      },
            { v: 'regional',   l: 'Regional'   },
            { v: 'nacional',   l: 'Nacional'   },
            { v: 'exportador', l: 'Exportador' },
          ]} />
      </Campo>

      <Campo label="Propuesta de valor — ¿qué hace única a esta empresa?" optional>
        <textarea className="input resize-none" rows={3} value={d.propuesta_valor}
          onChange={e => set('d1', 'propuesta_valor', e.target.value)}
          placeholder="Ej: Somos los únicos proveedores de X en la región NOA con stock permanente y entrega en 24hs..." />
      </Campo>
    </div>
  )
}

// ── DIMENSIÓN 2: Negocio e Ingresos ───────────────────────────────
function Dim2({ d, set }) {
  function setLinea(i, campo, val) {
    const arr = [...d.lineas_negocio]
    arr[i] = { ...arr[i], [campo]: val }
    set('d2', 'lineas_negocio', arr)
  }
  function addLinea() {
    set('d2', 'lineas_negocio', [...d.lineas_negocio, { nombre: '', pct: '' }])
  }
  function removeLinea(i) {
    set('d2', 'lineas_negocio', d.lineas_negocio.filter((_, j) => j !== i))
  }
  function toggleMes(field, mes) {
    const arr = d[field] || []
    set('d2', field, arr.includes(mes) ? arr.filter(m => m !== mes) : [...arr, mes])
  }

  return (
    <div className="card p-6 space-y-1">
      <DimHeader n="02" titulo="Modelo de negocio e ingresos" />
      <p className="text-sm text-slate-500 mb-5">Cómo genera dinero la empresa, sus clientes y sus canales.</p>

      {/* Líneas de negocio */}
      <Campo label="Líneas de negocio principales" hint="Indicá el nombre y el % aproximado de las ventas que representa">
        <div className="space-y-2">
          {d.lineas_negocio.map((l, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input className="input flex-1" value={l.nombre}
                onChange={e => setLinea(i, 'nombre', e.target.value)}
                placeholder={`Línea ${i + 1} (ej: Venta mayorista)`} />
              <div className="relative w-24">
                <input className="input pr-6" type="number" min="0" max="100"
                  value={l.pct} onChange={e => setLinea(i, 'pct', e.target.value)}
                  placeholder="%" />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
              </div>
              {d.lineas_negocio.length > 1 && (
                <button type="button" onClick={() => removeLinea(i)}
                  className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addLinea}
            className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium mt-1">
            <Plus size={13} /> Agregar línea
          </button>
        </div>
      </Campo>

      <Campo label="Tipo de ingresos">
        <Radios value={d.tipo_ingresos} onChange={v => set('d2', 'tipo_ingresos', v)}
          options={[
            { v: 'producto',    l: 'Venta de productos'   },
            { v: 'servicio',    l: 'Servicios'            },
            { v: 'recurrente',  l: 'Contratos recurrentes'},
            { v: 'proyecto',    l: 'Por proyecto/obra'    },
            { v: 'mixto',       l: 'Mixto'                },
          ]} />
      </Campo>

      {/* Canales de venta — NUEVO */}
      <Campo label="Canales de venta">
        <MultiToggle
          value={d.canales_venta}
          onChange={v => set('d2', 'canales_venta', v)}
          options={['Venta directa', 'Distribuidores', 'E-commerce', 'Licitaciones', 'Exportación', 'Franquicias']}
        />
      </Campo>

      <Campo label="Estacionalidad del negocio">
        <Radios value={d.estacionalidad} onChange={v => set('d2', 'estacionalidad', v)}
          options={[
            { v: 'ninguna',  l: 'Parejo todo el año'         },
            { v: 'moderada', l: 'Variaciones moderadas'      },
            { v: 'fuerte',   l: 'Alta estacionalidad'        },
          ]} />
      </Campo>

      {d.estacionalidad && d.estacionalidad !== 'ninguna' && (
        <>
          <Campo label="Meses buenos">
            <div className="flex flex-wrap gap-1.5">
              {MESES.map(m => (
                <button key={m} type="button" onClick={() => toggleMes('meses_buenos', m)}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition-colors
                    ${(d.meses_buenos || []).includes(m)
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
                  {m}
                </button>
              ))}
            </div>
          </Campo>
          <Campo label="Meses malos">
            <div className="flex flex-wrap gap-1.5">
              {MESES.map(m => (
                <button key={m} type="button" onClick={() => toggleMes('meses_malos', m)}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition-colors
                    ${(d.meses_malos || []).includes(m)
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'}`}>
                  {m}
                </button>
              ))}
            </div>
          </Campo>
          <Campo label="¿Cómo financia los meses malos?" optional>
            <input className="input" value={d.financiamiento_meses_malos}
              onChange={e => set('d2', 'financiamiento_meses_malos', e.target.value)}
              placeholder="Ej: Con stock del verano, con línea bancaria, con ahorros..." />
          </Campo>
        </>
      )}

      <Col2>
        <Campo label="¿Qué % de las ventas representan los 3 principales clientes?" hint="Concentración de cartera">
          <div className="relative">
            <input className="input pr-7" type="number" min="0" max="100"
              value={d.concentracion_top3}
              onChange={e => set('d2', 'concentracion_top3', e.target.value)}
              placeholder="Ej: 45" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
          </div>
        </Campo>
        <Campo label="¿Tiene contratos firmados con clientes?">
          <SiNo value={d.contratos_firmados} onChange={v => set('d2', 'contratos_firmados', v)} />
        </Campo>
      </Col2>

      <Col2>
        <Campo label="¿Tiene clientes del sector público?">
          <SiNo value={d.clientes_publicos} onChange={v => set('d2', 'clientes_publicos', v)} />
          {d.clientes_publicos && (
            <div className="mt-2 relative">
              <input className="input pr-7" type="number" min="0" max="100"
                value={d.pct_clientes_publicos}
                onChange={e => set('d2', 'pct_clientes_publicos', e.target.value)}
                placeholder="% de ventas al Estado" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
            </div>
          )}
        </Campo>
        <Campo label="Moneda de facturación principal">
          <Radios value={d.moneda} onChange={v => set('d2', 'moneda', v)}
            options={[
              { v: 'pesos',      l: 'Pesos'       },
              { v: 'dolares',    l: 'Dólares'     },
              { v: 'mixto',      l: 'Mixto'       },
            ]} />
        </Campo>
      </Col2>

      <Col2>
        <Campo label="¿Exporta?">
          <SiNo value={d.exporta} onChange={v => set('d2', 'exporta', v)} />
        </Campo>
        <Campo label="¿Importa insumos o productos?">
          <SiNo value={d.importa} onChange={v => set('d2', 'importa', v)} />
        </Campo>
      </Col2>

      {/* Certificaciones — NUEVO */}
      <Campo label="¿Tiene certificaciones?">
        <SiNo value={d.tiene_certificaciones} onChange={v => set('d2', 'tiene_certificaciones', v)} />
        {d.tiene_certificaciones && (
          <div className="mt-2">
            <MultiToggle
              value={d.certificaciones}
              onChange={v => set('d2', 'certificaciones', v)}
              options={['ISO 9001', 'ISO 14001', 'SENASA', 'IRAM', 'BPA', 'HACCP', 'Otra']}
            />
          </div>
        )}
      </Campo>
    </div>
  )
}

// ── DIMENSIÓN 3: Costos y Operaciones ─────────────────────────────
function Dim3({ d, set }) {
  return (
    <div className="card p-6 space-y-1">
      <DimHeader n="03" titulo="Costos y operaciones" />
      <p className="text-sm text-slate-500 mb-5">Estructura de costos, proveedores y capacidad operativa.</p>

      <Campo label="¿Cuál es el principal costo de la empresa?">
        <Radios value={d.principal_costo} onChange={v => set('d3', 'principal_costo', v)}
          options={[
            { v: 'materias_primas', l: 'Materias primas' },
            { v: 'personal',        l: 'Personal'        },
            { v: 'alquiler',        l: 'Alquiler'        },
            { v: 'logistica',       l: 'Logística'       },
            { v: 'servicios',       l: 'Servicios'       },
            { v: 'financiero',      l: 'Costo financiero'},
          ]} />
      </Campo>

      <Campo label="¿Qué % son costos fijos (no cambian con las ventas)?" hint="El resto se toma como variable">
        <div className="relative w-40">
          <input className="input pr-7" type="number" min="0" max="100"
            value={d.pct_fijos} onChange={e => set('d3', 'pct_fijos', e.target.value)} placeholder="Ej: 40" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
        </div>
      </Campo>

      <Col2>
        <Campo label="¿Tiene costos dolarizados?">
          <SiNo value={d.costos_dolarizados} onChange={v => set('d3', 'costos_dolarizados', v)} />
        </Campo>
        <Campo label="¿Paga en menos de 30 días y obtiene descuentos?">
          <SiNo value={d.descuentos_pronto_pago} onChange={v => set('d3', 'descuentos_pronto_pago', v)} />
        </Campo>
      </Col2>

      <Campo label="Días promedio para pagar a proveedores" optional>
        <div className="relative w-40">
          <input className="input pr-12" type="number" min="0"
            value={d.dias_pago_proveedores}
            onChange={e => set('d3', 'dias_pago_proveedores', e.target.value)} placeholder="Ej: 30" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">días</span>
        </div>
      </Campo>

      <Campo label="Formas de pago a proveedores">
        <MultiToggle value={d.forma_pago} onChange={v => set('d3', 'forma_pago', v)}
          options={['Contado', 'Cheque', 'ECHEQ', 'Transferencia', 'Cuenta corriente', 'Tarjeta']} />
      </Campo>

      <Col2>
        <Campo label="¿Maneja stock?">
          <SiNo value={d.tiene_stock} onChange={v => set('d3', 'tiene_stock', v)} />
          {d.tiene_stock && (
            <div className="mt-2 relative w-full">
              <input className="input pr-12" type="number" min="0"
                value={d.dias_rotacion}
                onChange={e => set('d3', 'dias_rotacion', e.target.value)} placeholder="Días de rotación" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">días</span>
            </div>
          )}
        </Campo>
        <Campo label="¿Produce o revende?">
          <Radios value={d.produce_revende} onChange={v => set('d3', 'produce_revende', v)}
            options={[
              { v: 'produce',  l: 'Produce'  },
              { v: 'revende',  l: 'Revende'  },
              { v: 'ambos',    l: 'Ambos'    },
              { v: 'servicio', l: 'Servicio' },
            ]} />
        </Campo>
      </Col2>

      {/* Empleados — NUEVO */}
      <InfoBox>
        La cantidad de empleados es un indicador que usan las SGRs para dimensionar la empresa real.
        No afecta negativamente — es solo para contextualizar el análisis.
      </InfoBox>
      <Col2>
        <Campo label="Empleados en relación de dependencia">
          <input className="input" type="number" min="0" value={d.empleados_formales}
            onChange={e => set('d3', 'empleados_formales', e.target.value)} placeholder="Ej: 15" />
        </Campo>
        <Campo label="Colaboradores informales / eventuales" optional>
          <input className="input" type="number" min="0" value={d.empleados_informales}
            onChange={e => set('d3', 'empleados_informales', e.target.value)} placeholder="Ej: 5" />
        </Campo>
      </Col2>
    </div>
  )
}

// ── DIMENSIÓN 4: Situación Financiera ─────────────────────────────
function Dim4({ d, set }) {
  return (
    <div className="card p-6 space-y-1">
      <DimHeader n="04" titulo="Situación financiera actual" />
      <p className="text-sm text-slate-500 mb-5">Estado actual del financiamiento, deudas y posición en el mercado de capitales.</p>

      {/* SGR y Cuenta Comitente — CRÍTICOS */}
      <CriticoBox>
        Los campos de SGR y cuenta comitente determinan en qué nodo del árbol de decisiones está la empresa
        y qué productos puede acceder hoy. Son los más importantes de esta sección.
      </CriticoBox>

      <Col2>
        <Campo label="¿Tiene aval de una SGR activo?">
          <SiNo value={d.tiene_aval_sgr} onChange={v => set('d4', 'tiene_aval_sgr', v)} />
          {d.tiene_aval_sgr && (
            <div className="mt-2 space-y-2">
              <input className="input" value={d.sgr_nombre}
                onChange={e => set('d4', 'sgr_nombre', e.target.value)}
                placeholder="Nombre de la SGR (ej: Garantizar, FOGABA...)" />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input className="input pl-7" type="number" value={d.sgr_cupo_disponible}
                  onChange={e => set('d4', 'sgr_cupo_disponible', e.target.value)}
                  placeholder="Cupo disponible" />
              </div>
            </div>
          )}
        </Campo>
        <Campo label="¿Tiene cuenta comitente en una ALYC?">
          <SiNo value={d.tiene_cuenta_comitente} onChange={v => set('d4', 'tiene_cuenta_comitente', v)} />
          {d.tiene_cuenta_comitente && (
            <div className="mt-2">
              <input className="input" value={d.alyc_nombre}
                onChange={e => set('d4', 'alyc_nombre', e.target.value)}
                placeholder="ALYC (ej: Beat Valores, IOL, etc.)" />
            </div>
          )}
        </Campo>
      </Col2>

      <Campo label="Bancos con los que opera actualmente" optional>
        <input className="input" value={d.bancos} onChange={e => set('d4', 'bancos', e.target.value)}
          placeholder="Ej: Banco Nación, Banco Galicia, BBVA..." />
      </Campo>

      <Col2>
        <Campo label="¿Tiene líneas de crédito bancarias activas?">
          <SiNo value={d.lineas_credito} onChange={v => set('d4', 'lineas_credito', v)} />
          {d.lineas_credito && (
            <div className="mt-2 relative">
              <input className="input pr-16" type="number" value={d.tasa_credito}
                onChange={e => set('d4', 'tasa_credito', e.target.value)} placeholder="Tasa" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">% TNA</span>
            </div>
          )}
        </Campo>
        <Campo label="¿Tuvo rechazos de crédito en los últimos 2 años?">
          <SiNo value={d.rechazos_credito} onChange={v => set('d4', 'rechazos_credito', v)} />
        </Campo>
      </Col2>

      <Col2>
        <Campo label="¿Usa descubierto bancario habitualmente?">
          <SiNo value={d.usa_descubierto} onChange={v => set('d4', 'usa_descubierto', v)} />
        </Campo>
        <Campo label="¿Tuvo cheques rechazados en los últimos 12 meses?">
          <SiNo value={d.cheques_rechazados} onChange={v => set('d4', 'cheques_rechazados', v)} />
        </Campo>
      </Col2>

      <Col2>
        <Campo label="¿Tiene deuda con AFIP?">
          <SiNo value={d.deuda_afip} onChange={v => set('d4', 'deuda_afip', v)} />
        </Campo>
        <Campo label="¿Tiene deuda financiera significativa?">
          <SiNo value={d.deuda_financiera} onChange={v => set('d4', 'deuda_financiera', v)} />
          {d.deuda_financiera && (
            <div className="mt-2 space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input className="input pl-7" type="number" value={d.monto_deuda}
                  onChange={e => set('d4', 'monto_deuda', e.target.value)} placeholder="Monto" />
              </div>
              <div className="relative">
                <input className="input pr-16" type="number" value={d.tasa_deuda}
                  onChange={e => set('d4', 'tasa_deuda', e.target.value)} placeholder="Tasa" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">% TNA</span>
              </div>
            </div>
          )}
        </Campo>
      </Col2>

      <Campo label="¿Cómo maneja los excedentes de caja?">
        <MultiToggle value={d.manejo_excedente} onChange={v => set('d4', 'manejo_excedente', v)}
          options={['Plazo fijo', 'FCI', 'Dólar', 'Reinversión', 'Cauciones', 'No genera excedentes']} />
      </Campo>

      <Campo label="¿Cuántos días de gastos cubre la caja actual?" optional>
        <div className="relative w-40">
          <input className="input pr-12" type="number" min="0"
            value={d.dias_cobertura_caja}
            onChange={e => set('d4', 'dias_cobertura_caja', e.target.value)} placeholder="Ej: 15" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">días</span>
        </div>
      </Campo>

      {/* Activos como garantía — NUEVO para scoring */}
      <InfoBox>
        Los activos como garantía representan el 10% del scoring SGR.
        Inmuebles propios son la garantía más valorada por el mercado.
      </InfoBox>
      <Col2>
        <Campo label="¿Tiene inmuebles propios? (local, galpón, campo)">
          <SiNo value={d.inmuebles_propios} onChange={v => set('d4', 'inmuebles_propios', v)} />
          {d.inmuebles_propios && (
            <div className="mt-2 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input className="input pl-7" type="number" value={d.valor_inmuebles}
                onChange={e => set('d4', 'valor_inmuebles', e.target.value)}
                placeholder="Valor estimado" />
            </div>
          )}
        </Campo>
        <Campo label="¿Tiene maquinaria o equipos de valor significativo?">
          <SiNo value={d.maquinaria_relevante} onChange={v => set('d4', 'maquinaria_relevante', v)} />
          {d.maquinaria_relevante && (
            <div className="mt-2 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input className="input pl-7" type="number" value={d.valor_maquinaria}
                onChange={e => set('d4', 'valor_maquinaria', e.target.value)}
                placeholder="Valor estimado" />
            </div>
          )}
        </Campo>
      </Col2>
    </div>
  )
}

// ── DIMENSIÓN 5: Visión y Objetivos ───────────────────────────────
function Dim5({ d, set }) {
  return (
    <div className="card p-6 space-y-1">
      <DimHeader n="05" titulo="Visión, dolores y objetivos" />
      <p className="text-sm text-slate-500 mb-5">Lo más importante: hacia dónde va la empresa y qué necesita para llegar.</p>

      <Campo label="¿Cuál es el mayor problema financiero que enfrenta hoy?">
        <textarea className="input resize-none" rows={3} value={d.problema_financiero}
          onChange={e => set('d5', 'problema_financiero', e.target.value)}
          placeholder="Ej: No llegamos a pagar los sueldos en los meses flojos, necesitamos financiar el stock de temporada..." />
      </Campo>

      <Campo label="¿Hay alguna decisión financiera importante que no pudo tomar todavía?" optional>
        <textarea className="input resize-none" rows={2} value={d.decision_pendiente}
          onChange={e => set('d5', 'decision_pendiente', e.target.value)}
          placeholder="Ej: Comprar la maquinaria que necesitamos pero no tenemos el crédito..." />
      </Campo>

      <Campo label="¿Perdió alguna oportunidad de negocio por falta de financiamiento?">
        <SiNo value={d.perdio_oportunidad} onChange={v => set('d5', 'perdio_oportunidad', v)} />
        {d.perdio_oportunidad && (
          <textarea className="input resize-none mt-2" rows={2} value={d.descripcion_oportunidad}
            onChange={e => set('d5', 'descripcion_oportunidad', e.target.value)}
            placeholder="¿Cuál fue la oportunidad? ¿Cuánto dejó de facturar?" />
        )}
      </Campo>

      <Campo label="¿Cuál es el objetivo principal para los próximos 12 meses?">
        <textarea className="input resize-none" rows={2} value={d.objetivo_12meses}
          onChange={e => set('d5', 'objetivo_12meses', e.target.value)}
          placeholder="Ej: Abrir un segundo local, contratar 5 personas más, llegar a $X de facturación..." />
      </Campo>

      <Campo label="¿Tiene alguna inversión planeada?">
        <SiNo value={d.inversion_planeada} onChange={v => set('d5', 'inversion_planeada', v)} />
        {d.inversion_planeada && (
          <div className="mt-2 space-y-2">
            <input className="input" value={d.descripcion_inversion}
              onChange={e => set('d5', 'descripcion_inversion', e.target.value)}
              placeholder="¿En qué? (ej: maquinaria, local, tecnología...)" />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input className="input pl-7" type="number" value={d.monto_inversion}
                onChange={e => set('d5', 'monto_inversion', e.target.value)} placeholder="Monto estimado" />
            </div>
          </div>
        )}
      </Campo>

      <Campo label="¿Cuál es el objetivo a largo plazo? (3-5 años)" optional>
        <textarea className="input resize-none" rows={2} value={d.objetivo_largo_plazo}
          onChange={e => set('d5', 'objetivo_largo_plazo', e.target.value)}
          placeholder="Ej: Ser el proveedor líder de la región, exportar el 30% de la producción..." />
      </Campo>

      {/* Intención societaria — NUEVO */}
      <Col2>
        <Campo label="¿Está pensando en vender la empresa o parte de ella?">
          <SiNo value={d.planea_vender_empresa} onChange={v => set('d5', 'planea_vender_empresa', v)} />
        </Campo>
        <Campo label="¿Está pensando en incorporar nuevos socios o inversores?">
          <SiNo value={d.planea_sumar_socios} onChange={v => set('d5', 'planea_sumar_socios', v)} />
        </Campo>
      </Col2>

      {/* Mercado de capitales */}
      <div className="pt-2 border-t border-slate-100">
        <p className="text-sm font-semibold text-navy-700 mb-3">Relación con el mercado de capitales</p>
        <Col2>
          <Campo label="¿Conoce los productos del mercado de capitales para PyMEs?">
            <SiNo value={d.conoce_mercado} onChange={v => set('d5', 'conoce_mercado', v)} />
          </Campo>
          <Campo label="¿Alguna vez operó en la bolsa o el MAV?">
            <SiNo value={d.opero_bolsa} onChange={v => set('d5', 'opero_bolsa', v)} />
          </Campo>
        </Col2>
        <Col2>
          <Campo label="¿Tiene cuenta comitente propia?">
            <SiNo value={d.cuenta_comitente} onChange={v => set('d5', 'cuenta_comitente', v)} />
          </Campo>
          <Campo label="¿Conoce las ON PyME y los ECHEQs?">
            <SiNo value={d.conoce_on_echeq} onChange={v => set('d5', 'conoce_on_echeq', v)} />
          </Campo>
        </Col2>
        <Campo label="¿Qué dudas o miedos tiene sobre operar en el mercado de capitales?" optional>
          <textarea className="input resize-none" rows={2} value={d.miedos_bolsa}
            onChange={e => set('d5', 'miedos_bolsa', e.target.value)}
            placeholder="Ej: No sé si califico, tengo miedo de los costos, no entiendo cómo funciona..." />
        </Campo>
      </div>

      {/* Expectativa de CFOConnect — NUEVO, pregunta de cierre */}
      <div className="pt-2 border-t border-slate-100">
        <Campo label="¿Qué esperás del servicio CFOConnect?">
          <MultiToggle
            value={Array.isArray(d.expectativa_cfoconnect) ? d.expectativa_cfoconnect : []}
            onChange={v => set('d5', 'expectativa_cfoconnect', v)}
            options={[
              'Ordenar mis finanzas',
              'Acceder a financiamiento',
              'Bajar el costo financiero',
              'Entender mis números',
              'Operar en mercado de capitales',
              'Acompañamiento estratégico',
            ]}
          />
        </Campo>
      </div>
    </div>
  )
}

// ── Display del análisis IA ────────────────────────────────────────
function AnalisisDisplay({ texto, empresa }) {
  const secciones = [
    'PERFIL DE LA EMPRESA',
    'SEMAFORO FINANCIERO',
    'FORTALEZAS',
    'RIESGOS Y DEBILIDADES',
    'OPORTUNIDADES DE MEJORA',
    'PRODUCTOS BEAT VALORES RECOMENDADOS',
    'RUTA AL MERCADO DE CAPITALES',
    'HOJA DE RUTA',
  ]

  const parsed = []
  let remaining = texto
  for (let i = 0; i < secciones.length; i++) {
    const titulo = secciones[i]
    const siguiente = secciones[i + 1]
    const idx = remaining.indexOf(titulo + ':')
    if (idx === -1) continue
    const start = idx + titulo.length + 1
    const end = siguiente ? remaining.indexOf(siguiente + ':') : remaining.length
    const contenido = remaining.slice(start, end !== -1 ? end : undefined).trim()
    parsed.push({ titulo, contenido })
  }

  const COLOR_MAP = {
    'PERFIL DE LA EMPRESA':             'border-navy-200 bg-navy-50',
    'SEMAFORO FINANCIERO':              'border-amber-200 bg-amber-50',
    'FORTALEZAS':                       'border-green-200 bg-green-50',
    'RIESGOS Y DEBILIDADES':            'border-red-200 bg-red-50',
    'OPORTUNIDADES DE MEJORA':          'border-blue-200 bg-blue-50',
    'PRODUCTOS BEAT VALORES RECOMENDADOS': 'border-brand-200 bg-brand-50',
    'RUTA AL MERCADO DE CAPITALES':     'border-purple-200 bg-purple-50',
    'HOJA DE RUTA':                     'border-slate-200 bg-slate-50',
  }

  return (
    <div className="space-y-4 mt-5">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <Sparkles size={16} className="text-brand-500" />
        <h3 className="text-sm font-semibold text-navy-800">
          Análisis generado — {empresa?.nombre}
        </h3>
      </div>
      {parsed.length === 0 ? (
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{texto}</p>
        </div>
      ) : (
        parsed.map(({ titulo, contenido }) => (
          <div key={titulo} className={`p-4 rounded-xl border ${COLOR_MAP[titulo] || 'border-slate-200 bg-slate-50'}`}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{titulo}</p>
            <p className="text-sm text-navy-800 leading-relaxed whitespace-pre-wrap">{contenido}</p>
          </div>
        ))
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────
export default function DiagnosticoProfundoPage() {
  const { profile, empresaActiva } = useAuth()
  const navigate = useNavigate()

  // Única fuente de verdad para la empresa
  const empresaId = empresaActiva?.id

  const [dim,           setDim]           = useState(1)
  const [form,          setForm]          = useState(EMPTY_FORM)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [completado,    setCompletado]    = useState(false)
  const [analisis,      setAnalisis]      = useState('')
  const [generando,     setGenerando]     = useState(false)
  const [error,         setError]         = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [camposBalance, setCamposBalance] = useState({ d1: [], d3: [], d4: [] })

  // Único useEffect limpio — resetea y carga al cambiar empresa
  useEffect(() => {
    setForm(EMPTY_FORM)
    setCompletado(false)
    setAnalisis('')
    setSaved(false)
    setError(null)
    setDim(1)
    setCamposBalance({ d1: [], d3: [], d4: [] })

    if (!empresaId) {
      setLoading(false)
      return
    }

    setLoading(true)
    supabase.from('diagnostico_profundo')
      .select('*')
      .eq('empresa_id', empresaId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const d1raw = data.dimension1 || {}
        const d3raw = data.dimension3 || {}
        const d4raw = data.dimension4 || {}
        setCamposBalance({
          d1: d1raw._campos_desde_balance || [],
          d3: d3raw._campos_desde_balance || [],
          d4: d4raw._campos_desde_balance || [],
        })
        setForm({
          d1: { ...EMPTY_D1, ...d1raw },
          d2: { ...EMPTY_D2, ...(data.dimension2 || {}) },
          d3: { ...EMPTY_D3, ...d3raw },
          d4: { ...EMPTY_D4, ...d4raw },
          d5: { ...EMPTY_D5, ...(data.dimension5 || {}) },
        })
        setCompletado(data.estado === 'completo')
        setAnalisis(data.analisis_ia || '')
      })
      .finally(() => setLoading(false))
  }, [empresaId])

  function set(bloque, campo, valor) {
    setForm(prev => ({ ...prev, [bloque]: { ...prev[bloque], [campo]: valor } }))
    setSaved(false)
  }

  async function handleGuardar(esCompleto = false) {
    if (!empresaId) { setError('Seleccioná una empresa primero.'); return }
    setSaving(true); setError(null)
    const { error: err } = await supabase
      .from('diagnostico_profundo')
      .upsert({
        empresa_id: empresaId,
        estado: esCompleto ? 'completo' : 'borrador',
        dimension1: form.d1, dimension2: form.d2, dimension3: form.d3,
        dimension4: form.d4, dimension5: form.d5,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'empresa_id' })
    setSaving(false)
    if (err) { setError('No se pudo guardar. Intentá de nuevo.'); return }
    setSaved(true)
    if (esCompleto) {
      setCompletado(true)
      // ✅ Actualizar árbol de decisiones: si tiene aval SGR → avanzar etapa
      await actualizarEtapaEmpresa()
    }
  }

  // Árbol de decisiones — orden: 1=Tributario → 2=Cuenta ALYC → 3=ePyME → 4=Aval SGR → 5=ON PyME
  async function actualizarEtapaEmpresa() {
    if (!empresaId) return
    const d4 = form.d4
    const d1 = form.d1

    let etapa_numero = 1
    if (d4.tiene_cuenta_comitente) etapa_numero = 2
    if (d4.tiene_cuenta_comitente && d1.es_epyme) etapa_numero = 3
    if (d4.tiene_cuenta_comitente && d1.es_epyme && d4.tiene_aval_sgr) etapa_numero = 4

    await supabase.from('empresas').update({ etapa_numero }).eq('id', empresaId)
  }

  async function handleGenerar() {
    if (!empresaId) { setError('Seleccioná una empresa.'); return }
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) { setError('API Key no configurada en .env.local'); return }

    setGenerando(true); setError(null)
    const empresaObj = empresaActiva
    const userMsg = buildPrompt(empresaObj, form)

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: SYSTEM_DP,
          messages: [{ role: 'user', content: userMsg }],
        }),
      })

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        throw new Error(`HTTP ${resp.status}: ${txt.slice(0, 120)}`)
      }

      const data = await resp.json()
      const texto = data.content?.[0]?.text?.trim() || ''
      setAnalisis(texto)

      // Guardar análisis en la DB
      await supabase.from('diagnostico_profundo')
        .upsert({
          empresa_id: empresaId,
          analisis_ia: texto,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'empresa_id' })
    } catch (e) {
      setError(`Error al generar el análisis: ${e.message}`)
    } finally {
      setGenerando(false)
    }
  }

  const empresaObj = empresaActiva

  // Guard — sin empresa seleccionada
  if (!empresaActiva) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="card p-8 text-center max-w-sm">
        <Brain size={32} className="text-slate-200 mx-auto mb-3" />
        <p className="text-sm font-semibold text-navy-800 mb-1">Seleccioná una empresa</p>
        <p className="text-xs text-slate-400">
          Usá el selector del menú lateral para elegir con qué empresa trabajar
        </p>
      </div>
    </div>
  )

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-sm text-slate-400">Cargando...</div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="Cuestionario alma de la empresa"
        subtitle="Diagnóstico profundo — solo asesores"
        actions={
          saved && !saving ? (
            <span className="flex items-center gap-1 text-xs text-brand-600 font-medium">
              <CheckCircle size={12} /> Guardado
            </span>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto p-5 animate-slide-up">
        <div className="max-w-3xl mx-auto">

          {!empresaId ? (
            <div className="card p-8 text-center">
              <Building2 size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-navy-800 mb-1">Sin empresa seleccionada</p>
              <p className="text-xs text-slate-400">Seleccioná una empresa desde el menú lateral para empezar.</p>
            </div>
          ) : !completado ? (
            <>
              <ProgressBar current={dim} />

              {dim === 1 && <Dim1 d={form.d1} set={set} cb={camposBalance.d1} />}
              {dim === 2 && <Dim2 d={form.d2} set={set} />}
              {dim === 3 && <Dim3 d={form.d3} set={set} />}
              {dim === 4 && <Dim4 d={form.d4} set={set} />}
              {dim === 5 && <Dim5 d={form.d5} set={set} />}

              {error && (
                <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-between mt-6">
                <button
                  type="button"
                  onClick={() => setDim(d => Math.max(1, d - 1))}
                  disabled={dim === 1}
                  className="btn-secondary flex items-center gap-1.5 disabled:opacity-40"
                >
                  <ChevronLeft size={15} /> Anterior
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleGuardar(false)}
                    disabled={saving}
                    className="btn-secondary flex items-center gap-1.5 text-sm"
                  >
                    <Save size={13} />
                    {saving ? 'Guardando...' : 'Guardar borrador'}
                  </button>

                  {dim < 5 ? (
                    <button
                      type="button"
                      onClick={async () => { await handleGuardar(false); setDim(d => d + 1) }}
                      disabled={saving}
                      className="btn-primary flex items-center gap-1.5"
                    >
                      Siguiente <ChevronRight size={15} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleGuardar(true)}
                      disabled={saving}
                      className="btn-primary flex items-center gap-1.5"
                    >
                      <CheckCircle size={15} />
                      {saving ? 'Guardando...' : 'Completar cuestionario'}
                    </button>
                  )}
                </div>
              </div>

              <p className="text-center text-xs text-slate-400 mt-4">
                Dimensión {dim} de {DIMS.length}
              </p>
            </>
          ) : (
            /* Vista de resultados */
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                      <CheckCircle size={20} className="text-brand-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy-800">
                        Cuestionario completo — {empresaObj?.nombre}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Podés generar el análisis con IA o editar las respuestas
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setCompletado(false)}
                      className="btn-secondary text-xs py-1.5 px-3">
                      Editar
                    </button>
                    <button onClick={handleGenerar} disabled={generando}
                      className="btn-primary flex items-center gap-2 disabled:opacity-60">
                      {generando ? (
                        <>
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Generando...
                        </>
                      ) : (
                        <><Sparkles size={15} />{analisis ? 'Regenerar análisis' : 'Generar análisis IA'}</>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
              </div>

              {analisis && <AnalisisDisplay texto={analisis} empresa={empresaObj} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
