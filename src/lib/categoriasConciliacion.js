export const FAMILIAS_CATEGORIAS = [
  {
    id: 'ingresos',
    label: 'Ingresos',
    categorias: [
      'Depósitos Efect.', 'Depósito en Cheq.', 'Préstamos',
      'Acreditación Tarjeta Visa', 'Acreditación Tarjeta Mastercard',
      'Minera Andina', 'Rescate FIMA', 'Plazo Fijo DB Cta',
      'Transferencia (cobro)'
    ]
  },
  {
    id: 'pagos',
    label: 'Pagos',
    categorias: [
      'Transferencia Proveedor', 'Cheques', 'Transf. Mismo Titular',
      'OSDE', 'Pago Visa', 'Cta. Particular Gomez', 'Cta. Particular Mercado'
    ]
  },
  {
    id: 'financiero',
    label: 'Financiero',
    categorias: [
      'Fondo FIMA', 'P.E. 5 007', 'P.C. 7 181', 'P.C. 6 122', 'P.C. 6 123'
    ]
  },
  {
    id: 'impositivo',
    label: 'Impositivo',
    categorias: [
      'IMP 25413 Déb.', 'IMP 25413 Créd.', 'I.I.B.B. San Juan',
      'F. 931', 'Pago AFIP', 'Retención IVA', 'DGR Imp. Sellos',
      'Plan Seg. Social Feb-22', 'Plan Seg. Social Dic-21/Ene-22'
    ]
  },
  {
    id: 'estructura',
    label: 'Estructura',
    categorias: [
      'Sueldos', 'Sindicato', 'Seguros'
    ]
  },
  {
    id: 'bancario',
    label: 'Bancario',
    categorias: [
      'Comisiones', 'Intereses', 'IVA', 'Débito Directo',
      'Extracción en Cta Cte', 'Tarjeta Débito', 'Débito Préstamo 7363',
      'ND Grav. Créd./Déb.'
    ]
  }
]

export const TODAS_CATEGORIAS_FLAT = FAMILIAS_CATEGORIAS.flatMap(f => f.categorias)

export function obtenerFamilia(categoriaLabel) {
  const familia = FAMILIAS_CATEGORIAS.find(f => f.categorias.includes(categoriaLabel))
  return familia ? familia.id : 'sin_clasificar'
}

export function calcularTotalesFamilia(movimientos) {
  const totales = {
    ingresos: 0,
    pagos: 0,
    financiero: 0,
    impositivo: 0,
    estructura: 0,
    bancario: 0,
    sin_clasificar: 0
  }

  movimientos.forEach(m => {
    if (!m.validado || !m.cuenta_nombre) return
    const familia = obtenerFamilia(m.cuenta_nombre)
    // Ingresos suma créditos y resta débitos
    // Pagos, etc, nosotros queremos el net... wait, the prompt says:
    // ingresos: 831338426 (positivo)
    // pagos: -363684485 (negativo)
    // So it's just credito - debito for everything!
    const neto = (m.credito || 0) - (m.debito || 0)
    if (totales[familia] !== undefined) {
      totales[familia] += neto
    }
  })

  return totales
}
