# CFOConnect — Guía de instalación y desarrollo

## Qué es esto
Plataforma web para asesoría financiera a PyMEs. El asesor gestiona todas las empresas desde un panel central. Cada empresa tiene su propio portal con diagnóstico financiero, módulo CFO, mercado de capitales y reportes.

---

## Setup inicial — 30 minutos

### Paso 1 — Instalá Node.js
Si no lo tenés: https://nodejs.org → descargá la versión LTS (la verde) e instalá.

Para verificar que funciona, abrí la terminal y escribí:
```
node --version
```
Debe mostrar algo como `v20.x.x`

---

### Paso 2 — Creá tu proyecto en Supabase

1. Entrá a https://supabase.com y creá una cuenta gratis
2. Hacé clic en **New project**
3. Nombre: `cfoconnect`, región: South America (São Paulo)
4. Guardá la contraseña de la base de datos (la vas a necesitar)
5. Esperá 2 minutos a que el proyecto se cree

---

### Paso 3 — Creá la base de datos

1. En tu proyecto de Supabase, andá a **SQL Editor** → **New query**
2. Copiá TODO el contenido del archivo `supabase-schema.sql`
3. Pegalo en el editor y hacé clic en **Run**
4. Deberías ver "Success" en verde

---

### Paso 4 — Creá los usuarios de prueba

En Supabase → **Authentication** → **Users** → **Add user**:

**Usuario asesor:**
- Email: `asesor@tuempresa.com`
- Password: `asesor123`
- En "User metadata" (JSON): `{"nombre": "Tu nombre", "rol": "asesor"}`

**Usuario cliente (Molinos del NOA):**
- Email: `molinos@cfoconnect.com`
- Password: `molinos123`
- En "User metadata": `{"nombre": "Molinos del NOA", "rol": "cliente"}`

Después de crear cada usuario, vinculalo a su empresa:
```sql
-- Ejecutar en SQL Editor (reemplazá el UUID con el real del usuario)
update usuarios
set empresa_id = 'a1b2c3d4-0000-0000-0000-000000000001'
where id = 'UUID_DEL_USUARIO_MOLINOS';
```

---

### Paso 5 — Configurá las variables de entorno

1. En Supabase → **Settings** → **API**
2. Copiá la **URL** y la **anon public key**
3. En la carpeta del proyecto, creá el archivo `.env.local`:

```
VITE_SUPABASE_URL=https://tuproyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

---

### Paso 6 — Instalá las dependencias y levantá el proyecto

Abrí la terminal en la carpeta `cfoconnect` y ejecutá:

```bash
npm install
npm run dev
```

Abrí el navegador en: http://localhost:5173

---

## Estructura del proyecto

```
cfoconnect/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppShell.jsx        # Sidebar + layout principal
│   │   └── shared/
│   │       ├── PageHeader.jsx      # Header de cada página
│   │       ├── MetricCard.jsx      # Cards de KPIs
│   │       └── Semaforo.jsx        # Componente semáforo
│   ├── hooks/
│   │   └── useAuth.jsx             # Context de autenticación
│   ├── lib/
│   │   ├── supabase.js             # Cliente de Supabase
│   │   └── financials.js           # Todos los cálculos financieros
│   ├── pages/
│   │   ├── LoginPage.jsx           # Pantalla de login
│   │   ├── DashboardPage.jsx       # Dashboard del cliente
│   │   └── AsesorPage.jsx          # Panel del asesor
│   ├── styles/
│   │   └── globals.css             # Tokens de diseño + utilidades
│   ├── router.jsx                  # Rutas + guards por rol
│   └── main.jsx                    # Entry point
├── supabase-schema.sql             # Base de datos completa
├── .env.example                    # Template de variables de entorno
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## Lo que funciona en esta versión (Fase 1)

- Login con Supabase Auth
- Redirección automática por rol (asesor / cliente)
- Panel del asesor con lista de empresas y alertas
- Dashboard del cliente con KPIs, gráfico de ventas y semáforo financiero
- Cálculo automático de todos los ratios financieros
- Row Level Security: cada empresa ve solo sus datos
- Diseño responsive, dark mode ready

## Próximos módulos (Fase 2)

- Módulo Diagnóstico: formulario guiado de 4 pasos con guardado automático
- Módulo CFO: carga de datos mensuales + proyección de caja
- Módulo Mercado de Capitales: checklist de elegibilidad + productos
- Sistema de reportes con generación PDF
- Notificaciones por email (Resend)

---

## Deploy en Vercel (cuando estés listo)

```bash
npm install -g vercel
vercel
```

Seguí las instrucciones. Vercel detecta Vite automáticamente.
Agregá las variables de entorno en Vercel → tu proyecto → Settings → Environment Variables.

---

## Preguntas frecuentes

**¿Puedo agregar más empresas?**
Sí, directamente desde el SQL Editor de Supabase o desde el panel del asesor (botón "Nueva empresa", a implementar en Fase 2).

**¿Cómo cambio los colores o el nombre del producto?**
- Colores: `tailwind.config.js` → sección `colors`
- Nombre: buscá "CFOConnect" en los archivos JSX
- Logo: reemplazá el icono en `AppShell.jsx` y `LoginPage.jsx`

**¿Funciona en el celular?**
Sí, la app es responsive. El sidebar se adapta en pantallas pequeñas (a implementar en Fase 2 con un menú hamburguesa).
