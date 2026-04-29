import { useEffect, useState, useMemo, useRef } from 'react'
import { jsPDF } from 'jspdf'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { calcRatios, ars, pct, ratio, days } from '@/lib/financials'
import PageHeader from '@/components/shared/PageHeader'
import {
  Save, Download, Plus, X,
  AlertTriangle, CheckCircle, Upload, Sparkles,
  TrendingUp, BarChart3, Shield, Wallet, Building2, Target, FileText,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

// ── Constantes ─────────────────────────────────────────────────────
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = `Sos un contador público argentino experto en análisis de estados contables de PyMEs.
Tu tarea es extraer TODOS los datos del balance adjunto y devolverlos ÚNICAMENTE en formato JSON válido, sin ningún texto adicional, sin markdown, sin explicaciones.

El JSON debe tener exactamente esta estructura:
{
  "datos_societarios": {
    "razon_social": "", "cuit": "", "domicilio_legal": "", "actividad_principal": "",
    "fecha_inicio_ejercicio": "", "fecha_cierre_ejercicio": "", "numero_ejercicio": "",
    "capital_social": 0, "forma_juridica": "", "nombre_contador": "", "matricula_contador": ""
  },
  "estados_financieros": {
    "actual": {
      "caja_bancos": 0, "inversiones_corrientes": 0, "creditos_ventas": 0, "otros_creditos_cte": 0,
      "bienes_cambio": 0, "bienes_uso": 0, "deudas_comerciales": 0, "deudas_financieras_cte": 0,
      "rem_cargas_sociales": 0, "cargas_fiscales_cte": 0, "deudas_lp": 0, "otras_deudas_nc": 0,
      "patrimonio_neto": 0, "ventas_netas": 0, "costo_ventas": 0, "gastos_comercializacion": 0,
      "gastos_administracion": 0, "resultado_financiero": 0, "otros_ingresos": 0,
      "impuesto_ganancias": 0, "resultado_ejercicio": 0,
      "efectivo_inicio": 0, "efectivo_cierre": 0,
      "flujo_operativo": 0, "flujo_inversion": 0, "flujo_financiamiento": 0
    },
    "anterior": {
      "ventas_netas": 0, "resultado_ejercicio": 0, "patrimonio_neto": 0,
      "activo_total": 0, "pasivo_total": 0, "activo_corriente": 0, "pasivo_corriente": 0,
      "resultado_financiero": 0
    }
  },
  "notas": {
    "bancos_y_caja": {
      "lista_bancos": [], "tiene_fci": false, "tiene_caja_dolares": false,
      "monto_caja_dolares_usd": 0, "tipo_cambio": 0
    },
    "prestamos": {
      "monto_total": 0, "tiene_descubierto": false, "detalle_bancos": [],
      "vencimientos": []
    },
    "deudas_fiscales": {
      "tiene_iva": false, "monto_iva": 0, "tiene_ganancias": false, "monto_ganancias": 0,
      "tiene_plan_afip": false, "tiene_iibb": false, "monto_iibb": 0
    },
    "bienes_de_uso": {
      "rubros": [], "valor_total_bruto": 0, "valor_total_neto": 0,
      "tiene_inmuebles": false, "tiene_maquinaria": false
    },
    "ventas": { "desglose": [], "moneda_principal": "pesos" }
  }
}

Instrucciones de búsqueda:
- Datos societarios: primera página (razón social, número de ejercicio, fechas), cuerpo del balance (CUIT, domicilio, actividad), firma del informe (contador y matrícula)
- Estados financieros: columnas "Ejercicio actual" y "Ejercicio anterior" / "Comparativo"
- Notas: sección de notas al pie o al final del balance. Si no hay notas, usar valores por defecto.
Todos los valores numéricos como enteros. Campos ausentes: 0, false o "".`

const ANALISIS_TABS = [
  { id: 'ratios',       label: 'Indicadores'         },
  { id: 'societarios',  label: 'Datos de la empresa' },
  { id: 'comparativo',  label: 'Año anterior'        },
  { id: 'preguntas',    label: 'Preguntas al cliente' },
]

// Mapeo: clave del JSON de la IA → campo del formulario
const MAPA_IA = {
  caja_bancos:           'caja_bancos',
  inversiones_corrientes:'inversiones_corrientes',
  creditos_ventas:       'creditos_ventas',
  otros_creditos_cte:    'otros_creditos_cte',
  bienes_cambio:         'stock',           // ← distinto nombre en el form
  bienes_uso:            'bienes_uso',
  deudas_comerciales:    'deudas_comerciales',
  deudas_financieras_cte:'deudas_financieras_cte',
  rem_cargas_sociales:   'rem_cargas_sociales',
  cargas_fiscales_cte:   'cargas_fiscales_cte',
  deudas_lp:             'deudas_lp',
  otras_deudas_nc:       'otras_deudas_nc',
  patrimonio_neto:       'patrimonio_neto',
  ventas_netas:          'ventas_netas',
  costo_ventas:          'costo_ventas',
  gastos_comercializacion:'gastos_comercializacion',
  gastos_administracion: 'gastos_administracion',
  resultado_financiero:  'resultado_financiero',
  otros_ingresos:        'otros_ingresos',
  impuesto_ganancias:    'impuesto_ganancias',
  resultado_ejercicio:   'resultado_ejercicio',
  efectivo_inicio:       'efectivo_inicio',
  efectivo_cierre:       'efectivo_cierre',
  flujo_operativo:       'flujo_operativo',
  flujo_inversion:       'flujo_inversion',
  flujo_financiamiento:  'flujo_financiamiento',
}

const TABS = [
  { id: 'patrimonio', label: 'Situación patrimonial' },
  { id: 'resultados', label: 'Estado de resultados' },
  { id: 'flujo',      label: 'Flujo de fondos' },
]

const EMPTY_FORM = {
  periodo: '',
  tipo_periodo: 'año',
  fecha_cierre: '',
  // Activo corriente
  caja_bancos: '',
  inversiones_corrientes: '',
  creditos_ventas: '',
  otros_creditos_cte: '',
  stock: '',
  // Activo no corriente
  bienes_uso: '',
  // Pasivo corriente
  deudas_comerciales: '',
  deudas_financieras_cte: '',
  rem_cargas_sociales: '',
  cargas_fiscales_cte: '',
  // Pasivo no corriente
  deudas_lp: '',
  otras_deudas_nc: '',
  // PN
  patrimonio_neto: '',
  // Estado de resultados
  ventas_netas: '',
  costo_ventas: '',
  gastos_comercializacion: '',
  gastos_administracion: '',
  gastos_personal: '',
  amortizaciones: '',
  resultado_financiero: '',
  otros_ingresos: '',
  impuesto_ganancias: '',
  resultado_ejercicio: '',
  intereses_pagados: '',
  // Operativo
  dias_cobro: '',
  dias_stock: '',
  dias_pago: '',
  // Flujo
  efectivo_inicio: '',
  efectivo_cierre: '',
  flujo_operativo: '',
  flujo_inversion: '',
  flujo_financiamiento: '',
}

// ── Config de ratios ───────────────────────────────────────────────
const RATIOS_CONFIG = [
  {
    key: 'margen_bruto',    label: 'Margen bruto',
    fmt: pct,  bench: '≥ 40%',
    color: v => v >= 0.40 ? 'green' : v >= 0.20 ? 'amber' : 'red',
  },
  {
    key: 'margen_ebitda',   label: 'Margen EBITDA',
    fmt: pct,  bench: '≥ 15%',
    color: v => v >= 0.15 ? 'green' : v >= 0.08 ? 'amber' : 'red',
  },
  {
    key: 'margen_neto',     label: 'Margen neto',
    fmt: pct,  bench: '≥ 10%',
    color: v => v >= 0.10 ? 'green' : v >= 0.03 ? 'amber' : 'red',
  },
  {
    key: 'liquidez_corriente', label: 'Liquidez corriente',
    fmt: v => ratio(v), bench: '≥ 1.5x',
    color: v => v >= 1.5 ? 'green' : v >= 1.0 ? 'amber' : 'red',
  },
  {
    key: 'liquidez_acida',  label: 'Liquidez ácida',
    fmt: v => ratio(v), bench: '≥ 1.0x',
    color: v => v >= 1.0 ? 'green' : v >= 0.7 ? 'amber' : 'red',
  },
  {
    key: 'leverage',        label: 'Leverage (D/E)',
    fmt: v => ratio(v), bench: '< 1.5x',
    color: v => v < 1.5 ? 'green' : v < 3.0 ? 'amber' : 'red',
  },
  {
    key: 'deuda_ebitda',    label: 'Deuda / EBITDA',
    fmt: v => ratio(v), bench: '< 3x',
    color: v => v > 0 && v < 3 ? 'green' : v < 5 ? 'amber' : 'red',
  },
  {
    key: 'cce',             label: 'Ciclo de caja (CCE)',
    fmt: days, bench: '< 30 días',
    color: v => v < 30 ? 'green' : v < 60 ? 'amber' : 'red',
  },
]

const DOT = { green: 'dot-green', amber: 'dot-amber', red: 'dot-red', gray: 'dot-gray' }
const BADGE = { green: 'badge-green', amber: 'badge-amber', red: 'badge-red', gray: 'badge-gray' }
const BADGE_LABEL = { green: 'Bien', amber: 'Precaución', red: 'Atención', gray: '—' }

// ── Helpers ────────────────────────────────────────────────────────
const n = v => Number(v) || 0

function computeAggregates(f) {
  const activo_corriente = n(f.caja_bancos) + n(f.inversiones_corrientes) +
    n(f.creditos_ventas) + n(f.otros_creditos_cte) + n(f.stock)
  const pasivo_corriente = n(f.deudas_comerciales) + n(f.deudas_financieras_cte) +
    n(f.rem_cargas_sociales) + n(f.cargas_fiscales_cte)
  const deuda_total = n(f.deudas_financieras_cte) + n(f.deudas_lp) + n(f.otras_deudas_nc)
  const activo_total = activo_corriente + n(f.bienes_uso)
  const pasivo_total = pasivo_corriente + n(f.deudas_lp) + n(f.otras_deudas_nc)
  return { activo_corriente, pasivo_corriente, deuda_total, activo_total, pasivo_total }
}

function buildPayload(form, empresaId) {
  const agg = computeAggregates(form)
  const detail = {
    caja_bancos: form.caja_bancos, inversiones_corrientes: form.inversiones_corrientes,
    creditos_ventas: form.creditos_ventas, otros_creditos_cte: form.otros_creditos_cte,
    bienes_uso: form.bienes_uso, deudas_comerciales: form.deudas_comerciales,
    deudas_financieras_cte: form.deudas_financieras_cte,
    rem_cargas_sociales: form.rem_cargas_sociales, cargas_fiscales_cte: form.cargas_fiscales_cte,
    deudas_lp: form.deudas_lp, otras_deudas_nc: form.otras_deudas_nc,
    fecha_cierre: form.fecha_cierre, otros_ingresos: form.otros_ingresos,
    impuesto_ganancias: form.impuesto_ganancias, resultado_ejercicio: form.resultado_ejercicio,
    efectivo_inicio: form.efectivo_inicio, efectivo_cierre: form.efectivo_cierre,
    flujo_operativo: form.flujo_operativo, flujo_inversion: form.flujo_inversion,
    flujo_financiamiento: form.flujo_financiamiento,
  }
  return {
    empresa_id:        empresaId,
    periodo:           form.periodo,
    tipo_periodo:      form.tipo_periodo,
    ventas_netas:      n(form.ventas_netas),
    costo_ventas:      n(form.costo_ventas),
    gastos_comerciales: n(form.gastos_comercializacion),
    gastos_admin:      n(form.gastos_administracion),
    gastos_personal:   n(form.gastos_personal),
    amortizaciones:    n(form.amortizaciones),
    resultado_financiero: n(form.resultado_financiero),
    activo_corriente:  agg.activo_corriente,
    pasivo_corriente:  agg.pasivo_corriente,
    stock:             n(form.stock),
    deuda_total:       agg.deuda_total,
    intereses_pagados: n(form.intereses_pagados),
    patrimonio_neto:   n(form.patrimonio_neto),
    dias_cobro:        n(form.dias_cobro),
    dias_stock:        n(form.dias_stock),
    dias_pago:         n(form.dias_pago),
    notas: JSON.stringify(detail),
  }
}

function formFromPeriodo(p) {
  if (!p) return EMPTY_FORM
  let detail = {}
  try { detail = JSON.parse(p.notas || '{}') } catch { /* */ }
  return {
    periodo:              p.periodo || '',
    tipo_periodo:         p.tipo_periodo || 'año',
    fecha_cierre:         detail.fecha_cierre || '',
    caja_bancos:          detail.caja_bancos || '',
    inversiones_corrientes: detail.inversiones_corrientes || '',
    creditos_ventas:      detail.creditos_ventas || '',
    otros_creditos_cte:   detail.otros_creditos_cte || '',
    stock:                p.stock ? String(p.stock) : '',
    bienes_uso:           detail.bienes_uso || '',
    deudas_comerciales:   detail.deudas_comerciales || '',
    deudas_financieras_cte: detail.deudas_financieras_cte || '',
    rem_cargas_sociales:  detail.rem_cargas_sociales || '',
    cargas_fiscales_cte:  detail.cargas_fiscales_cte || '',
    deudas_lp:            detail.deudas_lp || '',
    otras_deudas_nc:      detail.otras_deudas_nc || '',
    patrimonio_neto:      p.patrimonio_neto ? String(p.patrimonio_neto) : '',
    ventas_netas:         p.ventas_netas ? String(p.ventas_netas) : '',
    costo_ventas:         p.costo_ventas ? String(p.costo_ventas) : '',
    gastos_comercializacion: p.gastos_comerciales ? String(p.gastos_comerciales) : '',
    gastos_administracion: p.gastos_admin ? String(p.gastos_admin) : '',
    gastos_personal:      p.gastos_personal ? String(p.gastos_personal) : '',
    amortizaciones:       p.amortizaciones ? String(p.amortizaciones) : '',
    resultado_financiero: p.resultado_financiero ? String(p.resultado_financiero) : '',
    otros_ingresos:       detail.otros_ingresos || '',
    impuesto_ganancias:   detail.impuesto_ganancias || '',
    resultado_ejercicio:  detail.resultado_ejercicio || '',
    intereses_pagados:    p.intereses_pagados ? String(p.intereses_pagados) : '',
    dias_cobro:           p.dias_cobro ? String(p.dias_cobro) : '',
    dias_stock:           p.dias_stock ? String(p.dias_stock) : '',
    dias_pago:            p.dias_pago ? String(p.dias_pago) : '',
    efectivo_inicio:      detail.efectivo_inicio || '',
    efectivo_cierre:      detail.efectivo_cierre || '',
    flujo_operativo:      detail.flujo_operativo || '',
    flujo_inversion:      detail.flujo_inversion || '',
    flujo_financiamiento: detail.flujo_financiamiento || '',
  }
}

// ── UI compartidos ─────────────────────────────────────────────────
function Monto({ value, onChange, placeholder = '0' }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-7 text-right"
      />
    </div>
  )
}

function Num({ value, onChange, placeholder = '0', suffix }) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`input text-right ${suffix ? 'pr-12' : ''}`}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  )
}

function Fila({ label, children, hint }) {
  return (
    <div className="grid grid-cols-2 gap-4 items-start mb-3">
      <div>
        <label className="block text-sm text-navy-700 font-medium leading-tight">{label}</label>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function SubTitulo({ children }) {
  return (
    <p className="section-title mb-2 mt-4 first:mt-0">{children}</p>
  )
}

function Divisor() {
  return <hr className="border-slate-100 my-3" />
}

// ── Pestañas del formulario ────────────────────────────────────────
function TabPatrimonio({ f, s }) {
  const agg = computeAggregates(f)
  return (
    <div>
      <SubTitulo>Activo corriente</SubTitulo>
      <Fila label="Caja y bancos"><Monto value={f.caja_bancos} onChange={v => s('caja_bancos', v)} /></Fila>
      <Fila label="Inversiones corrientes"><Monto value={f.inversiones_corrientes} onChange={v => s('inversiones_corrientes', v)} /></Fila>
      <Fila label="Créditos por ventas"><Monto value={f.creditos_ventas} onChange={v => s('creditos_ventas', v)} /></Fila>
      <Fila label="Otros créditos corrientes"><Monto value={f.otros_creditos_cte} onChange={v => s('otros_creditos_cte', v)} /></Fila>
      <Fila label="Bienes de cambio (stock)"><Monto value={f.stock} onChange={v => s('stock', v)} /></Fila>

      <Divisor />
      <SubTitulo>Activo no corriente</SubTitulo>
      <Fila label="Bienes de uso"><Monto value={f.bienes_uso} onChange={v => s('bienes_uso', v)} /></Fila>

      <Divisor />
      <SubTitulo>Pasivo corriente</SubTitulo>
      <Fila label="Deudas comerciales"><Monto value={f.deudas_comerciales} onChange={v => s('deudas_comerciales', v)} /></Fila>
      <Fila label="Deudas financieras (cte.)"><Monto value={f.deudas_financieras_cte} onChange={v => s('deudas_financieras_cte', v)} /></Fila>
      <Fila label="Remuneraciones y cargas soc."><Monto value={f.rem_cargas_sociales} onChange={v => s('rem_cargas_sociales', v)} /></Fila>
      <Fila label="Cargas fiscales corrientes"><Monto value={f.cargas_fiscales_cte} onChange={v => s('cargas_fiscales_cte', v)} /></Fila>

      <Divisor />
      <SubTitulo>Pasivo no corriente</SubTitulo>
      <Fila label="Deudas financieras (largo plazo)"><Monto value={f.deudas_lp} onChange={v => s('deudas_lp', v)} /></Fila>
      <Fila label="Otras deudas no corrientes"><Monto value={f.otras_deudas_nc} onChange={v => s('otras_deudas_nc', v)} /></Fila>

      <Divisor />
      <SubTitulo>Patrimonio neto</SubTitulo>
      <Fila label="Patrimonio neto total"><Monto value={f.patrimonio_neto} onChange={v => s('patrimonio_neto', v)} /></Fila>

      {/* Totales calculados */}
      {agg.activo_corriente > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-100 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-400">Activo corriente calculado</span>
            <p className="font-semibold text-navy-800">{ars(agg.activo_corriente)}</p>
          </div>
          <div>
            <span className="text-slate-400">Activo total</span>
            <p className="font-semibold text-navy-800">{ars(agg.activo_total)}</p>
          </div>
          <div>
            <span className="text-slate-400">Pasivo corriente calculado</span>
            <p className="font-semibold text-navy-800">{ars(agg.pasivo_corriente)}</p>
          </div>
          <div>
            <span className="text-slate-400">Pasivo total</span>
            <p className="font-semibold text-navy-800">{ars(agg.pasivo_total)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function TabResultados({ f, s }) {
  return (
    <div>
      <SubTitulo>Resultados operativos</SubTitulo>
      <Fila label="Ventas netas"><Monto value={f.ventas_netas} onChange={v => s('ventas_netas', v)} /></Fila>
      <Fila label="Costo de ventas"><Monto value={f.costo_ventas} onChange={v => s('costo_ventas', v)} /></Fila>
      <Fila label="Gastos de comercialización"><Monto value={f.gastos_comercializacion} onChange={v => s('gastos_comercializacion', v)} /></Fila>
      <Fila label="Gastos de administración"><Monto value={f.gastos_administracion} onChange={v => s('gastos_administracion', v)} /></Fila>
      <Fila label="Gastos de personal"><Monto value={f.gastos_personal} onChange={v => s('gastos_personal', v)} /></Fila>
      <Fila label="Amortizaciones"><Monto value={f.amortizaciones} onChange={v => s('amortizaciones', v)} /></Fila>

      <Divisor />
      <SubTitulo>Resultados no operativos</SubTitulo>
      <Fila label="Resultado financiero" hint="Negativo si es gasto">
        <Monto value={f.resultado_financiero} onChange={v => s('resultado_financiero', v)} />
      </Fila>
      <Fila label="Intereses pagados (cash)"><Monto value={f.intereses_pagados} onChange={v => s('intereses_pagados', v)} /></Fila>
      <Fila label="Otros ingresos"><Monto value={f.otros_ingresos} onChange={v => s('otros_ingresos', v)} /></Fila>
      <Fila label="Impuesto a las ganancias"><Monto value={f.impuesto_ganancias} onChange={v => s('impuesto_ganancias', v)} /></Fila>
      <Fila label="Resultado del ejercicio"><Monto value={f.resultado_ejercicio} onChange={v => s('resultado_ejercicio', v)} /></Fila>

      <Divisor />
      <SubTitulo>Datos operativos (para CCE)</SubTitulo>
      <Fila label="Días de cobro (promedio)"><Num value={f.dias_cobro} onChange={v => s('dias_cobro', v)} suffix="días" placeholder="30" /></Fila>
      <Fila label="Días de stock (promedio)"><Num value={f.dias_stock} onChange={v => s('dias_stock', v)} suffix="días" placeholder="0" /></Fila>
      <Fila label="Días de pago a proveedores"><Num value={f.dias_pago} onChange={v => s('dias_pago', v)} suffix="días" placeholder="30" /></Fila>
    </div>
  )
}

function TabFlujo({ f, s }) {
  return (
    <div>
      <SubTitulo>Posición de efectivo</SubTitulo>
      <Fila label="Efectivo al inicio del período"><Monto value={f.efectivo_inicio} onChange={v => s('efectivo_inicio', v)} /></Fila>
      <Fila label="Efectivo al cierre del período"><Monto value={f.efectivo_cierre} onChange={v => s('efectivo_cierre', v)} /></Fila>

      <Divisor />
      <SubTitulo>Flujos del período</SubTitulo>
      <Fila label="Flujo operativo" hint="Positivo si genera caja">
        <Monto value={f.flujo_operativo} onChange={v => s('flujo_operativo', v)} />
      </Fila>
      <Fila label="Flujo de inversión" hint="Negativo si invirtió en activos">
        <Monto value={f.flujo_inversion} onChange={v => s('flujo_inversion', v)} />
      </Fila>
      <Fila label="Flujo de financiamiento" hint="Positivo si tomó deuda">
        <Monto value={f.flujo_financiamiento} onChange={v => s('flujo_financiamiento', v)} />
      </Fila>

      {/* Alerta */}
      {n(f.efectivo_inicio) > 0 && n(f.efectivo_cierre) < n(f.efectivo_inicio) * 0.05 && (
        <div className="flex items-start gap-2.5 mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            El efectivo al cierre es menor al 5% del efectivo inicial — nivel crítico de liquidez.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Panel de ratios inline (sin card wrapper, para usar dentro del tab) ──
function RatiosPanelInner({ ratios }) {
  return (
    <div>
      <div className="grid grid-cols-4 gap-3 pb-2 border-b border-nexxo-topoXl mb-1">
        {['Indicador','Valor','Referencia','Estado'].map(h => (
          <span key={h} className="text-[10px] font-bold text-nexxo-topo uppercase tracking-wider last:text-right">{h}</span>
        ))}
      </div>
      {RATIOS_CONFIG.map(cfg => {
        const val   = ratios?.[cfg.key]
        const valid = val != null && isFinite(val) && val !== 0
        const color = valid ? cfg.color(val) : 'gray'
        const STATE_CLS = {
          green: 'text-green-700 bg-green-50 border border-green-200',
          amber: 'text-amber-700 bg-amber-50 border border-amber-200',
          red:   'text-red-600 bg-red-50 border border-red-200',
          gray:  'text-nexxo-gray bg-nexxo-off border border-nexxo-light',
        }
        return (
          <div key={cfg.key} className="grid grid-cols-4 gap-3 py-3 border-b border-nexxo-light last:border-0 items-center">
            <span className="text-xs text-nexxo-black font-medium">{cfg.label}</span>
            <span className="font-mono text-sm font-semibold text-nexxo-black text-right">{valid ? cfg.fmt(val) : '—'}</span>
            <span className="text-[10px] text-nexxo-topo text-center">{cfg.bench}</span>
            <div className="flex justify-end">
              <span className={`${STATE_CLS[color]} text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm`}>
                {BADGE_LABEL[color]}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Datos societarios extraídos del PDF ───────────────────────────
function DatosSocietariosPanel({ datos }) {
  const campos = [
    { l: 'Razón social',         v: datos?.razon_social         },
    { l: 'CUIT',                  v: datos?.cuit                 },
    { l: 'Domicilio legal',       v: datos?.domicilio_legal      },
    { l: 'Actividad principal',   v: datos?.actividad_principal  },
    { l: 'Forma jurídica',        v: datos?.forma_juridica       },
    { l: 'Número de ejercicio',   v: datos?.numero_ejercicio     },
    { l: 'Inicio del ejercicio',  v: datos?.fecha_inicio_ejercicio },
    { l: 'Cierre del ejercicio',  v: datos?.fecha_cierre_ejercicio },
    { l: 'Capital social',        v: datos?.capital_social ? ars(datos.capital_social) : null },
    { l: 'Contador firmante',     v: datos?.nombre_contador      },
    { l: 'Matrícula contador',    v: datos?.matricula_contador   },
  ]
  if (!datos) return (
    <div className="text-center py-8">
      <p className="text-sm text-slate-400">Subí el PDF del balance para extraer los datos de la carátula automáticamente.</p>
    </div>
  )
  return (
    <div className="space-y-0">
      {campos.map(({ l, v }) => (
        <div key={l} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
          <span className="text-xs text-slate-400 w-40 flex-shrink-0">{l}</span>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-nexxo-black font-medium">{v || '—'}</span>
            {v && <span className="bg-nexxo-off text-nexxo-topo border border-nexxo-topo text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5">Desde PDF</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Análisis comparativo año actual vs anterior ────────────────────
function ComparativoPanel({ anterior, savedRow, ratios }) {
  if (!anterior || !savedRow) return (
    <div className="text-center py-8">
      <p className="text-sm text-slate-400">El balance debe tener columna comparativa para mostrar variaciones.</p>
    </div>
  )
  const pct = (act, ant) => ant && ant !== 0 ? ((act - ant) / Math.abs(ant) * 100).toFixed(1) : null
  const filas = [
    { l: 'Ventas netas',      act: savedRow.ventas_netas,    ant: anterior.ventas_netas,    bueno: v => v > 0 },
    { l: 'Resultado',         act: savedRow.resultado_neto ?? (n(savedRow.ventas_netas)-n(savedRow.costo_ventas)-n(savedRow.gastos_comerciales)-n(savedRow.gastos_admin)-n(savedRow.gastos_personal)+n(savedRow.resultado_financiero)), ant: anterior.resultado_ejercicio, bueno: v => v > 0 },
    { l: 'Patrimonio neto',   act: savedRow.patrimonio_neto, ant: anterior.patrimonio_neto, bueno: v => v > 0 },
    { l: 'Activo total',      act: (n(savedRow.activo_corriente) + (n(savedRow.notas?.bienes_uso)||0)), ant: anterior.activo_total, bueno: v => v > 0 },
    { l: 'Pasivo total',      act: (n(savedRow.pasivo_corriente) + n(savedRow.deuda_total)), ant: anterior.pasivo_total, bueno: v => v < 0 },
    { l: 'Liquidez corriente',act: ratios?.liquidez_corriente, ant: anterior.activo_corriente && anterior.pasivo_corriente ? anterior.activo_corriente / anterior.pasivo_corriente : null, fmt: v => `${v?.toFixed(2)}x`, bueno: v => v > 0 },
  ]
  return (
    <div>
      <div className="grid grid-cols-4 gap-3 pb-2 border-b border-nexxo-topoXl mb-1">
        {['Indicador','Anterior','Actual','Variación'].map(h => (
          <span key={h} className="text-[10px] font-bold text-nexxo-topo uppercase tracking-wider">{h}</span>
        ))}
      </div>
      {filas.map(({ l, act, ant, fmt, bueno }) => {
        const v   = pct(n(act), n(ant))
        const pos = v !== null && parseFloat(v) >= 0
        const fmtFn = fmt || ars
        const isGood = bueno ? bueno(parseFloat(v)) : pos
        return (
          <div key={l} className="grid grid-cols-4 gap-3 py-3 border-b border-nexxo-light last:border-0 items-center">
            <span className="text-xs text-nexxo-black font-medium">{l}</span>
            <span className="font-mono text-sm text-nexxo-gray">{ant ? fmtFn(n(ant)) : '—'}</span>
            <span className="font-mono text-sm font-semibold text-nexxo-black">{act ? fmtFn(n(act)) : '—'}</span>
            {v !== null ? (
              <span className={`font-mono text-sm font-semibold ${isGood ? 'text-green-600' : 'text-red-500'}`}>
                {pos ? '↑' : '↓'} {Math.abs(parseFloat(v))}%
              </span>
            ) : <span className="text-nexxo-light text-sm">—</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── Preguntas sugeridas para el asesor ────────────────────────────
function PreguntasPanel({ preguntas = [], alertas = [] }) {
  return (
    <div className="space-y-4">
      {alertas.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-nexxo-topo mb-2">Alertas generadas</p>
          {alertas.map((a, i) => (
            <div key={i} className={`p-3 border-l-4 text-sm
              ${a.nivel === 'critico'
                ? 'bg-red-50 border-red-500 text-red-800'
                : a.nivel === 'alto'
                  ? 'bg-amber-50 border-amber-500 text-amber-800'
                  : 'bg-green-50 border-green-600 text-green-800'}`}>
              <p className="font-semibold text-xs uppercase tracking-wider mb-0.5">
                {a.nivel === 'critico' ? 'Crítico' : a.nivel === 'alto' ? 'Atención' : 'Positivo'}
              </p>
              <p>{a.mensaje}</p>
            </div>
          ))}
        </div>
      )}
      {preguntas.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-nexxo-topo mb-3">Preguntas sugeridas para el cliente</p>
          <div className="space-y-2">
            {preguntas.map((p, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-1 h-1 rounded-full bg-nexxo-topo flex-shrink-0 mt-2" />
                <p className="text-sm text-nexxo-gray italic">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-nexxo-gray text-center py-4">Guardá el balance para ver las preguntas sugeridas.</p>
      )}
    </div>
  )
}

// ── Panel de ratios ────────────────────────────────────────────────
function RatioRow({ cfg, value }) {
  const isValid = value != null && isFinite(value) && value !== 0
  const color = isValid ? cfg.color(value) : 'gray'
  return (
    <div className="grid grid-cols-4 gap-3 py-3 border-b border-slate-100 last:border-0 items-center">
      <span className="text-sm text-navy-700 font-medium">{cfg.label}</span>
      <span className="text-sm font-semibold text-navy-900 text-right tabular-nums">
        {isValid ? cfg.fmt(value) : '—'}
      </span>
      <span className="text-xs text-slate-400 text-center">{cfg.bench}</span>
      <div className="flex justify-end">
        <span className={`${BADGE[color]} text-xs`}>{BADGE_LABEL[color]}</span>
      </div>
    </div>
  )
}

function RatiosPanel({ ratios }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-navy-800 mb-1">Ratios financieros</h3>
      <div className="grid grid-cols-4 gap-3 pb-2 border-b border-slate-200 mb-1">
        {['Indicador', 'Valor', 'Referencia', 'Estado'].map(h => (
          <span key={h} className="text-xs font-medium text-slate-400 uppercase tracking-wide last:text-right">{h}</span>
        ))}
      </div>
      {RATIOS_CONFIG.map(cfg => (
        <RatioRow key={cfg.key} cfg={cfg} value={ratios?.[cfg.key]} />
      ))}
    </div>
  )
}

// ── Análisis de flujo ──────────────────────────────────────────────
function TooltipFlujo({ active, payload }) {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm text-xs">
      <p className="text-slate-500 mb-0.5">{payload[0].payload.name}</p>
      <p className={`font-semibold ${v >= 0 ? 'text-brand-700' : 'text-red-600'}`}>
        {v >= 0 ? '+' : ''}{ars(v)}
      </p>
    </div>
  )
}

function FlujoAnalisis({ form }) {
  const fo = n(form.flujo_operativo)
  const fi = n(form.flujo_inversion)
  const ff = n(form.flujo_financiamiento)
  const ei = n(form.efectivo_inicio)
  const ec = n(form.efectivo_cierre)

  if (!fo && !fi && !ff) return null

  const chartData = [
    { name: 'Operativo',      valor: fo },
    { name: 'Inversión',      valor: fi },
    { name: 'Financiamiento', valor: ff },
  ]

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-navy-800 mb-1">Análisis de flujo de fondos</h3>
      {ei > 0 && (
        <div className="flex gap-4 mb-4 text-xs">
          <div>
            <span className="text-slate-400">Inicio</span>
            <p className="font-semibold text-navy-800">{ars(ei)}</p>
          </div>
          <div className="w-px bg-slate-200" />
          <div>
            <span className="text-slate-400">Cierre</span>
            <p className={`font-semibold ${ec >= ei ? 'text-brand-700' : 'text-red-600'}`}>{ars(ec)}</p>
          </div>
          <div className="w-px bg-slate-200" />
          <div>
            <span className="text-slate-400">Variación</span>
            <p className={`font-semibold ${ec - ei >= 0 ? 'text-brand-700' : 'text-red-600'}`}>
              {ec - ei >= 0 ? '+' : ''}{ars(ec - ei)}
            </p>
          </div>
        </div>
      )}
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 70, right: 30 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={70}
          />
          <Tooltip content={<TooltipFlujo />} cursor={{ fill: '#f1f5f9' }} />
          <ReferenceLine x={0} stroke="#e2e8f0" />
          <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={20}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.valor >= 0 ? '#0A8A7A' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {ec < ei * 0.05 && ei > 0 && (
        <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            El efectivo al cierre cayó a menos del 5% del inicial — nivel crítico que requiere atención inmediata.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Informe ejecutivo ──────────────────────────────────────────────
function generarParrafos(form, ratios, nombreEmpresa) {
  const nom = nombreEmpresa || 'La empresa'
  const per = form.periodo || 'el período analizado'

  const res = n(form.resultado_ejercicio) || ratios?.resultado_neto || 0
  const signo = res >= 0
    ? `resultado positivo de ${ars(res)}`
    : `resultado negativo de ${ars(Math.abs(res))}`

  const rentDesc = ratios?.margen_ebitda >= 0.15
    ? 'Los márgenes operativos son saludables, lo que refleja una estructura de costos eficiente.'
    : ratios?.margen_ebitda >= 0.08
      ? 'Los márgenes son moderados y tienen margen de mejora — reducir costos fijos o aumentar precios tendría alto impacto.'
      : 'Los márgenes operativos están por debajo del umbral mínimo recomendado. La estructura de costos requiere revisión prioritaria.'

  const liqDesc = ratios?.liquidez_corriente >= 1.5
    ? `Con una liquidez corriente de ${ratio(ratios.liquidez_corriente)}x, la empresa puede afrontar sus compromisos de corto plazo con comodidad.`
    : ratios?.liquidez_corriente >= 1.0
      ? `La liquidez corriente de ${ratio(ratios.liquidez_corriente)}x es aceptable pero ajustada. Se recomienda monitorear el flujo de caja mensual.`
      : `La liquidez corriente de ${ratio(ratios.liquidez_corriente)}x está por debajo del mínimo recomendado (1.0x), lo que puede generar dificultades para cumplir compromisos inmediatos.`

  const deudaDesc = ratios?.leverage < 1.5
    ? `El leverage de ${ratio(ratios.leverage)}x refleja una estructura de capital conservadora, con margen para tomar deuda adicional si fuera necesario.`
    : ratios?.leverage < 3.0
      ? `El leverage de ${ratio(ratios.leverage)}x es razonable pero merece seguimiento, especialmente en entornos de tasas altas.`
      : `El leverage de ${ratio(ratios.leverage)}x es elevado. Se recomienda evaluar alternativas de refinanciación o reemplazo de deuda bancaria por instrumentos del mercado de capitales.`

  const cceDesc = ratios?.cce < 30
    ? `El ciclo de conversión de efectivo de ${days(ratios.cce)} es eficiente — la empresa convierte ventas en caja rápidamente. Poco requerimiento de financiamiento de capital de trabajo.`
    : ratios?.cce < 60
      ? `El CCE de ${days(ratios.cce)} es moderado. Acelerar cobros o extender plazos de pago a proveedores podría liberar caja sin costo.`
      : `El CCE de ${days(ratios.cce)} es extenso y presiona el capital de trabajo. Se recomienda explorar descuento de facturas, cesión de cheques o líneas de capital de trabajo para financiar el ciclo.`

  return [
    `Durante ${per}, ${nom} registró ventas por ${ars(n(form.ventas_netas))}, con un ${signo}. ${rentDesc}`,
    liqDesc,
    deudaDesc,
    cceDesc,
  ]
}

const EXPLICACIONES = {
  margen_bruto:       'De cada $100 que vendés, cuánto te queda después de pagar lo que vendiste',
  margen_ebitda:      'Cuánto te queda después de pagar todos los costos operativos',
  margen_neto:        'Cuánto ganó la empresa en total al final del año',
  liquidez_corriente: 'Por cada $1 que debés a corto plazo, cuánto tenés disponible',
  liquidez_acida:     'Lo mismo pero sin contar el stock',
  leverage:           'Qué tan endeudada está la empresa en relación a lo que vale',
  deuda_ebitda:       'Cuántos años necesitarías para cancelar toda la deuda con las ganancias actuales',
  cce:                'Cuántos días tarda tu plata en volver después de una venta',
}

const GLOSARIO = [
  { term: 'Activo corriente',
    def:  'Todo lo que tiene la empresa y se puede convertir en plata en menos de un año: caja, cuentas por cobrar, stock.' },
  { term: 'Pasivo corriente',
    def:  'Todas las deudas que vencen en menos de un año: proveedores, cuotas de préstamos, impuestos a pagar.' },
  { term: 'EBITDA',
    def:  'Ganancia antes de intereses, impuestos, depreciaciones y amortizaciones. Muestra cuánto genera el negocio por sí mismo, sin importar cómo está financiado.' },
  { term: 'Liquidez',
    def:  'La capacidad de una empresa de pagar sus deudas a tiempo. Una empresa puede ser rentable y al mismo tiempo tener problemas de liquidez si no cobra a tiempo.' },
  { term: 'Leverage',
    def:  'Cuánta deuda tiene la empresa en relación a su propio capital. Un leverage alto significa que la empresa depende mucho de terceros para financiarse.' },
  { term: 'Patrimonio neto',
    def:  'Lo que le pertenece realmente a los dueños: el total de activos menos el total de deudas. Es el valor contable de la empresa.' },
  { term: 'Flujo de caja operativo',
    def:  'El dinero real que entra y sale por la actividad principal de la empresa. Es el pulso de la salud financiera del negocio.' },
  { term: 'Ciclo de conversión de efectivo (CCE)',
    def:  'Cuántos días pasan entre que la empresa paga a sus proveedores y cobra a sus clientes. Cuanto más corto, mejor.' },
  { term: 'Mercado de capitales',
    def:  'El sistema donde las empresas pueden obtener financiamiento emitiendo bonos o negociando cheques, pagarés y otros instrumentos sin pasar por el banco.' },
  { term: 'ON PyME (Obligación Negociable)',
    def:  'Un bono que emite una PyME para financiarse directamente de inversores, generalmente a tasas más bajas que el crédito bancario.' },
  { term: 'SGR (Sociedad de Garantía Recíproca)',
    def:  'Entidad que avala a PyMEs para que puedan acceder a créditos o emitir instrumentos financieros con mejores condiciones.' },
  { term: 'ECHEQ (Cheque Electrónico)',
    def:  'Cheque emitido digitalmente que se puede descontar en el mercado de capitales antes de su vencimiento para obtener liquidez inmediata.' },
]

const SYSTEM_INFORME = `Sos un CFO senior con 20 años de experiencia asesorando PyMEs argentinas. \
Redacta un informe financiero integral profesional pero accesible para el dueño de una empresa PyME. \
Usa términos técnicos pero siempre explicalos entre paréntesis. Sé directo, concreto y accionable. \
Nunca uses lenguaje condescendiente. Estructura el informe con estas secciones usando estos títulos \
exactos en mayúscula: RESUMEN EJECUTIVO, ANÁLISIS DE RENTABILIDAD, ANÁLISIS DE LIQUIDEZ Y SOLVENCIA, \
ANÁLISIS DE ENDEUDAMIENTO, ANÁLISIS DEL FLUJO DE FONDOS, POSICIÓN FRENTE AL MERCADO DE CAPITALES, \
LAS 3 PRIORIDADES DE ACCIÓN. Cada sección debe tener 2-3 párrafos. Las prioridades deben ser \
concretas, ordenadas por urgencia e incluir una acción específica con plazo.`

function buildPromptInforme(form, ratios, nombreEmpresa) {
  const agg = computeAggregates(form)
  const ub  = n(form.ventas_netas) - n(form.costo_ventas)
  const eb  = ub - n(form.gastos_comercializacion) - n(form.gastos_administracion) - n(form.gastos_personal)
  const rn  = eb + n(form.resultado_financiero) + n(form.otros_ingresos) - n(form.impuesto_ganancias)
  const vn  = n(form.ventas_netas)
  const fmt = v => `$${(v || 0).toLocaleString('es-AR')}`
  const pc  = (v, b) => b ? `${(v / b * 100).toFixed(1)}%` : '0%'
  const rt  = k => ratios?.[k] != null && isFinite(ratios[k]) ? `${ratios[k].toFixed(2)}x` : '—'

  return `Redacta el informe financiero integral de ${nombreEmpresa || 'la empresa'}, período ${form.periodo || 'informado'}, fecha de cierre ${form.fecha_cierre || 'no especificada'}.

ESTADO DE SITUACIÓN PATRIMONIAL (en pesos argentinos):
Activo corriente: Caja y bancos ${fmt(n(form.caja_bancos))}, Inversiones corrientes ${fmt(n(form.inversiones_corrientes))}, Créditos por ventas ${fmt(n(form.creditos_ventas))}, Otros créditos ${fmt(n(form.otros_creditos_cte))}. Total activo corriente ${fmt(agg.activo_corriente)}.
Activo no corriente: Bienes de uso ${fmt(n(form.bienes_uso))}. Total activo ${fmt(agg.activo_total)}.
Pasivo corriente: Deudas comerciales ${fmt(n(form.deudas_comerciales))}, Deudas financieras ${fmt(n(form.deudas_financieras_cte))}, Cargas sociales ${fmt(n(form.rem_cargas_sociales))}, Cargas fiscales ${fmt(n(form.cargas_fiscales_cte))}. Total pasivo corriente ${fmt(agg.pasivo_corriente)}.
Pasivo no corriente: ${fmt(n(form.deudas_lp) + n(form.otras_deudas_nc))}. Total pasivo ${fmt(agg.pasivo_total)}.
Patrimonio neto ${fmt(n(form.patrimonio_neto))}.

ESTADO DE RESULTADOS:
Ventas netas ${fmt(vn)}, Costo de ventas ${fmt(n(form.costo_ventas))}, Utilidad bruta ${fmt(ub)} (margen ${pc(ub, vn)}), Gastos comercialización ${fmt(n(form.gastos_comercializacion))}, Gastos administración ${fmt(n(form.gastos_administracion))}, EBITDA ${fmt(eb)} (margen ${pc(eb, vn)}), Resultado financiero ${fmt(n(form.resultado_financiero))}, Otros ingresos ${fmt(n(form.otros_ingresos))}, Impuesto ganancias ${fmt(n(form.impuesto_ganancias))}, Resultado neto ${fmt(rn)} (margen ${pc(rn, vn)}).

FLUJO DE EFECTIVO:
Efectivo inicio ${fmt(n(form.efectivo_inicio))}, Efectivo cierre ${fmt(n(form.efectivo_cierre))}, Flujo operativo ${fmt(n(form.flujo_operativo))}, Flujo inversión ${fmt(n(form.flujo_inversion))}, Flujo financiamiento ${fmt(n(form.flujo_financiamiento))}, Variación neta ${fmt(n(form.efectivo_cierre) - n(form.efectivo_inicio))}.

RATIOS FINANCIEROS CALCULADOS:
Margen bruto ${ratios ? pct(ratios.margen_bruto) : '—'}, Margen EBITDA ${ratios ? pct(ratios.margen_ebitda) : '—'}, Margen neto ${ratios ? pct(ratios.margen_neto) : '—'}, Liquidez corriente ${rt('liquidez_corriente')}, Liquidez ácida ${rt('liquidez_acida')}, Leverage ${rt('leverage')}, Deuda/EBITDA ${rt('deuda_ebitda')}.`
}

function calcPrioridades(ratios) {
  const lista = []

  if (ratios?.liquidez_corriente < 1.5)
    lista.push({
      titulo: 'Fortalecer la liquidez',
      desc: `Liquidez corriente de ${ratio(ratios.liquidez_corriente)}x — por debajo del nivel óptimo. Revisar el capital de trabajo y explorar líneas de crédito de corto plazo.`,
    })
  if (ratios?.leverage > 2)
    lista.push({
      titulo: 'Optimizar la estructura de deuda',
      desc: `Leverage de ${ratio(ratios.leverage)}x — nivel elevado. Evaluar refinanciación o reemplazo de deuda bancaria por instrumentos del mercado de capitales.`,
    })
  if (ratios?.margen_ebitda < 0.10)
    lista.push({
      titulo: 'Mejorar la rentabilidad operativa',
      desc: `Margen EBITDA de ${pct(ratios.margen_ebitda)} — por debajo del umbral recomendado. Revisar estructura de costos y política de precios.`,
    })
  if (ratios?.cce > 45)
    lista.push({
      titulo: 'Reducir el ciclo de caja',
      desc: `CCE de ${days(ratios.cce)} — extendido. Acelerar cobros o extender plazos de pago a proveedores para liberar capital de trabajo.`,
    })
  if (lista.length < 3 && ratios?.leverage < 1.5)
    lista.push({
      titulo: 'Aprovechar capacidad de endeudamiento',
      desc: `Con leverage de ${ratio(ratios.leverage)}x la empresa tiene margen para financiar crecimiento o inversiones con deuda a costo razonable.`,
    })
  if (lista.length < 3)
    lista.push({
      titulo: 'Diversificar fuentes de financiamiento',
      desc: 'Explorar instrumentos del mercado de capitales (descuento de ECHEQs, caución bursátil, ON PyME) como alternativa al crédito bancario tradicional.',
    })
  if (lista.length < 3)
    lista.push({
      titulo: 'Planificación financiera proactiva',
      desc: 'Mantener proyecciones de flujo de caja actualizadas y revisar los indicadores mensualmente para anticipar decisiones.',
    })

  return lista.slice(0, 3)
}

function generarPDF(form, ratios, nombreEmpresa) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W     = 210
  const ML    = 15
  const TW    = W - ML - 15           // 180mm usable
  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  let y       = 20

  // ── Helpers ──────────────────────────────────────────────────────
  function checkPage(needed = 20) { if (y + needed > 275) { doc.addPage(); y = 20 } }

  function sectionTitle(text) {
    checkPage(12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(13, 27, 62)
    doc.text(text, ML, y)
    y += 6
  }

  function bodyText(text, size = 8.5, rgb = [71, 85, 105]) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...rgb)
    const lines = doc.splitTextToSize(text, TW)
    checkPage(lines.length * (size * 0.42) + 2)
    doc.text(lines, ML, y)
    y += lines.length * (size * 0.42) + 1.5
  }

  function divider(r = 226, g = 232, b = 240) {
    doc.setDrawColor(r, g, b)
    doc.line(ML, y, W - 15, y)
    y += 5
  }

  // ── 1. HEADER ────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(10, 138, 122)        // brand #0A8A7A
  doc.text('CFOConnect', ML, y)
  y += 9

  doc.setFontSize(15)
  doc.setTextColor(13, 27, 62)
  doc.text(nombreEmpresa || 'Empresa', ML, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text(`Período: ${form.periodo || '—'}`, ML, y)
  y += 4.5
  doc.text(`Generado el: ${fecha}`, ML, y)
  y += 6
  divider(10, 138, 122)                 // brand color divider

  // ── 2. RESUMEN EJECUTIVO ─────────────────────────────────────────
  sectionTitle('RESUMEN EJECUTIVO')
  const parrafos = generarParrafos(form, ratios, nombreEmpresa)
  parrafos.forEach(p => { bodyText(p); y += 1.5 })
  y += 2
  divider()

  // ── 3. TABLA DE RATIOS ───────────────────────────────────────────
  checkPage(55)
  sectionTitle('INDICADORES FINANCIEROS')

  // 5 columnas: Indicador | Valor | Referencia | Estado | ¿Qué significa?
  const colW  = [38, 20, 24, 20, 78]
  const colX  = colW.reduce((acc, w, i) => {
    acc.push(i === 0 ? ML : acc[i - 1] + colW[i - 1])
    return acc
  }, [])
  const baseRowH  = 6.5
  const descFontS = 7
  const descColW  = colW[4] - 4            // usable width inside desc column
  const heads = ['Indicador', 'Valor', 'Referencia', 'Estado', 'Que significa']

  // Header
  doc.setFillColor(13, 27, 62)
  doc.rect(ML, y, TW, baseRowH, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  heads.forEach((h, i) => doc.text(h, colX[i] + 2, y + 4.3))
  y += baseRowH

  const COLOR_RGB = {
    green: [22, 163, 74],
    amber: [217, 119, 6],
    red:   [220, 38,  38],
    gray:  [148, 163, 184],
  }
  const ESTADO_LABEL = { green: 'Bien', amber: 'Precaución', red: 'Crítico', gray: '—' }

  RATIOS_CONFIG.forEach((cfg, idx) => {
    const val         = ratios?.[cfg.key]
    const valid       = val != null && isFinite(val) && val !== 0
    const col         = valid ? cfg.color(val) : 'gray'
    const explicacion = EXPLICACIONES[cfg.key] || ''

    // Calcular altura dinámica según líneas del texto descriptivo
    doc.setFontSize(descFontS)
    const descLines = doc.splitTextToSize(explicacion, descColW)
    const thisRowH  = Math.max(baseRowH, descLines.length * (descFontS * 0.43) + 3.5)

    checkPage(thisRowH + 2)

    // Fondo alternado
    if (idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(ML, y, TW, thisRowH, 'F') }

    const vMid = y + thisRowH / 2 + 1.5   // centro vertical de la fila

    // Indicador
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(30, 41, 59)
    doc.text(cfg.label, colX[0] + 2, vMid)

    // Valor
    doc.setFont('helvetica', 'bold')
    doc.text(valid ? cfg.fmt(val) : '—', colX[1] + 2, vMid)

    // Referencia
    doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139)
    doc.text(cfg.bench, colX[2] + 2, vMid)

    // Estado
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...COLOR_RGB[col])
    doc.text(ESTADO_LABEL[col], colX[3] + 2, vMid)

    // Que significa — alineado arriba dentro de la fila
    doc.setFont('helvetica', 'normal'); doc.setFontSize(descFontS); doc.setTextColor(71, 85, 105)
    doc.text(descLines, colX[4] + 2, y + 3.5)

    // Borde inferior de fila
    doc.setDrawColor(226, 232, 240)
    doc.line(ML, y + thisRowH, ML + TW, y + thisRowH)
    y += thisRowH
  })

  y += 4
  divider()

  // ── 4. FLUJO DE FONDOS (condicional) ─────────────────────────────
  const fo = n(form.flujo_operativo)
  const fi = n(form.flujo_inversion)
  const ff = n(form.flujo_financiamiento)
  const ei = n(form.efectivo_inicio)
  const ec = n(form.efectivo_cierre)

  if (fo || fi || ff) {
    checkPage(45)
    sectionTitle('ANÁLISIS DE FLUJO DE FONDOS')

    const flujoRows = [
      { label: 'Flujo operativo',       val: fo },
      { label: 'Flujo de inversión',    val: fi },
      { label: 'Flujo de financiamiento', val: ff },
      ...(ei ? [{ label: 'Variación de efectivo', val: ec - ei }] : []),
    ]

    flujoRows.forEach((row, idx) => {
      checkPage(baseRowH + 2)
      if (idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(ML, y, TW, baseRowH, 'F') }

      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(30, 41, 59)
      doc.text(row.label, ML + 2, y + 4.3)

      const rgb = row.val >= 0 ? [10, 138, 122] : [220, 38, 38]
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...rgb)
      doc.text((row.val >= 0 ? '+' : '') + ars(row.val), ML + 115, y + 4.3)

      doc.setDrawColor(226, 232, 240)
      doc.line(ML, y + baseRowH, ML + TW, y + baseRowH)
      y += baseRowH
    })

    y += 4
    divider()
  }

  // ── 5. PRIORIDADES DE ACCIÓN ─────────────────────────────────────
  checkPage(45)
  sectionTitle('PRIORIDADES DE ACCIÓN')

  calcPrioridades(ratios).forEach((p, i) => {
    checkPage(22)

    doc.setFillColor(10, 138, 122)
    doc.roundedRect(ML, y + 0.5, 6, 5.5, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255)
    doc.text(String(i + 1), ML + 1.8, y + 4.2)

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(13, 27, 62)
    doc.text(p.titulo, ML + 8, y + 3.8)
    y += 7

    bodyText(p.desc, 8, [100, 116, 139])
    y += 2
  })

  // ── 6. GLOSARIO ──────────────────────────────────────────────────
  doc.addPage()
  y = 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(13, 27, 62)
  doc.text('Glosario de terminos financieros', ML, y)
  y += 4
  doc.setDrawColor(10, 138, 122)
  doc.line(ML, y, W - 15, y)
  y += 8

  GLOSARIO.forEach(({ term, def }) => {
    // Calcular espacio necesario
    doc.setFontSize(8.5)
    const defLines = doc.splitTextToSize(def, TW)
    const needed   = 5 + defLines.length * 4 + 5
    checkPage(needed)

    // Término en negrita
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(13, 27, 62)
    doc.text(term + ':', ML, y)
    y += 4.5

    // Definición en normal
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text(defLines, ML, y)
    y += defLines.length * 4 + 5
  })

  // ── 7. FOOTER en todas las páginas ───────────────────────────────
  const total = doc.getNumberOfPages ? doc.getNumberOfPages() : doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.line(ML, 285, W - 15, 285)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(148, 163, 184)
    doc.text('Documento generado por CFOConnect — Asesoria financiera para PyMEs', ML, 291)
    doc.text(`${fecha}  |  Página ${i} de ${total}`, W - 15, 291, { align: 'right' })
  }

  // ── Descarga ──────────────────────────────────────────────────────
  const nombre  = (nombreEmpresa || 'Empresa').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  const periodo = (form.periodo  || 'sin-periodo').replace(/[^\w-]/g, '-')
  doc.save(`Informe-${nombre}-${periodo}.pdf`)
}

function generarPDFCompleto(informeIA, form, ratios, nombreEmpresa) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W     = 210, ML = 15, TW = 180
  const fecha = new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' })
  let y       = 20

  // Colores por sección
  const SEC_CFG = {
    resumen:       { label:'RESUMEN EJECUTIVO',         rgb:[10,138,122],  bg:[240,253,250] },
    rentabilidad:  { label:'ANALISIS DE RENTABILIDAD',  rgb:[59,130,246],  bg:[239,246,255] },
    liquidez:      { label:'LIQUIDEZ Y SOLVENCIA',      rgb:[14,165,233],  bg:[240,249,255] },
    endeudamiento: { label:'ANALISIS DE ENDEUDAMIENTO', rgb:[245,158,11],  bg:[255,251,235] },
    flujo:         { label:'FLUJO DE FONDOS',           rgb:[139,92,246],  bg:[245,243,255] },
    mercado:       { label:'MERCADO DE CAPITALES',      rgb:[100,116,139], bg:[248,250,252] },
    prioridades:   { label:'PRIORIDADES DE ACCION',     rgb:[220,38,38],   bg:[255,241,242] },
  }
  const RC = { green:[22,163,74], amber:[217,119,6], red:[220,38,38], gray:[148,163,184] }

  const ck = (n = 15) => { if (y + n > 278) { doc.addPage(); y = 20 } }

  // ── Helpers ──────────────────────────────────────────────────────
  function secHeader(id) {
    const c = SEC_CFG[id] || SEC_CFG.mercado
    ck(16)
    // Accent bar
    doc.setFillColor(...c.rgb); doc.rect(ML, y, 3, 8, 'F')
    // Title
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(13,27,62)
    doc.text(c.label, ML + 7, y + 5.5)
    // Underline
    doc.setDrawColor(226,232,240); doc.line(ML + 7, y + 8.5, W - ML, y + 8.5)
    y += 13
  }

  function bodyTxt(contenido) {
    contenido.split(/\n{2,}/).filter(p => p.trim()).forEach(p => {
      const lines = doc.splitTextToSize(p.trim(), TW)
      ck(lines.length * 3.8 + 3)
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(71,85,105)
      doc.text(lines, ML, y)
      y += lines.length * 3.8 + 2.5
    })
  }

  function kpiBoxes() {
    if (!ratios) return
    y += 3; ck(20)
    const bW = (TW - 9) / 4
    const kpis = [
      { lbl:'Ventas netas',  val:ars(n(form.ventas_netas)),                bg:[241,245,249], vc:[100,116,139] },
      { lbl:'Margen EBITDA', val:pct(ratios.margen_ebitda),                bg:ratios.margen_ebitda>=0.08?[240,253,250]:[255,241,242], vc:ratios.margen_ebitda>=0.08?[10,138,122]:[220,38,38] },
      { lbl:'Liquidez',      val:`${ratios.liquidez_corriente?.toFixed(2)}x`, bg:ratios.liquidez_corriente>=1.0?[240,253,250]:[255,241,242], vc:ratios.liquidez_corriente>=1.0?[10,138,122]:[220,38,38] },
      { lbl:'Leverage D/E',  val:`${ratios.leverage?.toFixed(2)}x`,        bg:ratios.leverage<3.0?[255,251,235]:[255,241,242], vc:ratios.leverage<3.0?[217,119,6]:[220,38,38] },
    ]
    kpis.forEach(({ lbl, val, bg, vc }, i) => {
      const cx = ML + i * (bW + 3)
      doc.setFillColor(...bg); doc.roundedRect(cx, y, bW, 16, 1.5, 1.5, 'F')
      doc.setDrawColor(226,232,240); doc.roundedRect(cx, y, bW, 16, 1.5, 1.5, 'D')
      doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor(100,116,139)
      doc.text(lbl, cx + 2.5, y + 4.5)
      doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(...vc)
      doc.text(val, cx + 2.5, y + 12.5)
    })
    y += 20
  }

  function marginBars() {
    if (!ratios) return
    y += 3; ck(35)
    const bW = TW - 26
    ;[
      { lbl:'Margen bruto',  v:ratios.margen_bruto,  mx:0.6 },
      { lbl:'Margen EBITDA', v:ratios.margen_ebitda, mx:0.4 },
      { lbl:'Margen neto',   v:ratios.margen_neto,   mx:0.3 },
    ].forEach(({ lbl, v, mx }) => {
      const w   = Math.min(Math.max((v / mx), 0), 1) * bW
      const clr = v >= 0.15 ? [10,138,122] : v >= 0.08 ? [217,119,6] : [220,38,38]
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(100,116,139)
      doc.text(lbl, ML, y + 3)
      doc.setFont('helvetica','bold'); doc.setTextColor(30,41,59)
      doc.text(`${(v * 100).toFixed(1)}%`, ML + TW, y + 3, { align:'right' })
      y += 5
      doc.setFillColor(241,245,249); doc.roundedRect(ML, y, bW, 2.5, 0.5, 0.5, 'F')
      if (w > 0.5) { doc.setFillColor(...clr); doc.roundedRect(ML, y, w, 2.5, 0.5, 0.5, 'F') }
      y += 7
    })
  }

  function ratioChips(chips) {
    y += 3; ck(16)
    const cW = (TW - 4) / 2
    chips.forEach(({ lbl, val, ck: colorKey }, i) => {
      const cx = ML + i * (cW + 4)
      const c  = RC[colorKey] || RC.gray
      doc.setFillColor(248,250,252); doc.setDrawColor(226,232,240)
      doc.roundedRect(cx, y, cW, 13, 1.5, 1.5, 'FD')
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(100,116,139)
      doc.text(lbl, cx + 3, y + 5)
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(30,41,59)
      doc.text(val, cx + cW - 6, y + 10.5)
      doc.setFillColor(...c); doc.roundedRect(cx + cW - 4, y + 5, 2.5, 2.5, 0.5, 0.5, 'F')
    })
    y += 17
  }

  function flowBars() {
    const fo = n(form.flujo_operativo), fi = n(form.flujo_inversion), ff = n(form.flujo_financiamiento)
    if (!fo && !fi && !ff) return
    y += 3
    const mx = Math.max(Math.abs(fo), Math.abs(fi), Math.abs(ff), 1)
    const bW = TW - 30
    ;[{ lbl:'Flujo operativo', v:fo }, { lbl:'Flujo de inversion', v:fi }, { lbl:'Flujo financiamiento', v:ff }]
      .forEach(({ lbl, v }) => {
        ck(10)
        const isP = v >= 0
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(100,116,139)
        doc.text(lbl, ML, y + 3)
        doc.setFont('helvetica','bold'); doc.setTextColor(isP ? 10 : 220, isP ? 138 : 38, isP ? 122 : 38)
        doc.text((isP ? '+' : '') + ars(v), ML + TW, y + 3, { align:'right' })
        y += 5
        doc.setFillColor(241,245,249); doc.roundedRect(ML, y, bW, 2.5, 0.5, 0.5, 'F')
        const w = (Math.abs(v) / mx) * bW
        if (w > 0.5) { doc.setFillColor(isP ? 10 : 220, isP ? 138 : 38, isP ? 122 : 38); doc.roundedRect(ML, y, w, 2.5, 0.5, 0.5, 'F') }
        y += 7
      })
  }

  function priorityCards(contenido) {
    const items = parsePrioridades(contenido)
    const COLORS = [[220,38,38], [217,119,6], [10,138,122]]
    items.forEach(({ num, text }, i) => {
      const lines  = doc.splitTextToSize(text, TW - 16)
      const cardH  = Math.max(14, lines.length * 3.8 + 8)
      ck(cardH + 4)
      doc.setFillColor(255,255,255); doc.setDrawColor(226,232,240)
      doc.roundedRect(ML, y, TW, cardH, 2, 2, 'FD')
      const bC = COLORS[i] || [100,116,139]
      doc.setFillColor(...bC)
      doc.roundedRect(ML + 3, y + (cardH - 6) / 2, 6, 6, 1, 1, 'F')
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(255,255,255)
      doc.text(String(num), ML + 4.7, y + (cardH - 6) / 2 + 4.5)
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(71,85,105)
      doc.text(lines, ML + 13, y + (cardH - 6) / 2 + 2 + (lines.length > 1 ? 0 : 1.5))
      y += cardH + 4
    })
  }

  // ── PORTADA ──────────────────────────────────────────────────────
  doc.setFillColor(13, 27, 62); doc.rect(0, 0, W, 297, 'F')
  doc.setFillColor(10, 138, 122); doc.rect(0, 0, 7, 297, 'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(28); doc.setTextColor(10,138,122)
  doc.text('CFOConnect', ML + 5, 55)
  doc.setFontSize(13); doc.setTextColor(255,255,255)
  doc.text('INFORME FINANCIERO INTEGRAL', ML + 5, 70)
  doc.setDrawColor(10,138,122); doc.setLineWidth(0.4); doc.line(ML + 5, 75, W - ML, 75)
  doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor(255,255,255)
  doc.text((nombreEmpresa || 'Empresa').slice(0, 42), ML + 5, 92)
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(148,163,184)
  doc.text(`Periodo: ${form.periodo || '—'}`, ML + 5, 106)
  if (form.fecha_cierre) {
    doc.text(`Fecha de cierre: ${form.fecha_cierre}`, ML + 5, 113)
    doc.text(`Generado el: ${fecha}`, ML + 5, 120)
  } else {
    doc.text(`Generado el: ${fecha}`, ML + 5, 113)
  }
  doc.setFontSize(7.5); doc.setTextColor(71,85,105)
  doc.text('CFOConnect — Asesoria Financiera Integral para PyMEs', ML + 5, 284)

  // ── SECCIONES ────────────────────────────────────────────────────
  doc.addPage(); y = 20
  // Fondo gris muy suave
  doc.setFillColor(248,250,252); doc.rect(0, 0, W, 297, 'F')

  parseSecciones(informeIA).forEach(({ id, contenido }) => {
    secHeader(id)
    if (id === 'prioridades') {
      priorityCards(contenido)
    } else {
      bodyTxt(contenido)
      if (id === 'resumen')       kpiBoxes()
      if (id === 'rentabilidad')  marginBars()
      if (id === 'flujo')         flowBars()
      if (id === 'liquidez' && ratios) {
        const lC = ratios.liquidez_corriente >= 1.5 ? 'green' : ratios.liquidez_corriente >= 1.0 ? 'amber' : 'red'
        const aC = ratios.liquidez_acida     >= 1.0 ? 'green' : ratios.liquidez_acida     >= 0.7 ? 'amber' : 'red'
        ratioChips([
          { lbl:'Liquidez corriente', val:`${ratios.liquidez_corriente?.toFixed(2)}x`, ck:lC },
          { lbl:'Liquidez acida',     val:`${ratios.liquidez_acida?.toFixed(2)}x`,     ck:aC },
        ])
      }
      if (id === 'endeudamiento' && ratios) {
        const lC = ratios.leverage      < 1.5 ? 'green' : ratios.leverage      < 3.0 ? 'amber' : 'red'
        const dC = ratios.deuda_ebitda > 0 && ratios.deuda_ebitda < 3 ? 'green' : ratios.deuda_ebitda < 5 ? 'amber' : 'red'
        ratioChips([
          { lbl:'Leverage D/E',   val:`${ratios.leverage?.toFixed(2)}x`,     ck:lC },
          { lbl:'Deuda / EBITDA', val:`${ratios.deuda_ebitda?.toFixed(2)}x`, ck:dC },
        ])
      }
    }
    y += 5
  })

  // ── TABLA DE RATIOS ──────────────────────────────────────────────
  doc.addPage(); y = 20
  doc.setFillColor(248,250,252); doc.rect(0, 0, W, 297, 'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(13,27,62)
  doc.text('INDICADORES FINANCIEROS', ML, y); y += 8

  const cW4 = [60, 30, 40, 35]
  const cX4 = cW4.reduce((a, w, i) => { a.push(i === 0 ? ML : a[i-1] + cW4[i-1]); return a }, [])
  const rH  = 7.5

  doc.setFillColor(13,27,62); doc.roundedRect(ML, y, TW, rH, 1, 1, 'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(255,255,255)
  ;['Indicador','Valor','Referencia','Estado'].forEach((h, i) => doc.text(h, cX4[i] + 2.5, y + 5))
  y += rH

  RATIOS_CONFIG.forEach((cfg, idx) => {
    const val = ratios?.[cfg.key]
    const ok  = val != null && isFinite(val) && val !== 0
    const col = ok ? cfg.color(val) : 'gray'
    ck(rH + 2)
    if (idx % 2 === 0) { doc.setFillColor(255,255,255) } else { doc.setFillColor(248,250,252) }
    doc.rect(ML, y, TW, rH, 'F')
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(30,41,59)
    doc.text(cfg.label, cX4[0] + 2.5, y + 5)
    doc.setFont('helvetica','bold')
    doc.text(ok ? cfg.fmt(val) : '—', cX4[1] + 2.5, y + 5)
    doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139)
    doc.text(cfg.bench, cX4[2] + 2.5, y + 5)
    // Estado badge (colored rect + text)
    const stateRGB = RC[col]
    const stateLabel = { green:'Bien', amber:'Precaucion', red:'Critico', gray:'—' }[col]
    doc.setFillColor(...stateRGB, 0.15)
    doc.roundedRect(cX4[3], y + 1.5, 30, rH - 3, 1, 1, 'F')
    doc.setFont('helvetica','bold'); doc.setTextColor(...stateRGB)
    doc.text(stateLabel, cX4[3] + 3, y + 5)
    doc.setDrawColor(226,232,240); doc.line(ML, y + rH, ML + TW, y + rH)
    y += rH
  })

  // ── GLOSARIO ──────────────────────────────────────────────────────
  doc.addPage(); y = 20
  doc.setFillColor(248,250,252); doc.rect(0, 0, W, 297, 'F')
  doc.setFillColor(10,138,122); doc.rect(ML, y, 3, 8, 'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(13,27,62)
  doc.text('GLOSARIO DE TERMINOS FINANCIEROS', ML + 7, y + 5.5)
  y += 14

  GLOSARIO.forEach(({ term, def }) => {
    doc.setFontSize(8.5)
    const dl = doc.splitTextToSize(def, TW)
    ck(6 + dl.length * 3.8 + 5)
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(13,27,62)
    doc.text(term + ':', ML, y); y += 4.5
    doc.setFont('helvetica','normal'); doc.setTextColor(71,85,105)
    doc.text(dl, ML, y); y += dl.length * 3.8 + 5
  })

  // ── FOOTER desde pág 2 ────────────────────────────────────────────
  const total = doc.getNumberOfPages ? doc.getNumberOfPages() : doc.internal.getNumberOfPages()
  for (let i = 2; i <= total; i++) {
    doc.setPage(i)
    doc.setFillColor(13,27,62); doc.rect(0, 289, W, 8, 'F')
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(148,163,184)
    doc.text('CFOConnect — Asesoria Financiera Integral para PyMEs', ML, 294)
    doc.text(`${fecha}  |  Pag ${i - 1} de ${total - 1}`, W - ML, 294, { align:'right' })
  }

  const nom = (nombreEmpresa || 'Empresa').replace(/[^\w\s]/g,'').trim().replace(/\s+/g,'-')
  const per = (form.periodo   || 'periodo').replace(/[^\w-]/g,'-')
  doc.save(`Informe-Integral-${nom}-${per}.pdf`)
}

function InformeEjecutivo({ form, ratios, nombreEmpresa, informeIA }) {
  if (!ratios) return null
  const parrafos = generarParrafos(form, ratios, nombreEmpresa)

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-navy-800">Informe ejecutivo</h3>
        <button
          onClick={() => {
            try {
              if (informeIA) generarPDFCompleto(informeIA, form, ratios, nombreEmpresa)
              else generarPDF(form, ratios, nombreEmpresa)
            } catch (e) { console.error('Error generando PDF:', e); alert('Error al generar el PDF: ' + e.message) }
          }}
          className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
        >
          <Download size={13} />
          {informeIA ? 'Descargar informe completo en PDF' : 'Descargar PDF'}
        </button>
      </div>
      <div className="space-y-3">
        {parrafos.map((p, i) => (
          <p key={i} className="text-sm text-slate-700 leading-relaxed">{p}</p>
        ))}
      </div>
    </div>
  )
}

// ── Helpers de display del informe ────────────────────────────────

function cleanText(txt) {
  return txt
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/\*(.*?)\*/gs, '$1')
    .replace(/(generado|preparado|redactado)\s+(por|con)\s+[^.]{0,60}\./gi, '')
    .replace(/\b(claude|anthropic)\b[^.]*\./gi, '')
    .trim()
}

function parseSecciones(texto) {
  const PATRONES = [
    { id: 'resumen',       re: /RESUMEN\s+EJECUTIVO/i              },
    { id: 'rentabilidad',  re: /AN[AÁ]LISIS\s+DE\s+RENTABILIDAD/i  },
    { id: 'liquidez',      re: /AN[AÁ]LISIS\s+DE\s+LIQUIDEZ/i      },
    { id: 'endeudamiento', re: /AN[AÁ]LISIS\s+DE\s+ENDEUDAMIENTO/i },
    { id: 'flujo',         re: /AN[AÁ]LISIS\s+DEL?\s+FLUJO/i       },
    { id: 'mercado',       re: /POSICI[OÓ]N\s+FRENTE/i             },
    { id: 'prioridades',   re: /PRIORIDADES\s+DE\s+ACCI[OÓ]N/i     },
  ]
  const encontrados = PATRONES.map(({ id, re }) => {
    const m = texto.match(re)
    return m ? { id, index: m.index, end: m.index + m[0].length } : null
  }).filter(Boolean).sort((a, b) => a.index - b.index)

  return encontrados.map(({ id, end }, i) => {
    const nextIdx = i < encontrados.length - 1 ? encontrados[i + 1].index : texto.length
    const raw = texto.slice(end, nextIdx).replace(/^:?\s*\n?/, '').trim()
    return { id, contenido: cleanText(raw) }
  })
}

function parsePrioridades(contenido) {
  const re = /(?:^|\n)\s*(\d)[.)]\s+(.+?)(?=\n\s*\d[.)]|\s*$)/gs
  const items = []
  let m
  while ((m = re.exec(contenido)) !== null) {
    items.push({ num: parseInt(m[1]), text: cleanText(m[2].trim()) })
    if (items.length === 3) break
  }
  if (items.length >= 2) return items

  return contenido.split(/\n{2,}/).filter(p => p.trim()).slice(0, 3).map((p, i) => ({
    num: i + 1, text: cleanText(p.trim()),
  }))
}

// Mini-visualizaciones por sección
function KpiMini({ label, value, sub, color }) {
  const C = { green:'border-brand-200 bg-brand-50 text-brand-700', amber:'border-amber-200 bg-amber-50 text-amber-700', red:'border-red-200 bg-red-50 text-red-700', gray:'border-slate-200 bg-slate-50 text-slate-600' }
  return (
    <div className={`rounded-xl border p-3 ${C[color] || C.gray}`}>
      <p className="text-xs opacity-75 mb-0.5">{label}</p>
      <p className="text-base font-bold leading-tight">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

function BarIndicator({ label, value, max, barColor }) {
  const w = Math.min(Math.max((value / max) * 100, 0), 100)
  const displayVal = value >= 0 ? `${(value * 100).toFixed(1)}%` : `${(value * 100).toFixed(1)}%`
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-semibold text-navy-800">{displayVal}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  )
}

function RatioChip({ label, value, colorKey }) {
  const C = { green:'bg-brand-50 text-brand-800 border-brand-100', amber:'bg-amber-50 text-amber-800 border-amber-100', red:'bg-red-50 text-red-800 border-red-100', gray:'bg-slate-50 text-slate-600 border-slate-100' }
  const dot = { green:'bg-brand-500', amber:'bg-amber-400', red:'bg-red-500', gray:'bg-slate-300' }
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg border ${C[colorKey] || C.gray}`}>
      <span className="text-xs">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold">{value}</span>
        <div className={`w-2 h-2 rounded-full ${dot[colorKey] || dot.gray}`} />
      </div>
    </div>
  )
}

function FlujoBar({ label, val }) {
  const isPos = val >= 0
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-600">{label}</span>
        <span className={`font-semibold ${isPos ? 'text-brand-700' : 'text-red-600'}`}>{isPos ? '+' : ''}{ars(val)}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full">
        <div className={`h-full rounded-full ${isPos ? 'bg-brand-500' : 'bg-red-400'}`} style={{ width: `${Math.min(Math.abs(val) / Math.max(Math.abs(val), 1) * 100, 100)}%` }} />
      </div>
    </div>
  )
}

function VisualResumen({ ratios, form }) {
  if (!ratios) return null
  const liqColor = ratios.liquidez_corriente >= 1.5 ? 'green' : ratios.liquidez_corriente >= 1.0 ? 'amber' : 'red'
  const ebColor  = ratios.margen_ebitda >= 0.15 ? 'green' : ratios.margen_ebitda >= 0.08 ? 'amber' : 'red'
  const levColor = ratios.leverage < 1.5 ? 'green' : ratios.leverage < 3.0 ? 'amber' : 'red'
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
      <KpiMini label="Ventas netas"    value={ars(n(form.ventas_netas))} sub={form.periodo} color="gray" />
      <KpiMini label="Margen EBITDA"   value={pct(ratios.margen_ebitda)}  sub="Sobre ventas"  color={ebColor} />
      <KpiMini label="Liquidez"        value={`${ratios.liquidez_corriente?.toFixed(2)}x`} sub="Corriente" color={liqColor} />
      <KpiMini label="Leverage"        value={`${ratios.leverage?.toFixed(2)}x`} sub="D/E"       color={levColor} />
    </div>
  )
}

function VisualRentabilidad({ ratios }) {
  if (!ratios) return null
  const barColor = v => v >= 0.15 ? 'bg-brand-500' : v >= 0.08 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Márgenes del período</p>
      <BarIndicator label="Margen bruto"  value={ratios.margen_bruto}  max={0.6}  barColor={barColor(ratios.margen_bruto)}  />
      <BarIndicator label="Margen EBITDA" value={ratios.margen_ebitda} max={0.35} barColor={barColor(ratios.margen_ebitda)} />
      <BarIndicator label="Margen neto"   value={ratios.margen_neto}   max={0.25} barColor={barColor(ratios.margen_neto)}   />
    </div>
  )
}

function VisualLiquidez({ ratios }) {
  if (!ratios) return null
  const lColor = v => v >= 1.5 ? 'green' : v >= 1.0 ? 'amber' : 'red'
  const aColor = v => v >= 1.0 ? 'green' : v >= 0.7 ? 'amber' : 'red'
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <RatioChip label="Liquidez corriente" value={`${ratios.liquidez_corriente?.toFixed(2)}x`} colorKey={lColor(ratios.liquidez_corriente)} />
      <RatioChip label="Liquidez ácida"     value={`${ratios.liquidez_acida?.toFixed(2)}x`}     colorKey={aColor(ratios.liquidez_acida)} />
    </div>
  )
}

function VisualEndeudamiento({ ratios }) {
  if (!ratios) return null
  const lColor = ratios.leverage < 1.5 ? 'green' : ratios.leverage < 3.0 ? 'amber' : 'red'
  const dColor = ratios.deuda_ebitda > 0 && ratios.deuda_ebitda < 3 ? 'green' : ratios.deuda_ebitda < 5 ? 'amber' : 'red'
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <RatioChip label="Leverage (D/E)"  value={`${ratios.leverage?.toFixed(2)}x`}     colorKey={lColor} />
      <RatioChip label="Deuda / EBITDA"  value={`${ratios.deuda_ebitda?.toFixed(2)}x`} colorKey={dColor} />
    </div>
  )
}

function VisualFlujo({ form }) {
  const fo = n(form.flujo_operativo), fi = n(form.flujo_inversion), ff = n(form.flujo_financiamiento)
  if (!fo && !fi && !ff) return null
  const maxAbs = Math.max(Math.abs(fo), Math.abs(fi), Math.abs(ff), 1)
  const flows = [{ label:'Operativo', val:fo }, { label:'Inversión', val:fi }, { label:'Financiamiento', val:ff }]
  return (
    <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Flujo del período</p>
      {flows.map(({ label, val }) => {
        const isPos = val >= 0
        return (
          <div key={label} className="mb-2 last:mb-0">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600">{label}</span>
              <span className={`font-semibold ${isPos ? 'text-brand-700' : 'text-red-600'}`}>{isPos ? '+' : ''}{ars(val)}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${isPos ? 'bg-brand-500' : 'bg-red-400'}`} style={{ width: `${(Math.abs(val) / maxAbs) * 100}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

const SECCION_META = {
  resumen:       { icon: TrendingUp,    label: 'Resumen Ejecutivo',          bgIcon:'bg-brand-50',  textIcon:'text-brand-600',  accent:'border-l-4 border-brand-400'  },
  rentabilidad:  { icon: BarChart3,     label: 'Análisis de Rentabilidad',   bgIcon:'bg-blue-50',   textIcon:'text-blue-600',   accent:'border-l-4 border-blue-400'   },
  liquidez:      { icon: Shield,        label: 'Liquidez y Solvencia',       bgIcon:'bg-sky-50',    textIcon:'text-sky-600',    accent:'border-l-4 border-sky-400'    },
  endeudamiento: { icon: AlertTriangle, label: 'Análisis de Endeudamiento',  bgIcon:'bg-amber-50',  textIcon:'text-amber-600',  accent:'border-l-4 border-amber-400'  },
  flujo:         { icon: Wallet,        label: 'Flujo de Fondos',            bgIcon:'bg-violet-50', textIcon:'text-violet-600', accent:'border-l-4 border-violet-400' },
  mercado:       { icon: Building2,     label: 'Mercado de Capitales',       bgIcon:'bg-slate-100', textIcon:'text-slate-600',  accent:'border-l-4 border-slate-400'  },
  prioridades:   { icon: Target,        label: 'Prioridades de Acción',      bgIcon:'bg-red-50',    textIcon:'text-red-600',    accent:'border-l-4 border-red-400'    },
}

// ── Informe Financiero Integral ────────────────────────────────────
function InformeIntegral({ form, ratios, nombreEmpresa, informeIA, setInformeIA, generandoIA, setGenerandoIA, errorIA, setErrorIA }) {
  async function handleGenerar() {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) { setErrorIA('VITE_ANTHROPIC_API_KEY no está definida en .env.local'); return }
    setGenerandoIA(true); setErrorIA(null); setInformeIA('')
    try {
      const resp = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          system: SYSTEM_INFORME,
          messages: [{ role: 'user', content: buildPromptInforme(form, ratios, nombreEmpresa) }],
        }),
      })
      if (!resp.ok) {
        const t = await resp.text().catch(() => '')
        throw new Error(`HTTP ${resp.status}: ${t.slice(0, 120)}`)
      }
      const data = await resp.json()
      setInformeIA(data.content?.[0]?.text?.trim() || '')
    } catch (e) {
      console.error('[InformeIntegral]', e)
      setErrorIA(e.message)
    } finally {
      setGenerandoIA(false)
    }
  }

  const secciones = informeIA ? parseSecciones(informeIA) : []

  function renderContenido(id, contenido) {
    if (id === 'prioridades') {
      const items = parsePrioridades(contenido)
      const COLORS = ['bg-red-600', 'bg-amber-500', 'bg-brand-600']
      return (
        <div className="space-y-3 mt-3">
          {items.map(({ num, text }) => (
            <div key={num} className="flex items-start gap-3 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <div className={`w-7 h-7 rounded-full ${COLORS[num-1] || 'bg-slate-400'} text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5`}>
                {num}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      )
    }
    return (
      <div className="space-y-2.5 mt-3">
        {contenido.split(/\n{2,}/).filter(p => p.trim()).map((p, i) => (
          <p key={i} className="text-sm text-slate-700 leading-relaxed">{p.trim()}</p>
        ))}
      </div>
    )
  }

  const vizMap = {
    resumen:       <VisualResumen       ratios={ratios} form={form} />,
    rentabilidad:  <VisualRentabilidad  ratios={ratios} />,
    liquidez:      <VisualLiquidez      ratios={ratios} />,
    endeudamiento: <VisualEndeudamiento ratios={ratios} />,
    flujo:         <VisualFlujo         form={form} />,
  }

  return (
    <div className="card overflow-hidden">
      {/* Header de la card */}
      <div className="flex items-center justify-between p-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
            <FileText size={17} className="text-brand-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-navy-800">Informe Financiero Integral</h3>
            <p className="text-xs text-slate-400">Análisis ejecutivo para la toma de decisiones</p>
          </div>
        </div>
        <button
          onClick={handleGenerar}
          disabled={generandoIA}
          className="btn-primary flex items-center gap-2 disabled:opacity-60"
        >
          {generandoIA ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Preparando informe...
            </>
          ) : (
            <><Sparkles size={15} />{informeIA ? 'Actualizar informe' : 'Preparar informe ejecutivo'}</>
          )}
        </button>
      </div>

      {/* Placeholder vacío */}
      {!informeIA && !generandoIA && !errorIA && (
        <div className="px-5 py-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3">
            <FileText size={20} className="text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">Informe ejecutivo disponible</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Incluye análisis de rentabilidad, liquidez, endeudamiento, flujo de fondos, oportunidades de mercado de capitales y 3 prioridades de acción con plazos.
          </p>
        </div>
      )}

      {/* Error */}
      {errorIA && (
        <div className="mx-5 my-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{errorIA}</p>
        </div>
      )}

      {/* Informe generado */}
      {informeIA && secciones.length > 0 && (
        <div>
          {/* Encabezado del informe */}
          <div className="px-6 py-5 bg-gradient-to-r from-navy-800 to-navy-800/90">
            <p className="text-xs font-semibold text-brand-300 uppercase tracking-widest mb-1">CFOConnect</p>
            <h2 className="text-lg font-bold text-white">Informe Financiero Integral</h2>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-sm text-slate-300">{nombreEmpresa}</span>
              {form.periodo && (
                <><span className="text-slate-600">·</span><span className="text-sm text-slate-300">Período {form.periodo}</span></>
              )}
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400">{new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' })}</span>
            </div>
          </div>

          {/* Secciones */}
          <div className="divide-y divide-slate-100">
            {secciones.map(({ id, contenido }) => {
              const meta = SECCION_META[id] || SECCION_META.mercado
              const Icon = meta.icon
              return (
                <div key={id} className={`px-6 py-5 ${meta.accent} pl-5`}>
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className={`w-6 h-6 rounded-lg ${meta.bgIcon} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={13} className={meta.textIcon} />
                    </div>
                    <h4 className="text-xs font-bold text-navy-700 uppercase tracking-wider">{meta.label}</h4>
                  </div>
                  {renderContenido(id, contenido)}
                  {vizMap[id] && <div className="mt-1">{vizMap[id]}</div>}
                </div>
              )
            })}
          </div>

          {/* Footer del informe */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">CFOConnect · Asesoría Financiera Integral para PyMEs</p>
            <button
              onClick={() => {
                try { generarPDFCompleto(informeIA, form, ratios, nombreEmpresa) }
                catch (e) { console.error(e); alert('Error al generar PDF: ' + e.message) }
              }}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Download size={14} />
              Descargar PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal nueva empresa ────────────────────────────────────────────
const RUBRОС = [
  'Agroindustria', 'Construcción', 'Comercio minorista', 'Comercio mayorista',
  'Manufactura', 'Servicios profesionales', 'Gastronomía', 'Transporte y logística',
  'Tecnología', 'Salud', 'Educación', 'Otro',
]

const PLANES = [
  { v: 'diagnostico',  l: 'Diagnóstico' },
  { v: 'cfo_basico',   l: 'CFO Básico' },
  { v: 'cfo_medio',    l: 'CFO Medio' },
  { v: 'cfo_full',     l: 'CFO Full' },
]

function ModalNuevaEmpresa({ onCreada, onCerrar, asesorNombre }) {
  const VACIO = {
    nombre: '', cuit: '', rubro: '', localidad: '',
    provincia: 'Salta', plan_servicio: 'diagnostico',
  }
  const [datos, setDatos] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState(null)

  function campo(k, v) { setDatos(prev => ({ ...prev, [k]: v })) }

  async function handleCrear() {
    if (!datos.nombre.trim()) { setErr('El nombre de la empresa es obligatorio.'); return }
    setGuardando(true)
    setErr(null)
    const { data, error } = await supabase
      .from('empresas')
      .insert({
        nombre:        datos.nombre.trim(),
        cuit:          datos.cuit.trim() || null,
        rubro:         datos.rubro || null,
        localidad:     datos.localidad.trim() || null,
        provincia:     datos.provincia,
        plan_servicio: datos.plan_servicio,
        etapa_numero:  1,
        asesor_nombre: asesorNombre || null,
        activa:        true,
      })
      .select()
      .single()
    setGuardando(false)
    if (error) { setErr('No se pudo crear la empresa. Revisá los datos.'); return }
    onCreada(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-navy-800/40 backdrop-blur-sm" onClick={onCerrar} />

      {/* Card */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-navy-800">Nueva empresa</h2>
          <button
            onClick={onCerrar}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="label">Nombre de la empresa <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={datos.nombre}
              onChange={e => campo('nombre', e.target.value)}
              placeholder="Ej: Molinos del NOA SA"
              className="input"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">CUIT</label>
              <input
                type="text"
                value={datos.cuit}
                onChange={e => campo('cuit', e.target.value)}
                placeholder="30-00000000-0"
                className="input"
              />
            </div>
            <div>
              <label className="label">Rubro</label>
              <select value={datos.rubro} onChange={e => campo('rubro', e.target.value)} className="input">
                <option value="">Seleccioná...</option>
                {RUBRОС.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Localidad</label>
              <input
                type="text"
                value={datos.localidad}
                onChange={e => campo('localidad', e.target.value)}
                placeholder="Ej: Salta capital"
                className="input"
              />
            </div>
            <div>
              <label className="label">Provincia</label>
              <input
                type="text"
                value={datos.provincia}
                onChange={e => campo('provincia', e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Plan de servicio</label>
            <select value={datos.plan_servicio} onChange={e => campo('plan_servicio', e.target.value)} className="input">
              {PLANES.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
          </div>

          {err && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{err}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button onClick={onCerrar} className="btn-secondary text-sm">
            Cancelar
          </button>
          <button
            onClick={handleCrear}
            disabled={guardando}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60"
          >
            <Plus size={14} />
            {guardando ? 'Creando...' : 'Crear empresa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Balance subido por el cliente — visible para el asesor ─────────
function BalanceClienteCard({ empresaId }) {
  const [url,     setUrl]     = useState(null)
  const [subido,  setSubido]  = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!empresaId) return
    setUrl(null); setSubido(false); setLoading(true)
    // Verificar si existe el archivo
    const adminClient = supabaseAdmin || supabase
    adminClient.storage
      .from('balances-cliente')
      .list(empresaId)
      .then(({ data }) => {
        const existe = (data || []).some(f => f.name === 'balance.pdf')
        setSubido(existe)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [empresaId])

  async function descargar() {
    const adminClient = supabaseAdmin || supabase
    const { data } = await adminClient.storage
      .from('balances-cliente')
      .createSignedUrl(`${empresaId}/balance.pdf`, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (loading || !subido) return null

  return (
    <div className="card p-4 flex items-center justify-between border-l-4 border-l-brand-400">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
          <CheckCircle size={16} className="text-brand-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-navy-800">El cliente subió su balance</p>
          <p className="text-xs text-slate-400">Podés descargarlo para analizarlo</p>
        </div>
      </div>
      <button onClick={descargar} className="btn-primary flex items-center gap-2 text-sm flex-shrink-0">
        <Download size={14} /> Descargar balance del cliente
      </button>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────
export default function BalancePage() {
  const { profile, empresaActiva, setEmpresaActiva } = useAuth()

  // empresaId derivado del contexto global — no hay estado local
  const empresaId   = empresaActiva?.id   || ''
  const empresaNombreCtx = empresaActiva?.nombre || ''
  const [periodos, setPeriodos]         = useState([])
  const [periodoSel, setPeriodoSel]     = useState('nuevo')
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [savedRow, setSavedRow]         = useState(null)
  const [tab, setTab]                   = useState('patrimonio')
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [error, setError]               = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [leyendoPDF, setLeyendoPDF]     = useState(false)
  const [mensajePDF, setMensajePDF]     = useState(null)
  const archivoRef                      = useRef(null)
  const [informeIA, setInformeIA]       = useState('')
  const [generandoIA, setGenerandoIA]   = useState(false)
  const [errorIA, setErrorIA]           = useState(null)
  // Nuevos estados para extracción extendida
  const [datosExtraidos, setDatosExtraidos] = useState(null)  // JSON completo extraído del PDF
  const [tabAnalisis,   setTabAnalisis]     = useState('ratios')
  const [syncAlmaOk,    setSyncAlmaOk]      = useState(false) // badge "Alma actualizada"
  const [alertasGen,    setAlertasGen]      = useState([])    // alertas generadas

  // Único useEffect limpio — resetea y carga al cambiar empresa
  useEffect(() => {
    setPeriodos([])
    setSavedRow(null)
    setForm(EMPTY_FORM)
    setPeriodoSel('nuevo')
    setInformeIA('')
    setDatosExtraidos(null)
    setSyncAlmaOk(false)
    setAlertasGen([])
    setSaved(false)
    setError(null)

    if (!empresaActiva?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    supabase
      .from('periodos_financieros')
      .select('*')
      .eq('empresa_id', empresaActiva.id)
      .order('periodo', { ascending: false })
      .then(({ data }) => {
        setPeriodos(data || [])
        if (data?.length) {
          setPeriodoSel(data[0].periodo)
          setForm(formFromPeriodo(data[0]))
          setSavedRow(data[0])
        }
      })
      .finally(() => setLoading(false))
  }, [empresaActiva?.id])

  // Cargar datos cuando cambia el período seleccionado
  useEffect(() => {
    if (periodoSel === 'nuevo') {
      setForm(EMPTY_FORM)
      setSavedRow(null)
      return
    }
    const row = periodos.find(p => p.periodo === periodoSel)
    if (row) { setForm(formFromPeriodo(row)); setSavedRow(row) }
  }, [periodoSel, periodos])

  function set(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }))
    setSaved(false)
  }

  async function handleArchivoPDF(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    if (archivoRef.current) archivoRef.current.value = ''

    if (archivo.type !== 'application/pdf') {
      setMensajePDF({ tipo: 'error', texto: 'Solo se admiten archivos PDF.' })
      return
    }

    setLeyendoPDF(true)
    setMensajePDF(null)

    try {
      console.log('[Balance] Iniciando lectura del PDF...', archivo.name, `empresa_id: ${empresaId}`)
      // Convertir a base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(archivo)
      })

      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
      console.log('[BalancePage] VITE_ANTHROPIC_API_KEY:', apiKey)
      if (!apiKey) {
        throw new Error('VITE_ANTHROPIC_API_KEY no está definida en .env.local — reiniciá el servidor después de agregarla.')
      }

      const resp = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'pdfs-2024-09-25',
          'anthropic-dangerous-direct-browser-access': 'true',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: { type: 'base64', media_type: 'application/pdf', data: base64 },
                },
                {
                  type: 'text',
                  text: 'Extraé todos los valores del balance adjunto y devolvé el JSON.',
                },
              ],
            },
          ],
        }),
      })

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '')
        console.error('[BalancePage] API error', resp.status, errText)
        let errMsg = `HTTP ${resp.status}`
        try {
          const errJson = JSON.parse(errText)
          errMsg += ': ' + (errJson?.error?.message ?? errText)
        } catch {
          errMsg += errText ? ': ' + errText.slice(0, 120) : ''
        }
        throw new Error(errMsg)
      }

      const payload  = await resp.json()
      const textoRaw = payload.content?.[0]?.text?.trim() || ''
      console.log('[BalancePage] respuesta IA (primeros 300 chars):', textoRaw.slice(0, 300))

      // Limpiar markdown
      const texto = textoRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const json  = JSON.parse(texto)

      // Fuente de datos financieros: nuevo formato anidado o fallback plano
      const financialActual = json.estados_financieros?.actual || json

      // Llenar el formulario con los datos del año actual
      setForm(prev => {
        const siguiente = { ...prev }
        for (const [claveIA, campForm] of Object.entries(MAPA_IA)) {
          const val = financialActual[claveIA]
          if (val != null && val !== 0) siguiente[campForm] = String(val)
        }
        // Pre-completar fecha de cierre desde datos societarios
        const fc = json.datos_societarios?.fecha_cierre_ejercicio
        if (fc) {
          const p = fc.split('/')
          if (p.length === 3) siguiente.fecha_cierre = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`
        }
        return siguiente
      })

      // Guardar extracción completa en estado para sync posterior
      setDatosExtraidos(json)
      setSaved(false)
      setSyncAlmaOk(false)

      // Sincronizar datos societarios en segundo plano
      if (json.datos_societarios && empresaId) {
        syncDatosSocietarios(json.datos_societarios, empresaId).catch(e =>
          console.warn('[BalancePage] syncDatosSocietarios error:', e)
        )
      }

      // Guardar última extracción en localStorage
      localStorage.setItem(`balance_extraccion_${empresaId}`, JSON.stringify({ fecha: new Date().toISOString(), campos: Object.keys(financialActual).length }))

      setMensajePDF({
        tipo: 'ok',
        texto: `Balance leído correctamente — ${json.datos_societarios?.razon_social ? `"${json.datos_societarios.razon_social}" · ` : ''}revisá los datos antes de guardar.`,
      })
    } catch (err) {
      console.log('[Balance] Error:', err)
      console.error('[Balance] Stack:', err.stack)
      setMensajePDF({
        tipo: 'error',
        texto: `No se pudo leer el PDF automáticamente — completá los campos manualmente. (${err.message})`,
      })
    } finally {
      setLeyendoPDF(false)
    }
  }

  // ── Sync datos societarios → empresas + diagnostico_profundo d1 ──
  async function syncDatosSocietarios(datos, empId) {
    if (!empId || !datos) return

    // Actualizar empresas (solo campos vacíos)
    const { data: emp } = await supabase.from('empresas').select('cuit,rubro').eq('id', empId).maybeSingle()
    const empUpd = {}
    if (!emp?.cuit && datos.cuit) empUpd.cuit = datos.cuit
    if (!emp?.rubro && datos.actividad_principal) empUpd.rubro = datos.actividad_principal.slice(0, 100)
    if (Object.keys(empUpd).length > 0) await supabase.from('empresas').update(empUpd).eq('id', empId)

    // Actualizar diagnostico_profundo d1 (solo campos vacíos)
    const { data: dp } = await supabase.from('diagnostico_profundo').select('dimension1').eq('empresa_id', empId).maybeSingle()
    const d1 = dp?.dimension1 || {}
    const d1n = {}
    if (!d1.cuit && datos.cuit) d1n.cuit = datos.cuit
    if (!d1.forma_juridica && datos.forma_juridica) d1n.forma_juridica = datos.forma_juridica
    if (!d1.industria && datos.actividad_principal) d1n.industria = datos.actividad_principal
    if (!d1.nombre_contador) d1n.nombre_contador = datos.nombre_contador || ''
    if (!d1.matricula_contador) d1n.matricula_contador = datos.matricula_contador || ''
    if (!d1.capital_social && datos.capital_social) d1n.capital_social = datos.capital_social

    if (Object.keys(d1n).length > 0) {
      const campos = [...new Set([...(d1._campos_desde_balance || []), ...Object.keys(d1n)])]
      await supabase.from('diagnostico_profundo').upsert({
        empresa_id: empId,
        dimension1: { ...d1, ...d1n, _campos_desde_balance: campos },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'empresa_id' })
    }
  }

  // ── Sync notas del balance → diagnostico_profundo d3/d4 ──
  async function syncNotasBalance(notas, row, empId) {
    if (!empId || !notas) return
    const { data: dp } = await supabase.from('diagnostico_profundo')
      .select('dimension3, dimension4').eq('empresa_id', empId).maybeSingle()
    const d3 = dp?.dimension3 || {}
    const d4 = dp?.dimension4 || {}

    const bancosNota = notas.bancos_y_caja || {}
    const prestNota  = notas.prestamos     || {}
    const fiscNota   = notas.deudas_fiscales || {}
    const bienesNota = notas.bienes_de_uso  || {}

    const d3n = {
      ...(d3.costos_dolarizados == null && (notas.bancos_y_caja?.tiene_caja_dolares || bienesNota.tiene_maquinaria)
        ? { costos_dolarizados: !!notas.bancos_y_caja?.tiene_caja_dolares } : {}),
    }

    const d4n = {
      ...(d4.bancos == null || d4.bancos === '' ? { bancos: (bancosNota.lista_bancos || []).join(', ') } : {}),
      ...(!d4.usa_descubierto && prestNota.tiene_descubierto ? { usa_descubierto: true } : {}),
      ...(d4.deuda_afip == null ? { deuda_afip: fiscNota.tiene_iva || fiscNota.tiene_ganancias || fiscNota.tiene_iibb || false } : {}),
      ...(d4.inmuebles_propios == null ? { inmuebles_propios: bienesNota.tiene_inmuebles || false } : {}),
      ...(d4.valor_inmuebles == null || d4.valor_inmuebles === '' ? { valor_inmuebles: String(bienesNota.valor_total_neto || '') } : {}),
      ...(d4.maquinaria_relevante == null ? { maquinaria_relevante: bienesNota.tiene_maquinaria || false } : {}),
      ...(!d4.manejo_excedente?.includes('FCI') && bancosNota.tiene_fci
        ? { manejo_excedente: [...(d4.manejo_excedente || []), 'FCI'] } : {}),
    }

    const camposd3 = [...new Set([...(d3._campos_desde_balance || []), ...Object.keys(d3n)])]
    const camposd4 = [...new Set([...(d4._campos_desde_balance || []), ...Object.keys(d4n)])]
    const hasNew   = Object.keys(d3n).length > 0 || Object.keys(d4n).length > 0
    if (!hasNew) return

    await supabase.from('diagnostico_profundo').upsert({
      empresa_id: empId,
      dimension3: { ...d3, ...d3n, _campos_desde_balance: camposd3 },
      dimension4: { ...d4, ...d4n, _campos_desde_balance: camposd4 },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'empresa_id' })
  }

  // ── Generar alertas automáticas desde el balance ──
  async function generarAlertasBalance(row, ratios, empId) {
    if (!empId || !ratios || !row) return
    const notasRow  = (() => { try { return JSON.parse(row.notas || '{}') } catch { return {} } })()
    const vn        = n(row.ventas_netas)
    const resOp     = vn - n(row.costo_ventas) - n(row.gastos_comerciales) - n(row.gastos_admin) - n(row.gastos_personal)
    const intereses = Math.abs(n(row.resultado_financiero))
    const nuevas    = []

    if (intereses > 0 && resOp > 0 && resOp / intereses < 2.0)
      nuevas.push({ tipo:'deuda', nivel:'critico', mensaje:'El costo financiero consume más del 50% del resultado operativo. Hay una oportunidad de refinanciar a menor tasa en el mercado de capitales.' })

    if (ratios.liquidez_corriente > 0 && ratios.liquidez_corriente < 1.0)
      nuevas.push({ tipo:'liquidez', nivel:'critico', mensaje:'La empresa no puede cubrir sus deudas de corto plazo con el activo corriente. Revisar el capital de trabajo urgente.' })

    if (vn > 0 && intereses / vn > 0.05)
      nuevas.push({ tipo:'deuda', nivel:'alto', mensaje:'El costo financiero representa más del 5% de las ventas. Evaluar refinanciamiento con instrumentos del mercado de capitales.' })

    if (n(notasRow.caja_dolares) > 0)
      nuevas.push({ tipo:'oportunidad', nivel:'alto', mensaje:'Se detectó exposición en moneda extranjera. Consultar opciones de cobertura cambiaria con tu ALYC.' })

    if (ratios.margen_bruto > 0.40)
      nuevas.push({ tipo:'oportunidad', nivel:'info', mensaje:`Margen bruto del ${(ratios.margen_bruto * 100).toFixed(1)}% — excelente para el sector. Potencial para emitir instrumentos de deuda en el mercado de capitales.` })

    if (nuevas.length === 0) return

    // Borrar alertas automáticas anteriores de este balance
    await supabase.from('alertas').delete().eq('empresa_id', empId).ilike('mensaje', '%mercado de capitales%')

    try {
      await supabase.from('alertas').insert(
        nuevas.map(a => ({ ...a, empresa_id: empId, leida: false, origen: 'balance_automatico' }))
      )
    } catch {
      // Si columna origen no existe, insertar sin ella
      await supabase.from('alertas').insert(
        nuevas.map(a => ({ tipo: a.tipo, nivel: a.nivel, mensaje: a.mensaje, empresa_id: empId, leida: false }))
      )
    }
    setAlertasGen(nuevas)
  }

  // ── Calcular preguntas sugeridas para el asesor ──
  function calcPreguntasSugeridas(row, datosEx) {
    const notas = datosEx?.notas || {}
    const vn    = n(row?.ventas_netas)
    const lista = []
    if (n(row?.deuda_total) > 0)
      lista.push({ texto:'¿A qué tasa TNA son los préstamos bancarios actuales?', contexto:'finanzas' })
    if (n(row?.activo_corriente) > 0)
      lista.push({ texto:'¿A cuántos días cobra realmente a sus clientes en la práctica?', contexto:'cobranzas' })
    if (notas.bienes_de_uso?.tiene_inmuebles)
      lista.push({ texto:'¿Los inmuebles están escriturados a nombre de la empresa?', contexto:'garantias' })
    if (notas.deudas_fiscales?.tiene_iva || notas.deudas_fiscales?.tiene_ganancias)
      lista.push({ texto:'¿La deuda fiscal está en plan de pagos o está corriente al día?', contexto:'fiscal' })
    if (notas.bancos_y_caja?.tiene_caja_dolares)
      lista.push({ texto:'¿La empresa tiene costos o ingresos dolarizados?', contexto:'cambiario' })
    if (vn > 0 && n(row?.gastos_admin) / vn > 0.20)
      lista.push({ texto:'¿Cuál es el principal gasto administrativo? ¿Se puede optimizar?', contexto:'costos' })
    if (notas.bancos_y_caja?.lista_bancos?.length > 0)
      lista.push({ texto:`¿Opera con ${notas.bancos_y_caja.lista_bancos.slice(0,2).join(' y ')}? ¿Tiene carpeta actualizada en esos bancos?`, contexto:'bancario' })
    return lista
  }

  // ── Sincronizar balance → Alma de la empresa (corre en background) ──
  async function syncBalanceToAlma(row, empId) {
    if (!empId || !row) return

    // Leer el registro existente — nunca pisar campos ya completados
    const { data: existing } = await supabase
      .from('diagnostico_profundo')
      .select('dimension3, dimension4')
      .eq('empresa_id', empId)
      .maybeSingle()

    const d3actual = existing?.dimension3 || {}
    const d4actual = existing?.dimension4 || {}

    // ── Inferencias d3 ──────────────────────────────────────────────
    const notas    = (() => { try { return JSON.parse(row.notas || '{}') } catch { return {} } })()
    const cv       = n(row.costo_ventas)
    const gp       = n(row.gastos_personal)
    const ga       = n(row.gastos_admin)
    const rf       = Math.abs(n(row.resultado_financiero))
    const rubros   = { 'Mercadería / materiales': cv, 'Mano de obra': gp, 'Administración': ga, 'Financiero': rf }
    const principal = Object.entries(rubros).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    const vn       = n(row.ventas_netas)
    const pctFijos = vn > 0 ? Math.round(((ga + gp) / vn) * 100) : 0

    const d3nuevo = {
      ...(d3actual.dias_pago_proveedores == null || d3actual.dias_pago_proveedores === ''
        ? { dias_pago_proveedores: String(row.dias_pago || '') } : {}),
      ...(d3actual.tiene_stock == null
        ? { tiene_stock: n(row.stock) > 0 } : {}),
      ...(d3actual.principal_costo == null || d3actual.principal_costo === ''
        ? { principal_costo: principal } : {}),
      ...(d3actual.pct_fijos == null || d3actual.pct_fijos === ''
        ? { pct_fijos: String(pctFijos) } : {}),
    }

    // ── Inferencias d4 ──────────────────────────────────────────────
    const deudaFin   = n(notas.deudas_financieras_cte) + n(notas.deudas_lp)
    const cajaB      = n(notas.caja_bancos)
    const gastosMes  = vn > 0 ? (cv + gp + ga) / 12 : 0
    const diasCaja   = gastosMes > 0 ? Math.round((cajaB / gastosMes) * 30) : 0

    const d4nuevo = {
      ...(d4actual.deuda_financiera == null
        ? { deuda_financiera: deudaFin > 0 } : {}),
      ...(d4actual.monto_deuda == null || d4actual.monto_deuda === ''
        ? { monto_deuda: String(deudaFin || '') } : {}),
      ...(d4actual.maquinaria_relevante == null
        ? { maquinaria_relevante: n(notas.bienes_uso) > 0 } : {}),
      ...(d4actual.valor_maquinaria == null || d4actual.valor_maquinaria === ''
        ? { valor_maquinaria: String(notas.bienes_uso || '') } : {}),
      ...(d4actual.dias_cobertura_caja == null || d4actual.dias_cobertura_caja === ''
        ? { dias_cobertura_caja: String(diasCaja || '') } : {}),
    }

    // ── Estimaciones adicionales (Part 6) ───────────────────────────
    const SALARIO_REF = 2_500_000 // salario mensual promedio de referencia
    const empFormalesEst = vn > 0 && gp > 0 ? Math.round(gp / (SALARIO_REF * 13)) : 0

    const d3ext = {
      ...(d3actual.empleados_formales == null || d3actual.empleados_formales === ''
        ? { empleados_formales: String(empFormalesEst || '') } : {}),
      ...(d3actual.dias_rotacion == null || d3actual.dias_rotacion === ''
        ? { dias_rotacion: String(row.dias_stock || '') } : {}),
    }

    const manejo_actual = d4actual.manejo_excedente || []
    const tiene_inv = n(notas.inversiones_corrientes) > 0
    const d4ext = {
      ...(!manejo_actual.includes('FCI') && tiene_inv
        ? { manejo_excedente: [...manejo_actual, 'FCI'] } : {}),
    }

    const d3final = { ...d3actual, ...d3nuevo, ...d3ext }
    const d4final = { ...d4actual, ...d4nuevo, ...d4ext }

    if (Object.keys(d3nuevo).length === 0 && Object.keys(d4nuevo).length === 0 &&
        Object.keys(d3ext).length === 0  && Object.keys(d4ext).length === 0) return

    await supabase.from('diagnostico_profundo').upsert({
      empresa_id:  empId,
      dimension3:  d3final,
      dimension4:  d4final,
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'empresa_id' })
  }

  async function handleGuardar() {
    if (!form.periodo.trim()) { setError('Ingresá el nombre del período (ej: "2024")'); return }
    setSaving(true)
    setError(null)
    const payload = buildPayload(form, empresaId)
    const { data, error: err } = await supabase
      .from('periodos_financieros')
      .upsert(payload, { onConflict: 'empresa_id,periodo' })
      .select()
      .single()
    if (err) {
      setError('No se pudo guardar. Verificá los datos e intentá de nuevo.')
      setSaving(false)
      return
    }
    setSavedRow(data)
    setSaved(true)
    setSaving(false)
    setInformeIA('')
    setErrorIA(null)
    // Marcar balance como recibido → avanza etapa del cliente
    if (empresaId) {
      supabase.from('empresas')
        .update({ balance_subido_por_cliente: true, etapa_diagnostico: 2 })
        .eq('id', empresaId)
        .catch(e => console.warn('[BalancePage] etapa update:', e))
    }
    // Refrescar lista de períodos
    const { data: todos } = await supabase
      .from('periodos_financieros')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('periodo', { ascending: false })
    setPeriodos(todos || [])
    setPeriodoSel(form.periodo)
    // Sync al alma de la empresa (en background)
    syncBalanceToAlma(data, empresaId).then(() => setSyncAlmaOk(true)).catch(e =>
      console.warn('[BalancePage] syncBalanceToAlma error:', e)
    )
    // Sync notas del PDF si se extrajeron
    if (datosExtraidos?.notas) {
      syncNotasBalance(datosExtraidos.notas, data, empresaId).catch(e =>
        console.warn('[BalancePage] syncNotasBalance error:', e)
      )
    }
    // Generar alertas automáticas
    const ratiosParaAlertas = calcRatios(data)
    generarAlertasBalance(data, ratiosParaAlertas, empresaId).catch(e =>
      console.warn('[BalancePage] generarAlertasBalance error:', e)
    )
  }

  async function handleEmpresaCreada(nueva) {
    setEmpresaActiva({ id: nueva.id, nombre: nueva.nombre, rubro: nueva.rubro, etapa_numero: nueva.etapa_numero })
    setPeriodoSel('nuevo')
    setForm(EMPTY_FORM)
    setSavedRow(null)
    setModalAbierto(false)
  }

  const ratios       = useMemo(() => calcRatios(savedRow), [savedRow])
  const empresaNombre = empresaNombreCtx

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-slate-400">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="Análisis de balance"
        subtitle="Carga y análisis de estados contables certificados"
        actions={
          <span className="badge badge-navy text-xs px-2 py-0.5">Solo asesores</span>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* Guard: sin empresa activa */}
          {!empresaId && (
            <div className="card p-8 text-center">
              <p className="text-sm text-slate-400">
                Seleccioná una empresa desde el menú lateral para empezar
              </p>
            </div>
          )}

          {/* ── Selector de período ────────────────────────────── */}
          {empresaId && <div className="card p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Empresa activa (solo info) + botón nueva empresa */}
              <div>
                <label className="label">Empresa</label>
                <div className="flex gap-2 items-center">
                  <div className="input flex-1 bg-slate-50 text-slate-600 truncate text-sm">
                    {empresaNombre || '—'}
                  </div>
                  <button
                    onClick={() => setModalAbierto(true)}
                    className="btn-secondary flex-shrink-0 flex items-center gap-1 px-3 text-sm"
                    title="Nueva empresa"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              {/* Período */}
              <div>
                <label className="label">Período</label>
                <select
                  value={periodoSel}
                  onChange={e => setPeriodoSel(e.target.value)}
                  className="input"
                >
                  <option value="nuevo">+ Nuevo período</option>
                  {periodos.map(p => (
                    <option key={p.periodo} value={p.periodo}>{p.periodo}</option>
                  ))}
                </select>
              </div>

              {/* Nombre del período (si es nuevo) o tipo */}
              <div>
                {periodoSel === 'nuevo' ? (
                  <>
                    <label className="label">Nombre del período</label>
                    <input
                      type="text"
                      value={form.periodo}
                      onChange={e => set('periodo', e.target.value)}
                      placeholder="Ej: 2024, 2024-T1, 2023-2024"
                      className="input"
                    />
                  </>
                ) : (
                  <>
                    <label className="label">Tipo</label>
                    <select
                      value={form.tipo_periodo}
                      onChange={e => set('tipo_periodo', e.target.value)}
                      className="input"
                    >
                      <option value="año">Anual</option>
                      <option value="trimestre">Trimestral</option>
                      <option value="mes">Mensual</option>
                    </select>
                  </>
                )}
              </div>
            </div>

            {periodoSel === 'nuevo' && (
              <div className="mt-3">
                <label className="label">Fecha de cierre</label>
                <input
                  type="date"
                  value={form.fecha_cierre}
                  onChange={e => set('fecha_cierre', e.target.value)}
                  className="input w-48"
                />
              </div>
            )}
          </div>}

          {/* ── Formulario con 3 pestañas ──────────────────────── */}
          <div className="card p-5">
            {/* Leer con IA */}
            <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-100">
              <input
                ref={archivoRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleArchivoPDF}
              />
              <button
                onClick={() => archivoRef.current?.click()}
                disabled={leyendoPDF || !empresaId}
                className="btn-primary flex items-center gap-2 disabled:opacity-60"
              >
                {leyendoPDF ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Leyendo PDF...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    Leer balance con IA
                  </>
                )}
              </button>

              {mensajePDF && (
                <div className={`flex items-start gap-2 flex-1 p-2.5 rounded-lg border text-sm
                  ${mensajePDF.tipo === 'ok'
                    ? 'bg-brand-50 border-brand-200 text-brand-800'
                    : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {mensajePDF.tipo === 'ok'
                    ? <CheckCircle size={14} className="text-brand-500 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />}
                  {mensajePDF.texto}
                </div>
              )}
            </div>

            {/* Tab selector */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-5">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors
                    ${tab === t.id
                      ? 'bg-white text-navy-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'patrimonio' && <TabPatrimonio f={form} s={set} />}
            {tab === 'resultados' && <TabResultados f={form} s={set} />}
            {tab === 'flujo'      && <TabFlujo      f={form} s={set} />}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Botón guardar */}
            <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-slate-100">
              {saved && !saving && (
                <span className="flex items-center gap-1 text-xs text-brand-600 font-medium">
                  <CheckCircle size={13} />
                  Guardado
                </span>
              )}
              <button
                onClick={handleGuardar}
                disabled={saving || !empresaId}
                className="btn-primary flex items-center gap-2 disabled:opacity-60"
              >
                <Save size={15} />
                {saving ? 'Guardando...' : 'Guardar balance'}
              </button>
            </div>
          </div>

          {/* ── Balance subido por el cliente ─────────────────── */}
          {empresaId && <BalanceClienteCard empresaId={empresaId} />}

          {/* ── Análisis automático (aparece al guardar) ──────── */}
          {savedRow && (
            <>
              {/* Badge de sincronización */}
              {syncAlmaOk && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-50 border border-brand-200 text-xs text-brand-700 font-medium">
                  <CheckCircle size={13} /> Perfil de empresa actualizado desde el balance
                </div>
              )}

              {/* Tabs de análisis */}
              <div className="card overflow-hidden">
                <div className="flex border-b border-nexxo-light overflow-x-auto">
                  {ANALISIS_TABS.map(t => (
                    <button key={t.id} onClick={() => setTabAnalisis(t.id)}
                      className={`flex-shrink-0 px-4 py-3 text-[11px] uppercase tracking-wider font-semibold border-b-2 transition-colors
                        ${tabAnalisis === t.id
                          ? 'border-nexxo-black text-nexxo-black'
                          : 'border-transparent text-nexxo-gray hover:text-nexxo-black hover:border-nexxo-light'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {tabAnalisis === 'ratios' && <RatiosPanelInner ratios={ratios} />}

                  {tabAnalisis === 'societarios' && (
                    <DatosSocietariosPanel datos={datosExtraidos?.datos_societarios} empresaId={empresaId} />
                  )}

                  {tabAnalisis === 'comparativo' && (
                    <ComparativoPanel anterior={datosExtraidos?.estados_financieros?.anterior} savedRow={savedRow} ratios={ratios} />
                  )}

                  {tabAnalisis === 'preguntas' && (
                    <PreguntasPanel preguntas={calcPreguntasSugeridas(savedRow, datosExtraidos)} alertas={alertasGen} />
                  )}
                </div>
              </div>

              <FlujoAnalisis form={form} />
              <InformeEjecutivo form={form} ratios={ratios} nombreEmpresa={empresaNombre} informeIA={informeIA} />
              <InformeIntegral
                form={form}
                ratios={ratios}
                nombreEmpresa={empresaNombre}
                informeIA={informeIA}
                setInformeIA={setInformeIA}
                generandoIA={generandoIA}
                setGenerandoIA={setGenerandoIA}
                errorIA={errorIA}
                setErrorIA={setErrorIA}
              />
            </>
          )}

        </div>
      </div>

      {/* ── Modal nueva empresa ────────────────────────────── */}
      {modalAbierto && (
        <ModalNuevaEmpresa
          asesorNombre={profile?.nombre || null}
          onCreada={handleEmpresaCreada}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
    </div>
  )
}
