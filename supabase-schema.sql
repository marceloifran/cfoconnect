-- ═══════════════════════════════════════════════════════════════
-- CFOConnect — Schema completo para Supabase
-- Ejecutar en: supabase.com → tu proyecto → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- ── Extensiones ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Limpiar si ya existe (útil para re-runs) ──────────────────
drop table if exists operaciones_mercado cascade;
drop table if exists reportes cascade;
drop table if exists alertas cascade;
drop table if exists proyeccion_caja cascade;
drop table if exists ratios_calculados cascade;
drop table if exists diagnostico cascade;
drop table if exists periodos_financieros cascade;
drop table if exists usuarios cascade;
drop table if exists empresas cascade;

-- ═══════════════════════════════════════════════════════════════
-- TABLA: empresas
-- ═══════════════════════════════════════════════════════════════
create table empresas (
  id              uuid primary key default uuid_generate_v4(),
  nombre          text not null,
  cuit            text,
  rubro           text,
  localidad       text,
  provincia       text default 'Salta',
  plan_servicio   text,           -- 'diagnostico' | 'cfo_basico' | 'cfo_medio' | 'cfo_full'
  etapa_numero    int  default 1, -- 1=Onboarding 2=Diagnóstico 3=CFO activo 4=Mercado 5=Estratégico
  asesor_nombre   text,
  activa          boolean default true,
  created_at      timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: usuarios
-- Vinculada a auth.users de Supabase
-- ═══════════════════════════════════════════════════════════════
create table usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  empresa_id  uuid references empresas(id) on delete set null,
  nombre      text,
  rol         text not null default 'cliente', -- 'asesor' | 'cliente'
  activo      boolean default true,
  created_at  timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: periodos_financieros
-- Un registro por mes/trimestre/año por empresa
-- ═══════════════════════════════════════════════════════════════
create table periodos_financieros (
  id                  uuid primary key default uuid_generate_v4(),
  empresa_id          uuid not null references empresas(id) on delete cascade,
  periodo             text not null,       -- ej: '2024-T1', '2024-01', '2024'
  tipo_periodo        text default 'mes',  -- 'mes' | 'trimestre' | 'año'

  -- P&L
  ventas_netas        numeric default 0,
  costo_ventas        numeric default 0,
  gastos_comerciales  numeric default 0,
  gastos_admin        numeric default 0,
  gastos_personal     numeric default 0,
  amortizaciones      numeric default 0,
  resultado_financiero numeric default 0,  -- negativo = gasto financiero

  -- Balance (snapshot al cierre del período)
  activo_corriente    numeric default 0,
  pasivo_corriente    numeric default 0,
  stock               numeric default 0,
  deuda_total         numeric default 0,
  intereses_pagados   numeric default 0,
  patrimonio_neto     numeric default 0,

  -- Ciclo operativo
  dias_cobro          int default 0,
  dias_stock          int default 0,
  dias_pago           int default 0,

  notas               text,
  created_at          timestamptz default now(),

  unique(empresa_id, periodo)
);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: diagnostico
-- Información cualitativa del Bloque 1
-- ═══════════════════════════════════════════════════════════════
create table diagnostico (
  id              uuid primary key default uuid_generate_v4(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  estado          text default 'borrador', -- 'borrador' | 'completo'

  -- 1.2 Modelo de negocio
  lineas_negocio      text,
  estacionalidad      text,
  concentracion_top3  numeric,  -- % ventas del top 3 clientes
  factura_usd         boolean default false,
  exporta             boolean default false,
  pct_exportacion     numeric,

  -- 1.3 Costos
  principal_costo     text,
  pct_costos_fijos    numeric,
  compra_importado    boolean default false,

  -- 1.4 Dueño
  dolor_principal         text,
  decision_pendiente      text,
  experiencia_bancaria    text,
  conoce_mercado_capitales boolean default false,
  objetivo_12meses        text,
  notas_analista          text,

  -- Garantías disponibles (jsonb flexible)
  garantias           jsonb default '{}',

  -- Detalle deuda (array de objetos)
  detalle_deuda       jsonb default '[]',

  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),

  unique(empresa_id)
);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: alertas
-- Generadas automáticamente o manualmente por el asesor
-- ═══════════════════════════════════════════════════════════════
create table alertas (
  id          uuid primary key default uuid_generate_v4(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  tipo        text,     -- 'liquidez' | 'deuda' | 'oportunidad' | 'vencimiento' | 'general'
  nivel       text,     -- 'critico' | 'alto' | 'info'
  mensaje     text not null,
  leida       boolean default false,
  created_at  timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: reportes
-- Archivos generados (links a Supabase Storage)
-- ═══════════════════════════════════════════════════════════════
create table reportes (
  id          uuid primary key default uuid_generate_v4(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  tipo        text,  -- 'diagnostico' | 'ejecutivo_mensual' | 'flujo_caja' | 'mercado'
  periodo     text,
  titulo      text,
  url_archivo text,
  estado      text default 'disponible', -- 'disponible' | 'en_proceso' | 'proximo'
  created_at  timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: operaciones_mercado
-- Registro de productos del mercado de capitales
-- ═══════════════════════════════════════════════════════════════
create table operaciones_mercado (
  id          uuid primary key default uuid_generate_v4(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  producto    text,   -- 'descuento_echeqs' | 'fci' | 'caucion' | 'on_pyme' | 'sgr' | 'fideicomiso'
  descripcion text,
  monto       numeric,
  tasa        numeric,
  estado      text default 'evaluacion', -- 'evaluacion' | 'en_proceso' | 'activa' | 'cerrada'
  fecha_inicio date,
  fecha_vto    date,
  notas       text,
  created_at  timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: proyeccion_caja
-- Cash flow a 13 semanas
-- ═══════════════════════════════════════════════════════════════
create table proyeccion_caja (
  id                  uuid primary key default uuid_generate_v4(),
  empresa_id          uuid not null references empresas(id) on delete cascade,
  periodo_base        text,
  semana              int,
  fecha_semana        date,
  cobros_esperados    numeric default 0,
  pagos_previstos     numeric default 0,
  saldo_proyectado    numeric,
  alerta              text,  -- 'ok' | 'precaucion' | 'critico'
  notas               text,
  created_at          timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- CRÍTICO: garantiza que cada empresa ve SOLO sus datos
-- ═══════════════════════════════════════════════════════════════

alter table empresas              enable row level security;
alter table usuarios              enable row level security;
alter table periodos_financieros  enable row level security;
alter table diagnostico           enable row level security;
alter table alertas               enable row level security;
alter table reportes              enable row level security;
alter table operaciones_mercado   enable row level security;
alter table proyeccion_caja       enable row level security;

-- Helper function: obtiene empresa_id del usuario autenticado
create or replace function get_user_empresa_id()
returns uuid language sql security definer as $$
  select empresa_id from usuarios where id = auth.uid()
$$;

-- Helper function: verifica si el usuario es asesor
create or replace function is_asesor()
returns boolean language sql security definer as $$
  select exists(select 1 from usuarios where id = auth.uid() and rol = 'asesor')
$$;

-- ── Políticas: empresas ──────────────────────────────────────
create policy "asesor: ver todas" on empresas
  for select using (is_asesor());

create policy "cliente: ver solo la propia" on empresas
  for select using (id = get_user_empresa_id());

create policy "asesor: crear/editar" on empresas
  for all using (is_asesor());

-- ── Políticas: usuarios ──────────────────────────────────────
create policy "ver perfil propio" on usuarios
  for select using (id = auth.uid() or is_asesor());

create policy "asesor: gestionar usuarios" on usuarios
  for all using (is_asesor());

-- ── Políticas: periodos_financieros ──────────────────────────
create policy "asesor: todo" on periodos_financieros
  for all using (is_asesor());

create policy "cliente: su empresa" on periodos_financieros
  for all using (empresa_id = get_user_empresa_id());

-- ── Políticas: diagnostico ────────────────────────────────────
create policy "asesor: todo" on diagnostico
  for all using (is_asesor());

create policy "cliente: su empresa" on diagnostico
  for all using (empresa_id = get_user_empresa_id());

-- ── Políticas: alertas ────────────────────────────────────────
create policy "asesor: todo" on alertas
  for all using (is_asesor());

create policy "cliente: ver sus alertas" on alertas
  for select using (empresa_id = get_user_empresa_id());

-- ── Políticas: reportes ───────────────────────────────────────
create policy "asesor: todo" on reportes
  for all using (is_asesor());

create policy "cliente: ver sus reportes" on reportes
  for select using (empresa_id = get_user_empresa_id());

-- ── Políticas: operaciones_mercado ────────────────────────────
create policy "asesor: todo" on operaciones_mercado
  for all using (is_asesor());

create policy "cliente: ver sus operaciones" on operaciones_mercado
  for select using (empresa_id = get_user_empresa_id());

-- ── Políticas: proyeccion_caja ────────────────────────────────
create policy "asesor: todo" on proyeccion_caja
  for all using (is_asesor());

create policy "cliente: su empresa" on proyeccion_caja
  for all using (empresa_id = get_user_empresa_id());

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: sync usuario al registrarse en auth.users
-- ═══════════════════════════════════════════════════════════════
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into usuarios (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', new.email),
    coalesce(new.raw_user_meta_data->>'rol', 'cliente')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- DATOS DE PRUEBA (seed) — borrar en producción
-- ═══════════════════════════════════════════════════════════════

-- Empresa 1: Molinos del NOA
insert into empresas (id, nombre, cuit, rubro, localidad, plan_servicio, etapa_numero, asesor_nombre)
values (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Molinos del NOA SA',
  '30-71234567-8',
  'Agroindustria',
  'Salta',
  'CFO Externo Tier Medio',
  2,
  'Santiago Pérez'
);

-- Empresa 2: Constructora Andina
insert into empresas (id, nombre, cuit, rubro, localidad, plan_servicio, etapa_numero, asesor_nombre)
values (
  'a1b2c3d4-0000-0000-0000-000000000002',
  'Constructora Andina SRL',
  '30-71234568-0',
  'Construcción',
  'Salta',
  'CFO Externo Tier Full',
  3,
  'Santiago Pérez'
);

-- Periodos para Molinos
insert into periodos_financieros (empresa_id, periodo, tipo_periodo,
  ventas_netas, costo_ventas, gastos_admin, gastos_personal,
  activo_corriente, pasivo_corriente, stock, deuda_total, patrimonio_neto,
  intereses_pagados, dias_cobro, dias_stock, dias_pago)
values
  ('a1b2c3d4-0000-0000-0000-000000000001', '2023', 'año',
   186000000, 112000000, 15000000, 13000000,
   38000000, 29000000, 12000000, 85000000, 62000000,
   8500000, 45, 30, 20),
  ('a1b2c3d4-0000-0000-0000-000000000002', '2023', 'año',
   512000000, 358000000, 38000000, 34000000,
   95000000, 67000000, 8000000, 210000000, 185000000,
   18000000, 60, 15, 30);

-- Alertas demo
insert into alertas (empresa_id, tipo, nivel, mensaje)
values
  ('a1b2c3d4-0000-0000-0000-000000000001', 'liquidez', 'critico',
   'Liquidez corriente 1.31x — debajo del umbral recomendado de 1.5x'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'oportunidad', 'info',
   'ECHEQs disponibles sin aprovechar — oportunidad de descuento bursátil');
