-- =========================================================
-- INVENTARIO DE LABORATORIOS
-- Usuarios, roles y políticas RLS
-- =========================================================

-- ---------------------------------------------------------
-- 1. Roles de aplicación
-- ---------------------------------------------------------

create type public.inventory_role as enum (
  'admin',
  'operator',
  'viewer'
);

-- ---------------------------------------------------------
-- 2. Perfil público ligado a auth.users
--
-- auth.users no se expone directamente desde la API.
-- Esta tabla guarda los datos mínimos que la app necesita:
-- nombre visible y rol.
-- ---------------------------------------------------------

create table public.profiles (
  id uuid primary key
    references auth.users(id)
    on delete cascade,

  display_name text not null default 'Usuario',

  role public.inventory_role not null default 'viewer',

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint profiles_display_name_not_blank
    check (length(trim(display_name)) > 0)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 3. Crear automáticamente un perfil cuando nace un usuario
-- ---------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    display_name
  )
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Usuario'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

-- ---------------------------------------------------------
-- 4. Funciones reutilizables para RLS
--
-- Las funciones leen profiles sin crear recursión de políticas.
-- ---------------------------------------------------------

create or replace function public.is_inventory_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'::public.inventory_role
  );
$$;

create or replace function public.has_inventory_write_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in (
        'admin'::public.inventory_role,
        'operator'::public.inventory_role
      )
  );
$$;

revoke execute on function public.is_inventory_admin() from public;
revoke execute on function public.has_inventory_write_access() from public;

grant execute on function public.is_inventory_admin() to authenticated;
grant execute on function public.has_inventory_write_access() to authenticated;

-- ---------------------------------------------------------
-- 5. Grants
--
-- Ningún usuario anónimo podrá consultar las tablas.
-- Solo usuarios autenticados podrán pasar a RLS.
-- ---------------------------------------------------------

grant usage on schema public to authenticated;

grant select, insert, update, delete
on table public.profiles
to authenticated;

grant select, insert, update, delete
on table public.laboratories
to authenticated;

grant select, insert, update, delete
on table public.stations
to authenticated;

grant select, insert, update, delete
on table public.assets
to authenticated;

grant select, insert, update, delete
on table public.station_peripherals
to authenticated;

grant select, insert, update, delete
on table public.asset_movements
to authenticated;

revoke all
on table public.profiles
from anon;

revoke all
on table public.laboratories
from anon;

revoke all
on table public.stations
from anon;

revoke all
on table public.assets
from anon;

revoke all
on table public.station_peripherals
from anon;

revoke all
on table public.asset_movements
from anon;

-- ---------------------------------------------------------
-- 6. RLS de perfiles
-- ---------------------------------------------------------

alter table public.profiles enable row level security;

create policy "Usuarios ven su perfil y admins ven todos"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select public.is_inventory_admin())
);

create policy "Admins actualizan perfiles"
on public.profiles
for update
to authenticated
using (
  (select public.is_inventory_admin())
)
with check (
  (select public.is_inventory_admin())
);

-- ---------------------------------------------------------
-- 7. Políticas de lectura
--
-- Todo usuario autenticado puede consultar el inventario.
-- No significa que pueda modificarlo.
-- ---------------------------------------------------------

create policy "Usuarios autenticados leen laboratorios"
on public.laboratories
for select
to authenticated
using (true);

create policy "Usuarios autenticados leen estaciones"
on public.stations
for select
to authenticated
using (true);

create policy "Usuarios autenticados leen activos"
on public.assets
for select
to authenticated
using (true);

create policy "Usuarios autenticados leen perifericos"
on public.station_peripherals
for select
to authenticated
using (true);

create policy "Usuarios autenticados leen movimientos"
on public.asset_movements
for select
to authenticated
using (true);

-- ---------------------------------------------------------
-- 8. Políticas de escritura
--
-- Admin y operador pueden registrar o actualizar inventario.
-- No habrá borrado normal de activos: se usarán estados como
-- retired, lost o damaged.
-- ---------------------------------------------------------

create policy "Operadores crean laboratorios"
on public.laboratories
for insert
to authenticated
with check (
  (select public.has_inventory_write_access())
);

create policy "Operadores actualizan laboratorios"
on public.laboratories
for update
to authenticated
using (
  (select public.has_inventory_write_access())
)
with check (
  (select public.has_inventory_write_access())
);

create policy "Operadores crean estaciones"
on public.stations
for insert
to authenticated
with check (
  (select public.has_inventory_write_access())
);

create policy "Operadores actualizan estaciones"
on public.stations
for update
to authenticated
using (
  (select public.has_inventory_write_access())
)
with check (
  (select public.has_inventory_write_access())
);

create policy "Operadores registran activos"
on public.assets
for insert
to authenticated
with check (
  (select public.has_inventory_write_access())
);

create policy "Operadores actualizan activos"
on public.assets
for update
to authenticated
using (
  (select public.has_inventory_write_access())
)
with check (
  (select public.has_inventory_write_access())
);

create policy "Operadores registran perifericos"
on public.station_peripherals
for insert
to authenticated
with check (
  (select public.has_inventory_write_access())
);

create policy "Operadores actualizan perifericos"
on public.station_peripherals
for update
to authenticated
using (
  (select public.has_inventory_write_access())
)
with check (
  (select public.has_inventory_write_access())
);

-- Los movimientos son históricos:
-- se pueden crear, pero no editar ni borrar desde la app.

create policy "Operadores registran movimientos propios"
on public.asset_movements
for insert
to authenticated
with check (
  (select public.has_inventory_write_access())
  and performed_by = (select auth.uid())
);