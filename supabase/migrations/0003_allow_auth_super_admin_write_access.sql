-- =========================================================
-- INVENTARIO DE LABORATORIOS
-- Permisos de super administrador de Supabase Auth
-- =========================================================

-- La app usa public.profiles.role para permisos normales.
-- Este helper permite que una cuenta marcada manualmente como
-- auth.users.is_super_admin = true pueda probar y administrar inventario
-- sin abrir escritura a usuarios autenticados comunes.

create or replace function public.is_inventory_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where id = (select auth.uid())
      and is_super_admin is true
  );
$$;

create or replace function public.is_inventory_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.is_inventory_super_admin())
    or exists (
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
  select
    (select public.is_inventory_super_admin())
    or exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role in (
          'admin'::public.inventory_role,
          'operator'::public.inventory_role
        )
    );
$$;

revoke execute on function public.is_inventory_super_admin() from public;
revoke execute on function public.is_inventory_admin() from public;
revoke execute on function public.has_inventory_write_access() from public;

grant execute on function public.is_inventory_super_admin() to authenticated;
grant execute on function public.is_inventory_admin() to authenticated;
grant execute on function public.has_inventory_write_access() to authenticated;
