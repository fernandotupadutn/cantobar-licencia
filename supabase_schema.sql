-- ============================================================
-- Esquema de base de datos para CantoBar POS (con autenticación
-- y control de acceso por roles: admin / vendedor)
-- Ejecutar en el SQL Editor de tu proyecto Supabase
--
-- ⚠️  IDEMPOTENTE: podés volver a ejecutarlo las veces que
-- necesites sin romper nada (por ejemplo, para aplicar esta
-- versión con el endurecimiento de seguridad sobre una base
-- ya existente).
--
-- Cambios de seguridad incluidos:
--   * CHECK constraints (montos, cantidades, subtotales).
--   * Trigger que recalcula el total de la venta desde sus items.
--   * Trigger que valida el precio contra el catálogo.
--   * Trigger que impide quitarle el rol admin al último admin.
--   * Función RPC create_sale(): única vía de escritura sobre
--     ventas; calcula precios y totales en el servidor.
--   * Se revoca INSERT/UPDATE/DELETE de sales y sale_items a
--     anon/authenticated: la DB solo acepta lo que pasa por RPC.
-- ============================================================

create extension if not exists "pgcrypto";

-- Enum de métodos de pago. Definido de forma idempotente porque en bases
-- existentes la columna sales.payment_method ya es de este tipo.
do $$
begin
  create type public.payment_method_enum as enum ('Efectivo', 'Transferencia', 'MercadoPago');
exception when duplicate_object then null;
end $$;

-- Agrega 'MercadoPago' al enum si la base ya lo tenía definido con
-- solo los dos métodos originales. Es idempotente.
do $$
begin
  alter type public.payment_method_enum
    add value if not exists 'MercadoPago';
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- Tabla de perfiles: 1 a 1 con auth.users, guarda el rol de cada
-- usuario. auth.users NO es accesible directamente desde el
-- cliente, por eso se refleja acá lo mínimo necesario.
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'vendedor' check (role in ('admin', 'vendedor'))
);

-- Trigger: cada vez que se crea un usuario en auth.users (vía
-- signUp), se crea automáticamente su fila en profiles con rol
-- 'vendedor' por defecto. El primer usuario que crees a mano
-- convertilo en 'admin' (ver instrucciones al final del archivo).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'vendedor'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- Resto de las tablas del POS
-- ------------------------------------------------------------
create table if not exists local_config (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'CantoBar',
  subtitle text not null default 'Punto de venta',
  address text not null default '',
  phone text not null default '',
  cuit text not null default '',
  ticket_footer_message text not null default '¡Gracias por tu visita!'
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists drinks (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete restrict,
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null default 0,
  is_available boolean not null default true
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  total_amount numeric(10, 2) not null,
  payment_method payment_method_enum not null,
  seller_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  mp_order_id text,
  mp_payment_id text
);

-- Referencias de Mercado Pago (idempotente para bases existentes).
do $$
begin
  alter table public.sales add column if not exists mp_order_id text;
exception when duplicate_column then null;
end $$;

do $$
begin
  alter table public.sales add column if not exists mp_payment_id text;
exception when duplicate_column then null;
end $$;

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  drink_id uuid references drinks(id) on delete set null,
  drink_name text not null,
  unit_price numeric(10, 2) not null,
  quantity integer not null,
  subtotal numeric(10, 2) not null
);

-- Datos de ejemplo (opcional)
insert into local_config (name, subtitle, address, phone, cuit, ticket_footer_message)
values ('CantoBar', 'Punto de venta', 'Av. Siempre Viva 123', '11-2345-6789', '20-12345678-9', '¡Gracias por tu visita, volvé pronto!')
on conflict do nothing;

-- ============================================================
-- Row Level Security por rol
-- ============================================================
alter table profiles enable row level security;
alter table local_config enable row level security;
alter table categories enable row level security;
alter table drinks enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;

-- ============================================================
-- Funciones
-- ============================================================

-- Helper: ¿el usuario logueado es admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- create_sale(): ÚNICA vía para registrar ventas.
-- Security definer (corre con privilegios de postgres, dueño de
-- las tablas) pero autoriza internamente con auth.uid() y NO
-- acepta precios ni totales del cliente: toma precio, nombre y
-- disponibilidad del catálogo en el servidor. Todo en una sola
-- transacción.
-- ------------------------------------------------------------
create or replace function public.create_sale(
  p_payment_method text,
  p_items jsonb,
  p_mp_order_id text default null,
  p_mp_payment_id text default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_seller uuid := auth.uid();
  v_sale_id uuid;
  v_total numeric(10, 2) := 0;
  v_item jsonb;
  v_drink_id uuid;
  v_quantity integer;
  v_price numeric(10, 2);
  v_result jsonb;
begin
  if v_seller is null then
    raise exception 'No autenticado';
  end if;

  if p_payment_method not in ('Efectivo', 'Transferencia', 'MercadoPago') then
    raise exception 'Método de pago inválido';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrito vacío';
  end if;

  insert into sales (seller_id, payment_method, total_amount, mp_order_id, mp_payment_id)
  values (v_seller, p_payment_method::payment_method_enum, 0, p_mp_order_id, p_mp_payment_id)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_drink_id := (v_item->>'drink_id')::uuid;
    v_quantity := (v_item->>'quantity')::int;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Cantidad inválida para el item %', v_drink_id;
    end if;

    -- Precio, nombre y disponibilidad se resuelven acá, en el servidor.
    select price into v_price
    from public.drinks
    where id = v_drink_id and is_available;

    if v_price is null then
      raise exception 'Bebida no disponible: %', v_drink_id;
    end if;

    v_total := v_total + (v_price * v_quantity);

    insert into public.sale_items (sale_id, drink_id, drink_name, unit_price, quantity, subtotal)
    select v_sale_id, id, name, price, v_quantity, (price * v_quantity)
    from public.drinks
    where id = v_drink_id;
  end loop;

  update public.sales set total_amount = v_total where id = v_sale_id;

  select jsonb_build_object(
    'id', s.id,
    'total_amount', s.total_amount,
    'payment_method', s.payment_method,
    'seller_id', s.seller_id,
    'created_at', s.created_at,
    'mp_order_id', s.mp_order_id,
    'mp_payment_id', s.mp_payment_id,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', si.id,
        'sale_id', si.sale_id,
        'drink_id', si.drink_id,
        'drink_name', si.drink_name,
        'unit_price', si.unit_price,
        'quantity', si.quantity,
        'subtotal', si.subtotal
      )), '[]'::jsonb)
      from public.sale_items si where si.sale_id = s.id
    )
  ) into v_result
  from public.sales s where s.id = v_sale_id;

  return v_result;
end;
$$;

-- Nadie puede llamar create_sale sin estar logueado.
revoke execute on function public.create_sale(text, jsonb, text, text) from public;
grant execute on function public.create_sale(text, jsonb, text, text) to authenticated;

-- ------------------------------------------------------------
-- Trigger: recalcula sales.total_amount desde sale_items cada vez
-- que cambia algún item. Así el total siempre es la suma real de
-- subtotales, pase lo que pase (aunque el cliente ya no puede
-- escribir estas tablas, es defensa en profundidad).
-- ------------------------------------------------------------
create or replace function public.recompute_sale_total()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_sale_id uuid;
  v_total numeric(10, 2);
begin
  v_sale_id := coalesce(new.sale_id, old.sale_id);

  select coalesce(sum(subtotal), 0) into v_total
  from public.sale_items
  where sale_id = v_sale_id;

  update public.sales set total_amount = v_total where id = v_sale_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recompute_sale_total on sale_items;
create trigger trg_recompute_sale_total
  after insert or update or delete on sale_items
  for each row execute function public.recompute_sale_total();

-- ------------------------------------------------------------
-- Trigger: valida que el precio grabado en el item coincida con
-- el precio actual del catálogo. Defensa en profundidad (la única
-- vía de escritura, create_sale, ya lo garantiza).
-- ------------------------------------------------------------
create or replace function public.validate_sale_item_price()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.drink_id is not null and new.unit_price <> (
    select price from public.drinks where id = new.drink_id
  ) then
    raise exception 'El precio del item no coincide con el catálogo';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_sale_item_price on sale_items;
create trigger trg_validate_sale_item_price
  before insert or update on sale_items
  for each row execute function public.validate_sale_item_price();

-- ------------------------------------------------------------
-- Trigger: impide que un admin se quite el rol admin si es el
-- último admin del sistema (evita dejarse la app sin administradores).
-- ------------------------------------------------------------
create or replace function public.prevent_last_admin_demotion()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.role = 'admin' and new.role <> 'admin' then
    if not exists (
      select 1 from public.profiles
      where role = 'admin' and id <> old.id
    ) then
      raise exception 'No se puede quitar el rol admin al último administrador';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_last_admin_demotion on profiles;
create trigger trg_prevent_last_admin_demotion
  before update on profiles
  for each row execute function public.prevent_last_admin_demotion();

-- ============================================================
-- Políticas RLS
-- ============================================================

-- --- profiles ---
drop policy if exists "profiles: lectura para logueados" on profiles;
create policy "profiles: lectura para logueados" on profiles
  for select using (auth.uid() is not null);
drop policy if exists "profiles: escritura solo admin" on profiles;
create policy "profiles: escritura solo admin" on profiles
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "profiles: insert solo admin" on profiles;
create policy "profiles: insert solo admin" on profiles
  for insert with check (public.is_admin());

-- --- local_config ---
drop policy if exists "local_config: lectura para logueados" on local_config;
create policy "local_config: lectura para logueados" on local_config
  for select using (auth.uid() is not null);
drop policy if exists "local_config: escritura solo admin" on local_config;
create policy "local_config: escritura solo admin" on local_config
  for all using (public.is_admin()) with check (public.is_admin());

-- --- categories ---
drop policy if exists "categories: lectura para logueados" on categories;
create policy "categories: lectura para logueados" on categories
  for select using (auth.uid() is not null);
drop policy if exists "categories: insert solo admin" on categories;
create policy "categories: insert solo admin" on categories
  for insert with check (public.is_admin());
drop policy if exists "categories: update solo admin" on categories;
create policy "categories: update solo admin" on categories
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "categories: delete solo admin" on categories;
create policy "categories: delete solo admin" on categories
  for delete using (public.is_admin());

-- --- drinks ---
drop policy if exists "drinks: lectura para logueados" on drinks;
create policy "drinks: lectura para logueados" on drinks
  for select using (auth.uid() is not null);
drop policy if exists "drinks: insert solo admin" on drinks;
create policy "drinks: insert solo admin" on drinks
  for insert with check (public.is_admin());
drop policy if exists "drinks: update solo admin" on drinks;
create policy "drinks: update solo admin" on drinks
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "drinks: delete solo admin" on drinks;
create policy "drinks: delete solo admin" on drinks
  for delete using (public.is_admin());

-- --- sales: SOLO lectura directa. Las escrituras van por
-- create_sale() (RPC). Además se revocan los privilegios más abajo.
drop policy if exists "sales: lectura para logueados" on sales;
create policy "sales: lectura para logueados" on sales
  for select using (auth.uid() is not null);
drop policy if exists "sales: insert propio" on sales;

-- --- sale_items: SOLO lectura directa.
drop policy if exists "sale_items: lectura para logueados" on sale_items;
create policy "sale_items: lectura para logueados" on sale_items
  for select using (auth.uid() is not null);
drop policy if exists "sale_items: insert para logueados" on sale_items;

-- ============================================================
-- Revoke de privilegios sobre ventas: la única forma de escribir
-- es create_sale() (función security definer del dueño de tablas).
-- anon/authenticated no pueden insertar, actualizar ni borrar
-- sales o sale_items directamente.
-- ============================================================
revoke insert, update, delete on public.sales from anon, authenticated;
revoke insert, update, delete on public.sale_items from anon, authenticated;

-- ============================================================
-- CHECK constraints (idempotentes): integridad de montos.
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'drinks_price_non_negative'
      and conrelid = 'public.drinks'::regclass
  ) then
    alter table public.drinks add constraint drinks_price_non_negative check (price >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sales_total_amount_non_negative'
      and conrelid = 'public.sales'::regclass
  ) then
    alter table public.sales add constraint sales_total_amount_non_negative check (total_amount >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sale_items_quantity_positive'
      and conrelid = 'public.sale_items'::regclass
  ) then
    alter table public.sale_items add constraint sale_items_quantity_positive check (quantity > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sale_items_unit_price_non_negative'
      and conrelid = 'public.sale_items'::regclass
  ) then
    alter table public.sale_items add constraint sale_items_unit_price_non_negative check (unit_price >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sale_items_subtotal_check'
      and conrelid = 'public.sale_items'::regclass
  ) then
    alter table public.sale_items add constraint sale_items_subtotal_check check (subtotal = unit_price * quantity);
  end if;
end $$;

-- ============================================================
-- Puesta en marcha: cómo crear tu primer usuario admin
-- ============================================================
-- 1. Corré este script completo en el SQL Editor (es idempotente,
--    podés volver a correrlo sobre una base existente).
-- 2. Desde la app, andá a la pantalla de login y probá crear un
--    usuario (o hacelo desde Authentication > Users en el panel de
--    Supabase). El trigger le va a asignar rol 'vendedor' por defecto.
-- 3. Convertilo en admin ejecutando (reemplazá el email):
--
--    update profiles set role = 'admin' where email = 'tu-email@ejemplo.com';
--
-- 4. Iniciá sesión con ese usuario: ya vas a ver la pestaña
--    "Administración" con Ganancias, Configuración y Usuarios.
--
-- ============================================================
-- Checklist de seguridad fuera de este script (dashboard Supabase)
-- ============================================================
-- 1. Authentication > Providers: desactivá "Allow new users to sign
--    up" (no hay registro público en la app; los usuarios se crean
--    desde Administración).
-- 2. Authentication > Policies > Password: exigí contraseñas más
--    fuertes (min. 8-12 caracteres) y activá el check de "comprometida".
-- 3. En la base CENTRAL de licencias, el status de `projects` se lee
--    con la anon key: no pongas ahí datos sensibles de facturación
--    (ver README, sección "Sistema de licencias").
