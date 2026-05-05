import { FAMILIAS_CATEGORIAS } from '@/lib/categoriasConciliacion'

export default function CategoriaDropdown({ value, onChange, disabled }) {
  return (
    <select 
      value={value || ''} 
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="text-xs border border-slate-200 rounded-md bg-white w-48 truncate px-2 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
    >
      <option value="" disabled>Seleccionar categoría...</option>
      {FAMILIAS_CATEGORIAS.map(familia => (
        <optgroup key={familia.id} label={familia.label}>
          {familia.categorias.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
