# CFOConnect — Plataforma de Asesoría Financiera Inteligente

CFOConnect es una plataforma B2B diseñada para digitalizar y escalar el servicio de asesoramiento financiero para PyMEs. El sistema centraliza la gestión de múltiples clientes, automatiza cálculos de rentabilidad y liquidez, y utiliza Inteligencia Artificial para redactar reportes ejecutivos de manera automatizada.

El sistema está diseñado bajo un enfoque **100% Mobile-First**, permitiendo a los usuarios (tanto asesores como directores de empresas) operar completamente desde sus dispositivos móviles con interfaces basadas en tarjetas (*Cards*), eliminando la necesidad de visualizar complejas y extensas planillas de cálculo.

---

## 👥 Arquitectura de Roles

El sistema cuenta con un control de acceso basado en roles (RBAC) que define estrictamente lo que cada usuario puede ver y hacer:

1. **Administrador (`admin`)**
   - Tiene el control total de la plataforma.
   - Crea nuevas empresas, gestiona los accesos y contraseñas.
   - Administra el equipo de asesores (`alta/baja/modificación`).
   - Define qué empresa es atendida por qué asesor (matriz de asignaciones).
   - Actualiza de forma global los **Indicadores de Mercado Macro** (Dólar, Tasas, Financiamiento) que todos los clientes consumen en sus portales.

2. **Asesor Financiero (`asesor`)**
   - Es el operador principal del sistema.
   - Visualiza únicamente las empresas que el administrador le ha asignado.
   - Actúa como el "CFO Virtual" de sus clientes: carga presupuestos, actualiza el flujo de caja, y aprueba/audita el estado de los diagnósticos.
   - Genera los reportes ejecutivos impulsados por Inteligencia Artificial para enviarlos a los directores de las PyMEs.

3. **Cliente / Empresa (`cliente`)**
   - Es el usuario final (ej: el Director o Dueño de la PyME).
   - Solo tiene acceso a los datos de su propia empresa (garantizado por políticas de Row Level Security en la base de datos).
   - Visualiza dashboards de alto nivel con KPIs, métricas de ventas y semáforos de riesgo.
   - Interactúa con el módulo de diagnóstico para conocer el estado de salud financiera de su empresa y descubre oportunidades de financiamiento en el mercado de capitales.

---

## 🧩 Módulos Funcionales

### 1. Dashboard de Control (Tablero de Comando)
Ofrece una radiografía instantánea del estado de la empresa mediante:
- **KPIs Financieros**: Rentabilidad, liquidez, nivel de endeudamiento.
- **Gráficos Históricos**: Evolución de ventas y costos.
- **Semáforo de Riesgo**: Sistema de alertas automáticas (Rojo/Ámbar/Verde) basado en reglas de negocio duras (ej: si Liquidez Corriente < 1.0, estado Rojo).

### 2. Módulo de Diagnóstico y Scoring (Score SGR)
Un sistema de evaluación estructurado donde el cliente responde preguntas clave sobre su nivel de profesionalización, gestión contable y situación patrimonial. 
- El sistema pondera las respuestas y emite un puntaje de **0 a 100 (Score SGR)**.
- Dependiendo del score, clasifica a la empresa en etapas (Inicial, En Desarrollo, Optimizada) habilitándola para distintas líneas de crédito.

### 3. CFO Virtual (Presupuesto y Cash Flow)
El núcleo operativo de la asesoría financiera.
- **Presupuesto Anual (12 Meses)**: Carga y seguimiento de ventas, costos de mercadería y gastos fijos para determinar el EBITDA estimado. Compara valores presupuestados vs reales con cálculo automático de desvíos.
- **Cash Flow a 13 Semanas**: Proyección de liquidez de muy corto plazo. Cruza cobros esperados con pagos previstos para alertar sobre faltantes de caja. Emite "Recomendaciones automáticas" basadas en la magnitud del déficit (ej: Descontar cheques, Caución bursátil, etc.).
- **Reporte Ejecutivo con IA**: Utiliza el motor de **Claude (Anthropic)** para procesar toda la matriz financiera y el Cash Flow, redactando automáticamente un reporte profesional de situación, riesgos y compromisos.

### 4. Mercado de Capitales
Un espacio donde la empresa visualiza:
- Su elegibilidad técnica para emitir instrumentos financieros (Pagarés bursátiles, Cheques de pago diferido).
- Los indicadores macroeconómicos actualizados por la administración (Tasa BADLAR, Dólar MEP, etc.) para tomar decisiones de cobertura de capital.

---

## 🗄️ Modelo y Estructura de Base de Datos

El backend está soportado por **Supabase (PostgreSQL)**. La estructura relacional garantiza la integridad de los datos financieros:

- `usuarios`: Tabla extendida de autenticación. Contiene el nombre, el `rol` (admin, asesor, cliente), el estado de actividad (`activo`) y una clave foránea `empresa_id` (solo aplicable a clientes).
- `empresas`: Entidad principal del negocio. Almacena la razón social, CUIT, rubro, etapa de profesionalización y metadatos operativos.
- `asignaciones`: Tabla pivot (relación Muchos a Muchos) que vincula `usuarios (asesores)` con `empresas`. Permite que un asesor gestione `N` empresas, y que una empresa sea auditada por `N` asesores si fuese necesario.
- `diagnosticos`: Almacena el histórico de las evaluaciones de la empresa, guardando el payload JSON de respuestas y el puntaje SGR obtenido.
- `periodos_financieros`: El corazón contable. Guarda los datos sumarizados por período mensual (`periodo`, ej: "2025-01" o "2025-presupuesto-01") vinculados a una `empresa_id`. Almacena ventas netas, costos, gastos comerciales y de personal.
- `proyeccion_caja`: Guarda el flujo de caja semanal. Vincula `empresa_id`, un `periodo_base` (ej: "2025-S1"), número de semana, cobros y pagos esperados.
- `indicadores_mercado`: Tabla global (no atada a empresas) donde la administración mantiene actualizadas las variables macro (Tasa, Dólar, Inflación) mediante `key-value` estructurado.

### Seguridad (RLS - Row Level Security)
Toda la lógica de acceso a la base de datos está protegida a nivel de fila (RLS). 
- Un asesor solo puede leer/modificar `periodos_financieros` de las empresas a las que está explícitamente vinculado en la tabla de `asignaciones`.
- Un cliente solo puede consultar la fila de la tabla `empresas` cuyo ID coincide con el `empresa_id` de su propio usuario, haciendo imposible que se filtren datos de rentabilidad entre competidores dentro del sistema.
