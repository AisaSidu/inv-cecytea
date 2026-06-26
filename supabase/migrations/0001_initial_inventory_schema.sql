-- =========================================================
-- INVENTARIO DE LABORATORIOS
-- Migración inicial
-- =========================================================

-- ---------------------------------------------------------
-- 1. Tipos controlados
-- ---------------------------------------------------------

create type public.asset_type as enum (
  'cpu',
  'monitor'
);

create type public.asset_status as enum (
  'available',
  'assigned',
  'maintenance',
  'damaged',
  'retired',
  'lost'
);

create type public.station_status as enum (
  'active',
  'inactive',
  'maintenance'
);

create type public.peripheral_type as enum (
  'keyboard',
  'mouse',
  'headset',
  'speakers',
  'webcam',
  'ups',
  'other'
);

create type public.peripheral_condition as enum (
  'good',
  'damaged',
  'mixed',
  'not_applicable'
);

create type public.movement_type as enum (
  'assignment',
  'transfer',
  'unassignment',
  'replacement',
  'maintenance',
  'status_change'
);

-- ---------------------------------------------------------
-- 2. Función reutilizable para updated_at
-- ---------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------
-- 3. Laboratorios
-- Ejemplo de código: LAB-CIBER
-- ---------------------------------------------------------

create table public.laboratories (
  id uuid primary key default gen_random_uuid(),

  code text not null unique,
  name text not null,

  building text,
  description text,

  is_active boolean not null default true,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint laboratories_code_uppercase
    check (code = upper(code)),

  constraint laboratories_code_not_blank
    check (length(trim(code)) > 0),

  constraint laboratories_name_not_blank
    check (length(trim(name)) > 0)
);

-- ---------------------------------------------------------
-- 4. Estaciones de trabajo
-- Ejemplo de código: EST-001
-- ---------------------------------------------------------

create table public.stations (
  id uuid primary key default gen_random_uuid(),

  code text not null unique,

  laboratory_id uuid not null
    references public.laboratories(id)
    on delete restrict,

  location_label text,
  notes text,

  status public.station_status not null default 'active',

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint stations_code_uppercase
    check (code = upper(code)),

  constraint stations_code_not_blank
    check (length(trim(code)) > 0)
);

create index stations_laboratory_id_idx
  on public.stations(laboratory_id);

-- ---------------------------------------------------------
-- 5. Activos principales con QR individual
-- Por ahora: CPU y monitor.
--
-- Ejemplos:
-- CPU-001
-- MON-001
-- ---------------------------------------------------------

create table public.assets (
  id uuid primary key default gen_random_uuid(),

  asset_code text not null unique,
  asset_type public.asset_type not null,

  brand text,
  model text,

  serial_number text unique,

  station_id uuid
    references public.stations(id)
    on delete restrict,

  status public.asset_status not null default 'available',

  purchase_date date,
  warranty_until date,

  notes text,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint assets_code_uppercase
    check (asset_code = upper(asset_code)),

  constraint assets_code_not_blank
    check (length(trim(asset_code)) > 0)
);

create index assets_station_id_idx
  on public.assets(station_id);

create index assets_asset_type_idx
  on public.assets(asset_type);

create index assets_status_idx
  on public.assets(status);

-- Una estación puede tener como máximo:
-- 1 CPU y 1 monitor activos/asignados.
--
-- Esto protege justo el problema que te comentó el prefecto:
-- evitar que se pierda la relación entre CPU y monitor.
create unique index assets_one_item_per_type_per_station_idx
  on public.assets(station_id, asset_type)
  where station_id is not null;

-- ---------------------------------------------------------
-- 6. Checklist de periféricos por estación
--
-- No habrá QR individual para mouse, teclado o audífonos.
-- Se registran como parte de la estación.
-- ---------------------------------------------------------

create table public.station_peripherals (
  id uuid primary key default gen_random_uuid(),

  station_id uuid not null
    references public.stations(id)
    on delete restrict,

  peripheral_type public.peripheral_type not null,

  expected_quantity smallint not null default 1,
  present_quantity smallint not null default 0,

  condition public.peripheral_condition not null default 'good',

  notes text,

  last_checked_at timestamptz,
  last_checked_by uuid references auth.users(id)
    on delete set null,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint station_peripherals_expected_quantity_valid
    check (expected_quantity > 0),

  constraint station_peripherals_present_quantity_valid
    check (
      present_quantity >= 0
      and present_quantity <= expected_quantity
    ),

  constraint station_peripherals_one_type_per_station
    unique (station_id, peripheral_type)
);

create index station_peripherals_station_id_idx
  on public.station_peripherals(station_id);

-- ---------------------------------------------------------
-- 7. Historial de movimientos
--
-- Esta tabla es el "rastro" del sistema.
-- Aquí sabrás cuándo una CPU o monitor fue movido,
-- reemplazado, dado de baja o enviado a mantenimiento.
-- ---------------------------------------------------------

create table public.asset_movements (
  id uuid primary key default gen_random_uuid(),

  asset_id uuid not null
    references public.assets(id)
    on delete restrict,

  movement_type public.movement_type not null,

  from_station_id uuid
    references public.stations(id)
    on delete restrict,

  to_station_id uuid
    references public.stations(id)
    on delete restrict,

  previous_status public.asset_status,
  new_status public.asset_status,

  reason text,
  notes text,

  performed_by uuid references auth.users(id)
    on delete set null,

  created_at timestamptz not null default timezone('utc', now())
);

create index asset_movements_asset_id_created_at_idx
  on public.asset_movements(asset_id, created_at desc);

create index asset_movements_to_station_id_idx
  on public.asset_movements(to_station_id);

create index asset_movements_from_station_id_idx
  on public.asset_movements(from_station_id);

-- ---------------------------------------------------------
-- 8. Triggers para mantener updated_at automáticamente
-- ---------------------------------------------------------

create trigger laboratories_set_updated_at
before update on public.laboratories
for each row
execute function public.set_updated_at();

create trigger stations_set_updated_at
before update on public.stations
for each row
execute function public.set_updated_at();

create trigger assets_set_updated_at
before update on public.assets
for each row
execute function public.set_updated_at();

create trigger station_peripherals_set_updated_at
before update on public.station_peripherals
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 9. Seguridad
--
-- Por ahora activamos RLS sin abrir políticas públicas.
-- Eso significa que React todavía NO podrá leer ni modificar
-- datos hasta que agreguemos autenticación y permisos.
--
-- Es intencional: primero dejamos cerrada la puerta,
-- después damos acceso correcto a cada rol.
-- ---------------------------------------------------------

alter table public.laboratories enable row level security;
alter table public.stations enable row level security;
alter table public.assets enable row level security;
alter table public.station_peripherals enable row level security;
alter table public.asset_movements enable row level security;