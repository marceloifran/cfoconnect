/**
 * informeNexxoPDF.js — v2
 * Flujo libre: cada render* toma y inicial, retorna y final.
 * checkBreak agrega página + header cuando el espacio restante es insuficiente.
 */

import { jsPDF } from 'jspdf'
import 'svg2pdf.js'

// ── Paleta ──────────────────────────────────────────────────────────
const C = {
  black:   '#111417',
  topo:    '#A8A093',
  topoXl:  '#E0DAD2',
  amber:   '#C8A86B',
  amberBg: '#FDF8F0',
  indigo:  '#4F46E5',
  indigoBg:'#EEF2FF',
  red:     '#DC2626',
  redBg:   '#FEF2F2',
  green:   '#16A34A',
  greenBg: '#F0FDF4',
  light:   '#EDEDED',
  off:     '#F5F4F1',
  white:   '#FFFFFF',
  text:    '#111417',
  textSec: '#6B6B6B',
}

// ── Geometría A4 ────────────────────────────────────────────────────
const P = {
  w:   210,
  h:   297,
  ml:  22,
  cw:  166,   // 210 - 22*2
  mt:  15,
  mb:  20,
  hEnd: 30,   // y donde termina el header en páginas interiores
  yStart: 34, // y donde empieza el contenido tras el header
}

// ── SVG isotipo ─────────────────────────────────────────────────────
const ISOTIPO_SVG = `<svg width="40" height="40" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 8L20 24L6 40" stroke="#111417" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M14 8L28 24L14 40" stroke="#111417" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M42 8L28 24L42 40" stroke="#A8A093" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`

// ════════════════════════════════════════════════════════════════════
// HELPERS PRIMITIVOS
// ════════════════════════════════════════════════════════════════════

function font(doc, size, color = C.text, style = 'normal') {
  doc.setFont('helvetica', style)
  doc.setFontSize(size)
  doc.setTextColor(color)
}
const ptMm = (pt, lh = 1.45) => pt * 0.3528 * lh

function addText(doc, txt, x, y, maxW, { size = 11, color = C.text, style = 'normal', lh = 1.45, align = 'left' } = {}) {
  if (!txt) return y
  font(doc, size, color, style)
  const lines = doc.splitTextToSize(String(txt), maxW)
  lines.forEach((l, i) => doc.text(l, x, y + i * ptMm(size, lh), { align }))
  return y + lines.length * ptMm(size, lh)
}

function addParagraphs(doc, txt, x, y, maxW, opts = {}) {
  if (!txt) return y
  const paras = txt.split(/\n\n+/).filter(Boolean)
  paras.forEach((p, i) => {
    y = addText(doc, p.trim(), x, y, maxW, opts)
    if (i < paras.length - 1) y += ptMm(opts.size || 11, 0.5)
  })
  return y
}

function box(doc, x, y, w, h, fillCol, strokeCol, sw = 0.3) {
  if (fillCol)   { doc.setFillColor(fillCol) }
  if (strokeCol) { doc.setDrawColor(strokeCol); doc.setLineWidth(sw) }
  doc.rect(x, y, w, h, fillCol && strokeCol ? 'FD' : fillCol ? 'F' : 'D')
}

function hline(doc, y, x1 = P.ml, x2 = P.ml + P.cw, color = C.light, w = 0.3) {
  doc.setDrawColor(color); doc.setLineWidth(w)
  doc.line(x1, y, x2, y)
}

// ── Título principal de sección (con barra ámbar) ───────────────────
function sectionTitle(doc, titulo, y) {
  doc.setFillColor(C.amber); doc.rect(P.ml, y, 2.5, 6, 'F')
  font(doc, 14, C.black, 'bold')
  doc.text(titulo, P.ml + 5.5, y + 5)
  hline(doc, y + 8.5)
  return y + 14
}

// ── Sub-etiqueta interna (sentence case + línea sutil) ──────────────
function sectionLabel(doc, texto, x, y) {
  const label = texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase()
  font(doc, 10, C.textSec, 'bold')
  doc.text(label, x, y)
  hline(doc, y + 2, x, x + 45, C.light, 0.3)
  return y + 7
}

// ════════════════════════════════════════════════════════════════════
// LOGO
// ════════════════════════════════════════════════════════════════════

async function renderIsotipo(doc, x, y, size = 12) {
  try {
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(ISOTIPO_SVG, 'image/svg+xml')
    await doc.svg(svgDoc.documentElement, { x, y, width: size, height: size })
    return true
  } catch {
    return new Promise(resolve => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 120
      const ctx = canvas.getContext('2d')
      const img = new Image()
      const blob = new Blob([ISOTIPO_SVG], { type: 'image/svg+xml' })
      const url  = URL.createObjectURL(blob)
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 120, 120)
        URL.revokeObjectURL(url)
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, size, size)
        resolve(false)
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(false) }
      img.src = url
    })
  }
}

async function renderLogo(doc, x, y, scale = 1) {
  const s = 10 * scale
  await renderIsotipo(doc, x, y, s)
  doc.setDrawColor(C.topoXl); doc.setLineWidth(0.5)
  doc.line(x + s + 3 * scale, y + 1, x + s + 3 * scale, y + s - 1)
  const tx = x + s + 5.5 * scale
  font(doc, 10 * scale, C.black, 'bold');   doc.text('NEXXO',   tx, y + s * 0.52)
  font(doc, 6.5 * scale, C.topo, 'normal'); doc.text('CAPITAL', tx, y + s * 0.88)
}

// ── Header interior (páginas 2+) ────────────────────────────────────
async function renderHeaderConLogo(doc, empresa) {
  doc.setFillColor(C.white); doc.rect(0, 0, P.w, P.hEnd, 'F')
  await renderLogo(doc, P.ml, P.mt - 7, 0.85)
  font(doc, 8, C.textSec, 'normal')
  doc.text(`Informe NEXXO · ${empresa?.nombre || ''}`, P.ml + P.cw, P.mt - 2, { align: 'right' })
  hline(doc, P.hEnd - 2)
}

// ════════════════════════════════════════════════════════════════════
// checkBreak — agrega página + header si falta espacio
// ════════════════════════════════════════════════════════════════════

async function checkBreak(doc, y, needed, empresa) {
  if (y + needed > P.h - P.mb) {
    doc.addPage()
    await renderHeaderConLogo(doc, empresa)
    return P.yStart
  }
  return y
}

// ════════════════════════════════════════════════════════════════════
// PORTADA (página 1 — sin y param, layout fijo)
// ════════════════════════════════════════════════════════════════════

async function renderPortada(doc, c, empresa) {
  // ── Fondo general blanco-roto ─────────────────────────────────────
  doc.setFillColor(C.off); doc.rect(0, 0, P.w, P.h, 'F')

  // ── Franja negra superior (12mm) ──────────────────────────────────
  doc.setFillColor(C.black); doc.rect(0, 0, P.w, 14, 'F')
  font(doc, 7.5, C.topo, 'normal')
  doc.text('NEXXO CAPITAL', P.ml, 9.5)
  doc.text('DIAGNÓSTICO FINANCIERO', P.ml + P.cw, 9.5, { align: 'right' })

  // ── Logo centrado en zona clara ───────────────────────────────────
  await renderLogo(doc, P.ml, 28, 2.1)

  // ── Línea ámbar separadora ────────────────────────────────────────
  doc.setDrawColor(C.amber); doc.setLineWidth(1.0)
  doc.line(P.ml, 62, P.ml + P.cw, 62)

  // ── Título editorial ──────────────────────────────────────────────
  font(doc, 28, C.black, 'bold');   doc.text('Informe diagnóstico', P.ml, 82)
  font(doc, 28, C.topo, 'normal');  doc.text('y plan de acción',    P.ml, 98)

  // ── Nombre empresa ────────────────────────────────────────────────
  font(doc, 16, C.black, 'normal')
  doc.text(empresa?.nombre || c?.portada?.empresa || '', P.ml, 114)

  // ── Separador fino ────────────────────────────────────────────────
  doc.setDrawColor(C.topoXl); doc.setLineWidth(0.4)
  doc.line(P.ml, 120, P.ml + P.cw, 120)

  // ── Datos en tabla limpia ─────────────────────────────────────────
  let y = 132
  const datos = [
    ['CUIT',             c?.portada?.cuit          || empresa?.cuit || '—'],
    ['Período',          c?.portada?.periodo        || '—'],
    ['Fecha de emisión', c?.portada?.fecha_emision  || '—'],
    ['Rubro',            empresa?.rubro             || '—'],
  ]
  datos.forEach(([lbl, val]) => {
    font(doc, 8, C.topo, 'bold')
    doc.text(lbl.toUpperCase(), P.ml, y)
    font(doc, 11, C.text, 'normal')
    doc.text(String(val), P.ml + 44, y)
    y += 9
  })

  // ── Franja negra inferior ─────────────────────────────────────────
  doc.setFillColor(C.black); doc.rect(0, P.h - 18, P.w, 18, 'F')
  font(doc, 8.5, C.topo, 'normal')
  doc.text('Orden financiero. Acceso a capital.', P.w / 2, P.h - 6, { align: 'center' })
}

// ════════════════════════════════════════════════════════════════════
// SECCIONES — todas reciben (doc, c, y, empresa?) y retornan y
// ════════════════════════════════════════════════════════════════════

// ── Carta inicial ───────────────────────────────────────────────────
async function renderCartaInicial(doc, c, y, empresa) {
  y = sectionTitle(doc, 'Carta inicial', y)
  const txt   = c?.carta_inicial || ''
  const lines = doc.splitTextToSize(txt, P.cw - 12)
  const boxH  = lines.length * ptMm(11, 1.5) + 14

  y = await checkBreak(doc, y, boxH, empresa)
  box(doc, P.ml, y, P.cw, boxH, C.amberBg, C.amber, 0.4)
  doc.setFillColor(C.amber); doc.rect(P.ml, y, 2.5, boxH, 'F')
  y = addParagraphs(doc, txt, P.ml + 7, y + 7, P.cw - 12, { size: 11, color: C.text, lh: 1.5 })
  return y + 10
}

// ── Resumen ejecutivo ───────────────────────────────────────────────
async function renderResumenEjecutivo(doc, c, y, empresa) {
  y = sectionTitle(doc, 'Resumen ejecutivo', y)
  const re = c?.resumen_ejecutivo || {}

  // ── Score — fila compacta full width, sin float ───────────────────
  const bandH = 22
  y = await checkBreak(doc, y, bandH + 6, empresa)
  box(doc, P.ml, y, P.cw, bandH, C.off, C.amber, 0.5)

  // Categoría grande a la izquierda del band (sigue siendo una fila, no float)
  font(doc, 8.5, C.topo, 'normal')
  doc.text('Categoría SGR', P.ml + 6, y + 6.5)
  font(doc, 18, C.black, 'bold')
  doc.text(String(re.categoria_sgr || ''), P.ml + 6, y + 18)

  // Separador vertical dentro del band
  doc.setDrawColor(C.topoXl); doc.setLineWidth(0.4)
  doc.line(P.ml + 44, y + 3, P.ml + 44, y + bandH - 3)

  // Score a la derecha del separador
  font(doc, 9, C.textSec, 'normal')
  doc.text('Score SGR', P.ml + 50, y + 7)
  font(doc, 15, C.black, 'bold')
  doc.text(`${re.score_sgr || 0} / 100`, P.ml + 50, y + 17)

  y += bandH + 10

  // ── Puntos clave — apilados verticalmente, full width ────────────
  for (const [i, pk] of (re.puntos_clave || []).entries()) {
    y = await checkBreak(doc, y, 14, empresa)
    doc.setFillColor(C.amber); doc.circle(P.ml + 4, y + 1.5, 3.5, 'F')
    font(doc, 8, C.white, 'bold')
    doc.text(String(i + 1), P.ml + 4, y + 2.4, { align: 'center' })
    y = addText(doc, pk, P.ml + 11, y, P.cw - 11, { size: 10.5, color: C.text, lh: 1.5 })
    y += 5
  }

  return y + 8
}

// ── Quiénes son hoy ─────────────────────────────────────────────────
async function renderQuienesSonHoy(doc, c, y, empresa) {
  y = sectionTitle(doc, 'Quiénes son hoy', y)
  y = addParagraphs(doc, c?.quienes_son_hoy, P.ml, y, P.cw, { size: 11, color: C.text, lh: 1.5 })
  return y + 10
}

// ── Qué dicen los números ───────────────────────────────────────────
async function renderQueDicenLosNumeros(doc, c, y, empresa) {
  y = sectionTitle(doc, 'Qué dicen los números', y)
  const qdn = c?.que_dicen_los_numeros || {}

  y = addParagraphs(doc, qdn.narrativa, P.ml, y, P.cw, { size: 11, color: C.text, lh: 1.5 })
  y += 8

  if ((qdn.hallazgos || []).length > 0) {
    y = await checkBreak(doc, y, 30, empresa)
    y = sectionLabel(doc, 'Hallazgos', P.ml, y)

    for (const h of (qdn.hallazgos || [])) {
      const esF   = h.tipo === 'fortaleza'
      const bgCol = esF ? C.greenBg : C.redBg
      const bdCol = esF ? C.green   : C.red
      const lbTxt = esF ? 'Fortaleza' : 'Alerta'
      const lbCol = esF ? C.green   : C.red

      const dLines = doc.splitTextToSize(h.detalle || '', P.cw - 28)
      const rowH   = Math.max(14, 11 + dLines.length * ptMm(9.5)) + 2

      y = await checkBreak(doc, y, rowH + 2, empresa)

      const badgeW = 22
      box(doc, P.ml, y, badgeW, rowH, bgCol, bdCol, 0.3)
      font(doc, 7, lbCol, 'bold')
      doc.text(lbTxt, P.ml + badgeW / 2, y + rowH / 2 + 1, { align: 'center' })

      const cx = P.ml + badgeW + 4
      const cw = P.cw - badgeW - 4
      font(doc, 10.5, C.black, 'bold');  doc.text(h.titulo || '', cx, y + 5.5)
      font(doc, 9.5, C.textSec, 'normal')
      dLines.forEach((l, i) => doc.text(l, cx, y + 11 + i * ptMm(9.5)))

      hline(doc, y + rowH, P.ml, P.ml + P.cw, C.light, 0.2)
      y += rowH + 4
    }
  }
  return y + 6
}

// ── Voz de la empresa ───────────────────────────────────────────────
async function renderVozEmpresa(doc, c, y, empresa) {
  y = sectionTitle(doc, 'Voz de la empresa', y)
  const txt   = c?.voz_de_la_empresa || ''
  const lines = doc.splitTextToSize(txt, P.cw - 12)
  const boxH  = lines.length * ptMm(11, 1.5) + 14

  y = await checkBreak(doc, y, boxH, empresa)
  box(doc, P.ml, y, P.cw, boxH, C.indigoBg, C.indigo, 0.4)
  doc.setFillColor(C.indigo); doc.rect(P.ml, y, 2.5, boxH, 'F')
  y = addParagraphs(doc, txt, P.ml + 7, y + 8, P.cw - 12, { size: 11, color: C.text, lh: 1.5 })
  return y + 10
}

// ── Mapa de capital ─────────────────────────────────────────────────
async function renderMapaDeCapital(doc, c, y, empresa) {
  y = sectionTitle(doc, 'Mapa de capital', y)
  const mc = c?.mapa_de_capital || {}

  // ── Score box — centrado, ~80mm de ancho, sin float ───────────────
  const bW = 82, bH = 40
  const bX = P.ml + (P.cw - bW) / 2          // centrado horizontalmente
  y = await checkBreak(doc, y, bH + 10, empresa)
  box(doc, bX, y, bW, bH, C.off, C.amber, 0.5)
  font(doc, 8.5, C.topo, 'normal')
  doc.text('Categoría SGR', bX + bW / 2, y + 8, { align: 'center' })
  font(doc, 28, C.black, 'bold')
  doc.text(String(mc.score || 0), bX + bW / 2, y + 22, { align: 'center' })
  font(doc, 13, C.amber, 'bold')
  doc.text(mc.categoria || '', bX + bW / 2, y + 34, { align: 'center' })
  y += bH + 10

  // ── lectura_categoria — full width, debajo del box ────────────────
  y = addParagraphs(doc, mc.lectura_categoria, P.ml, y, P.cw, { size: 10.5, color: C.text, lh: 1.5 })
  y += 6

  // ── introduccion_sgr — full width ─────────────────────────────────
  y = addParagraphs(doc, mc.introduccion_sgr, P.ml, y, P.cw, { size: 10, color: C.textSec, lh: 1.45 })
  y += 8

  // Tabla instrumentos
  if ((mc.instrumentos_disponibles || []).length > 0) {
    y = await checkBreak(doc, y, 50, empresa)
    y = sectionLabel(doc, 'Instrumentos disponibles', P.ml, y)

    const cols = [46, 38, 42, 40]
    const hdrs = ['Instrumento', 'Cupo estimado', 'Para qué sirve', 'Por qué aplica']
    box(doc, P.ml, y, P.cw, 7, C.black, C.black, 0)
    font(doc, 7.5, C.white, 'bold')
    let cx = P.ml + 2
    hdrs.forEach((h, i) => { doc.text(h, cx, y + 5); cx += cols[i] })
    y += 7

    for (const [ri, inst] of (mc.instrumentos_disponibles || []).entries()) {
      const n1 = doc.splitTextToSize(inst.nombre || '', cols[0] - 3)
      const n2 = doc.splitTextToSize(inst.cupo_estimado || '', cols[1] - 3)
      const n3 = doc.splitTextToSize(inst.para_que_sirve || '', cols[2] - 3)
      const n4 = doc.splitTextToSize(inst.por_que_aplica || '', cols[3] - 3)
      const maxL = Math.max(n1.length, n2.length, n3.length, n4.length)
      const rH   = maxL * ptMm(8) + 6
      y = await checkBreak(doc, y, rH + 2, empresa)
      box(doc, P.ml, y, P.cw, rH, ri % 2 === 0 ? C.white : C.off, C.light, 0.2)
      font(doc, 8, C.black, 'bold')
      n1.forEach((l, i) => doc.text(l, P.ml + 2, y + 4 + i * ptMm(8)))
      font(doc, 8, C.amber, 'bold')
      n2.forEach((l, i) => doc.text(l, P.ml + cols[0] + 2, y + 4 + i * ptMm(8)))
      font(doc, 7.5, C.textSec, 'normal')
      n3.forEach((l, i) => doc.text(l, P.ml + cols[0] + cols[1] + 2, y + 4 + i * ptMm(7.5)))
      n4.forEach((l, i) => doc.text(l, P.ml + cols[0] + cols[1] + cols[2] + 2, y + 4 + i * ptMm(7.5)))
      y += rH
    }
    y += 8
  }

  // Operatorias recomendadas
  if ((mc.tipos_operatoria_recomendada || []).length > 0) {
    y = await checkBreak(doc, y, 30, empresa)
    y = sectionLabel(doc, 'Operatorias recomendadas', P.ml, y)

    for (const op of (mc.tipos_operatoria_recomendada || [])) {
      y = await checkBreak(doc, y, 22, empresa)
      const chipTxt = op.categoria || ''
      font(doc, 8, C.indigo, 'bold')
      const chipW = doc.getTextWidth(chipTxt) + 6
      box(doc, P.ml, y - 3.5, chipW, 6.5, C.indigoBg, C.indigo, 0.3)
      doc.text(chipTxt, P.ml + 3, y + 1.5)
      y += 8
      y = addText(doc, op.descripcion_simple, P.ml, y, P.cw, { size: 10, color: C.black, style: 'bold', lh: 1.45 })
      y = addText(doc, op.justificacion, P.ml, y + 2, P.cw, { size: 9.5, color: C.textSec, lh: 1.45 })
      y += 6
      hline(doc, y - 2)
    }
    y += 4
  }
  return y
}

// ── Plan 90 días — layout 100% vertical, sin floats ─────────────────
async function renderPlan90Dias(doc, c, y, empresa) {
  y = sectionTitle(doc, 'Plan 90 días', y)

  for (const [i, a] of (c?.plan_90_dias || []).entries()) {
    y = await checkBreak(doc, y, 50, empresa)

    // ── Fila de prioridad — chip número + título en full width ────────
    // Chip numérico (pequeño, inline al inicio de la fila)
    const chipR = 4.5
    const chipX = P.ml + chipR
    doc.setFillColor(C.amber)
    doc.circle(chipX, y + chipR, chipR, 'F')
    font(doc, 9, C.white, 'bold')
    doc.text(String(a.prioridad || i + 1), chipX, y + chipR + 1.5, { align: 'center' })

    // Título de la acción — arranca al lado del chip, mismo ancho full
    const titleX = P.ml + chipR * 2 + 4
    const titleW = P.cw - chipR * 2 - 4
    const accLines = doc.splitTextToSize(a.accion || '', titleW)
    font(doc, 12, C.black, 'bold')
    accLines.forEach((l, li) => doc.text(l, titleX, y + 4.5 + li * ptMm(12, 1.3)))
    y += Math.max(chipR * 2 + 2, accLines.length * ptMm(12, 1.3) + 3)

    // ── Para qué — full width ─────────────────────────────────────────
    y = addText(doc, `Para qué: ${a.para_que || ''}`, P.ml, y, P.cw,
      { size: 9.5, color: C.textSec, style: 'italic', lh: 1.5 })
    y += 4

    // ── Primer paso — box full width ──────────────────────────────────
    if (a.primer_paso) {
      const psLines = doc.splitTextToSize(a.primer_paso, P.cw - 9)
      const psH     = psLines.length * ptMm(9.5) + 9
      y = await checkBreak(doc, y, psH + 2, empresa)
      box(doc, P.ml, y, P.cw, psH, C.off, C.topoXl, 0.3)
      doc.setFillColor(C.topo); doc.rect(P.ml, y, 2.5, psH, 'F')
      font(doc, 8.5, C.topo, 'bold')
      doc.text('Primer paso', P.ml + 6, y + 6)
      font(doc, 9.5, C.black, 'normal')
      psLines.forEach((l, li) => doc.text(l, P.ml + 6, y + 11 + li * ptMm(9.5)))
      y += psH + 4
    }

    // ── Herramienta NEXXO — full width ────────────────────────────────
    if (a.herramienta_nexxo) {
      font(doc, 8.5, C.amber, 'italic')
      doc.text(a.herramienta_nexxo, P.ml, y)
      y += ptMm(8.5) + 2
    }

    // Línea separadora entre acciones
    if (i < (c.plan_90_dias.length - 1)) {
      hline(doc, y + 4, P.ml, P.ml + P.cw, C.topoXl, 0.3)
      y += 12
    } else {
      y += 6
    }
  }
  return y
}

// ── Cierre ──────────────────────────────────────────────────────────
async function renderCierre(doc, c, y, empresa) {
  y = sectionTitle(doc, 'Cierre', y)
  const cierre = c?.cierre || {}

  if (cierre.mensaje_final) {
    const mLines = doc.splitTextToSize(cierre.mensaje_final, P.cw - 12)
    const mH     = mLines.length * ptMm(11, 1.5) + 14
    y = await checkBreak(doc, y, mH, empresa)
    box(doc, P.ml, y, P.cw, mH, C.black, C.black, 0)
    font(doc, 11, C.white, 'normal')
    mLines.forEach((l, i) => doc.text(l, P.ml + 6, y + 9 + i * ptMm(11, 1.5)))
    y += mH + 12
  }

  if ((cierre.glosario || []).length > 0) {
    y = await checkBreak(doc, y, 30, empresa)
    y = sectionLabel(doc, 'Glosario', P.ml, y)

    const colT = 55, colD = P.cw - colT
    box(doc, P.ml, y, P.cw, 6.5, C.black, C.black, 0)
    font(doc, 7.5, C.white, 'bold')
    doc.text('Término', P.ml + 2, y + 4.5)
    doc.text('Definición', P.ml + colT + 2, y + 4.5)
    y += 6.5

    for (const [i, g] of (cierre.glosario || []).entries()) {
      const dLines = doc.splitTextToSize(g.definicion || '', colD - 4)
      const rH     = Math.max(dLines.length * ptMm(8.5), 6.5) + 4
      y = await checkBreak(doc, y, rH + 1, empresa)
      box(doc, P.ml, y, P.cw, rH, i % 2 === 0 ? C.white : C.off, C.light, 0.2)
      font(doc, 8.5, C.black, 'bold');    doc.text(g.termino || '', P.ml + 2, y + 4.5)
      font(doc, 8.5, C.textSec, 'normal')
      dLines.forEach((l, li) => doc.text(l, P.ml + colT + 2, y + 4 + li * ptMm(8.5)))
      y += rH
    }
    y += 10
  }

  if (cierre.disclaimer) {
    y = await checkBreak(doc, y, 18, empresa)
    hline(doc, y); y += 6
    y = addParagraphs(doc, cierre.disclaimer, P.ml, y, P.cw, { size: 8, color: C.topo, style: 'italic', lh: 1.4 })
  }

  return y
}

// ── Footers con paginación ──────────────────────────────────────────
function agregarFootersConPaginacion(doc) {
  const total = doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    font(doc, 8, C.topo, 'normal')
    doc.text(`${i} / ${total}`, P.ml + P.cw, 289, { align: 'right' })
    if (i > 1) doc.text('Documento confidencial · Uso exclusivo del cliente', P.ml, 289)
  }
}

// ════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL EXPORTADA
// ════════════════════════════════════════════════════════════════════

/**
 * Genera el PDF completo del Informe NEXXO.
 * Flujo libre: las secciones fluyen hasta el final de la página
 * y saltan cuando no hay espacio suficiente.
 *
 * @param {object} contenidoJson - contenido_json de informes_nexxo
 * @param {object} empresa       - datos de empresa (nombre, cuit, rubro)
 * @returns {Promise<Blob>}
 */
export async function generarPDFInformeNexxo(contenidoJson, empresa) {
  const c   = contenidoJson || {}
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })

  // Portada (layout fijo, no usa cursor y)
  await renderPortada(doc, c, empresa)

  // A partir de aquí: flujo libre con cursor y
  doc.addPage()
  await renderHeaderConLogo(doc, empresa)
  let y = P.yStart

  y = await renderCartaInicial(doc, c, y, empresa)
  y = await checkBreak(doc, y, 80, empresa)
  y = await renderResumenEjecutivo(doc, c, y, empresa)
  y = await checkBreak(doc, y, 60, empresa)
  y = await renderQuienesSonHoy(doc, c, y, empresa)
  y = await checkBreak(doc, y, 60, empresa)
  y = await renderQueDicenLosNumeros(doc, c, y, empresa)
  y = await checkBreak(doc, y, 60, empresa)
  y = await renderVozEmpresa(doc, c, y, empresa)
  y = await checkBreak(doc, y, 80, empresa)
  y = await renderMapaDeCapital(doc, c, y, empresa)
  y = await checkBreak(doc, y, 80, empresa)
  y = await renderPlan90Dias(doc, c, y, empresa)
  y = await checkBreak(doc, y, 60, empresa)
  y = await renderCierre(doc, c, y, empresa)

  agregarFootersConPaginacion(doc)
  return doc.output('blob')
}
