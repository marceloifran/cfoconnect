# CFOConnect / NEXXO CAPITAL — Contexto del proyecto

## Qué es este proyecto

Plataforma B2B de asesoría financiera para PyMEs. El nombre de marca en la UI es **NEXXO CAPITAL**. El repositorio es `https://github.com/marceloifran/cfoconnect.git`.

## Stack técnico

- **Frontend:** React 18 + Vite + React Router v6 + Tailwind CSS
- **Backend/DB:** Supabase (PostgreSQL con RLS)
- **IA:** Claude (Anthropic) vía `VITE_ANTHROPIC_API_KEY`
- **UI icons:** Lucide React
- **Charts:** Recharts
- **PDF:** jsPDF + svg2pdf.js

## Cómo levantar en local

```bash
cd C:\cfoconnect\cfoconnect
npm run dev          # → http://localhost:5173
```

Las credenciales ya están en `.env.local` (Supabase URL, anon key, service key, Anthropic key).

## Estructura de carpetas clave

```
src/
  pages/          # Una página por ruta
  components/
    layout/       # AppShell (sidebar + topbar)
    conciliacion/ # Módulo de conciliación bancaria
    informe-nexxo/ # Módulo de informe diagnóstico
    shared/       # MetricCard, PageHeader, Semaforo
  hooks/
    useAuth.jsx   # Contexto de autenticación y empresa activa
  lib/
    supabase.js   # Cliente Supabase anon
    supabaseAdmin.js # Cliente con service key
    conciliacion.js
    categoriasConciliacion.js
    parsers/
      extractorAI.js  # Extracción de extractos bancarios con IA
      galiciaParser.js
      eERRExcelParser.js
  router.jsx      # Todas las rutas y guards
```

## Roles y acceso (RBAC)

| Rol | Ruta base | Acceso |
|-----|-----------|--------|
| `admin` | `/admin` | Control total, gestión de asesores/empresas |
| `asesor` | `/asesor` | Sus empresas asignadas, diagnóstico, CFO, conciliación |
| `cliente` | `/dashboard` | Solo su propia empresa |
| `contador` | `/contador` | Vista contable |

### Guards en router.jsx
- `RequireAuth` → redirige a `/login` si no hay sesión
- `RequireRole` → redirige a `/` si el rol no coincide
- `RoleRouter` → redirige al home correcto según rol

## Hook useAuth

```js
const {
  session, profile, loading,
  isAdmin, isAsesor, isCliente,
  empresa,           // empresa activa (considera impersonación)
  isImpersonating,   // asesor viendo como cliente
  empresaActiva,     // empresa seleccionada por el asesor
  setEmpresaActiva,  // cambia empresa activa
  stopImpersonating,
  signOut,
} = useAuth()
```

El asesor puede seleccionar una empresa desde el topbar; eso activa la impersonación y `empresa` devuelve la empresa del cliente.

## Navegación por rol (AppShell.jsx)

**ASESOR_NAV** — secciones: Panel / Diagnóstico / Gestión
- `/asesor` — Panel general
- `/balance` — Análisis de balance *(requiere rol asesor)*
- `/diagnostico-profundo` — Alma de la empresa
- `/informe-final` — Mapa de capital
- `/informe-nexxo` — Informe diagnóstico
- `/cfo` — CFO Gestión
- `/conciliacion` — Conciliación bancaria
- `/documentos`, `/mensajes`

**CLIENTE_NAV**
- `/dashboard`, `/mi-perfil`, `/mi-informe`, `/mi-ruta`, `/conciliacion`, `/documentos`, `/mensajes`

## Tablas Supabase principales

| Tabla | Descripción |
|-------|-------------|
| `usuarios` | Auth extendida: `rol`, `empresa_id`, `activo` |
| `empresas` | Empresa cliente: nombre, CUIT, rubro, `etapa_numero` |
| `asignaciones` | Pivot asesor ↔ empresa |
| `diagnosticos` | Historial de evaluaciones SGR |
| `periodos_financieros` | Datos contables mensuales por empresa |
| `proyeccion_caja` | Cash flow semanal |
| `indicadores_mercado` | Variables macro globales (key-value) |

## Tokens de diseño (CSS vars en nexxo-tokens.css)

```
--nx-black, --nx-gray, --nx-topo, --nx-topo-lt, --nx-topo-xl
--nx-off, --nx-light, --nx-line
--nx-indigo, --nx-indigo-bg, --nx-indigo-bd
--nx-amber, --nx-amber-bg
--nx-red, --nx-shadow-md
```

Todos los componentes usan estas variables inline — no clases Tailwind de color directamente.

## Comandos git

```bash
git pull origin main   # traer cambios del repo
git push origin main   # subir cambios
```
