-- ============================================================
-- MIGRACIÓN: Caja (apertura/cierre), cambio de método de pago
-- y atribución de ventas a caja en CantoBar POS
--
-- Ejecutá este script en el SQL Editor de Supabase sobre una base
-- YA EXISTENTE. Es idempotente: podés correrlo varias veces.
--
-- Qué agrega:
--   1) Tabla cash_registers (una sola caja abierta por vez).
--   2) Columna sales.cash_register_id para atribuir cada venta.
--   3) create_sale() extendida con p_cash_register_id (requiere
--      caja abierta para registrar ventas).
--   4) RPC open_cash_register() y close_cash_register().
--   5) RPC update_sale_payment_method() para corregir el método
--      de pago de una venta ya registrada (cualquier vendedor).
--
-- (El schema completo supabase_schema.sql ya incluye estos
-- cambios; este script solo aplica la delta sobre bases viejas.)
-- ============================================================

-- ------------------------------------------------------------
-- 0) Recargar el cache de esquema de PostgREST al final (evita
--    el error PGRST202 "create_sale not found in schema cache").
--    Se notifica al final del script.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 1) Tabla de cajas. Una sola abierta por vez garantizada por
--    el índice único parcial (where status = 'open').
-- ------------------------------------------------------------
create table if not exists public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open' check (status in ('open', 'closed')),
  started_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_amount numeric(10, 2) not null default 0,
  expected_amount numeric(10, 2),
  counted_amount numeric(10, 2),
  difference numeric(10, 2),
  closed_by uuid references public.profiles(id) on delete set null,
  note text not null default '',
  sales_count integer not null default 0,
  efectivo_total numeric(10, 2) not null default 0,
  transferencia_total numeric(10, 2) not null default 0,
  mercado_pago_total numeric(10, 2) not null default 0
);

drop index if exists cash_registers_single_open;
create unique index cash_registers_single_open
  on public.cash_registers ((status))
  where status = 'open';

-- ------------------------------------------------------------
-- 2) Atribución de ventas a caja.
-- ------------------------------------------------------------
do $$
begin
  alter table public.sales
    add column if not exists cash_register_id uuid references public.cash_registers(id) on delete set null;
exception when duplicate_column then null;
end $$;

-- ------------------------------------------------------------
-- 3) create_sale() extendida: ahora pide una caja abierta.
--    Permite pasar p_cash_register_id; si no hay caja abierta
--    (o el id no corresponde a una caja abierta), NO vende.
--    Se mantiene UNA sola función (sin overloads) para evitar
--    el bug PGRST203 documentado en supabase_fix_create_sale.sql.
-- ------------------------------------------------------------
create or replace function public.create_sale(
  p_payment_method text,
  p_items jsonb,
  p_mp_order_id text default null,
  p_mp_payment_id text default null,
  p_cash_register_id uuid default null
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
  v_cr_id uuid;
begin
  if v_seller is null then
    raise exception 'No autenticado';
  end if;

  -- La venta exige una caja abierta. Si no se pasa id, se toma
  -- la única caja abierta activa (defensa en profundidad).
  if p_cash_register_id is not null then
    select cr.id into v_cr_id
    from public.cash_registers cr
    where cr.id = p_cash_register_id and cr.status = 'open';
  else
    select cr.id into v_cr_id
    from public.cash_registers cr
    where cr.status = 'open'
    order by cr.opened_at
    limit 1;
  end if;

  if v_cr_id is null then
    raise exception 'No hay caja abierta. Abrí la caja antes de vender.';
  end if;

  if p_payment_method not in ('Efectivo', 'Transferencia', 'MercadoPago') then
    raise exception 'Método de pago inválido';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrito vacío';
  end if;

  insert into sales (seller_id, payment_method, total_amount, mp_order_id, mp_payment_id, cash_register_id)
  values (v_seller, p_payment_method::payment_method_enum, 0, p_mp_order_id, p_mp_payment_id, v_cr_id)
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
    'cash_register_id', s.cash_register_id,
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

revoke execute on function public.create_sale(text, jsonb, text, text, uuid) from public;
grant execute on function public.create_sale(text, jsonb, text, text, uuid) to authenticated;

-- ------------------------------------------------------------
-- 4) Apertura de caja.
-- ------------------------------------------------------------
create or replace function public.open_cash_register(
  p_opening_amount numeric default 0
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_cr public.cash_registers%rowtype;
begin
  perform 1 from public.cash_registers where status = 'open' limit 1;
  if found then
    raise exception 'Ya hay una caja abierta. Cerrala antes de abrir una nueva.';
  end if;

  insert into public.cash_registers (status, started_by, opening_amount)
  values ('open', auth.uid(), coalesce(p_opening_amount, 0))
  returning * into v_cr;

  return to_jsonb(v_cr);
end;
$$;

revoke execute on function public.open_cash_register(numeric) from public;
grant execute on function public.open_cash_register(numeric) to authenticated;

-- ------------------------------------------------------------
-- 5) Cierre de caja: calcula lo esperado (monto inicial + ventas
--    en Efectivo de la caja), guarda el dinero contado, la
--    diferencia y el desglose por método de pago.
-- ------------------------------------------------------------
create or replace function public.close_cash_register(
  p_counted_amount numeric,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_cr public.cash_registers%rowtype;
  v_expected numeric(10, 2);
  v_efectivo numeric(10, 2);
  v_transferencia numeric(10, 2);
  v_mp numeric(10, 2);
  v_count integer;
begin
  select * into v_cr
  from public.cash_registers
  where status = 'open'
  order by opened_at
  limit 1;

  if v_cr.id is null then
    raise exception 'No hay caja abierta.';
  end if;

  select
    coalesce(sum(total_amount) filter (where payment_method = 'Efectivo'::public.payment_method_enum), 0),
    coalesce(sum(total_amount) filter (where payment_method = 'Transferencia'::public.payment_method_enum), 0),
    coalesce(sum(total_amount) filter (where payment_method = 'MercadoPago'::public.payment_method_enum), 0),
    count(*)
  into v_efectivo, v_transferencia, v_mp, v_count
  from public.sales
  where cash_register_id = v_cr.id;

  v_expected := v_cr.opening_amount + v_efectivo;

  update public.cash_registers
  set status = 'closed',
      closed_at = now(),
      counted_amount = p_counted_amount,
      note = coalesce(p_note, ''),
      expected_amount = round(v_expected, 2),
      difference = round(p_counted_amount - v_expected, 2),
      closed_by = auth.uid(),
      sales_count = v_count,
      efectivo_total = round(v_efectivo, 2),
      transferencia_total = round(v_transferencia, 2),
      mercado_pago_total = round(v_mp, 2)
  where id = v_cr.id
  returning * into v_cr;

  return to_jsonb(v_cr);
end;
$$;

revoke execute on function public.close_cash_register(numeric, text) from public;
grant execute on function public.close_cash_register(numeric, text) to authenticated;

-- ------------------------------------------------------------
-- 6) Cambiar el método de pago de una venta ya registrada.
--    Disponible para cualquier usuario autenticado (vendedor).
-- ------------------------------------------------------------
create or replace function public.update_sale_payment_method(
  p_sale_id uuid,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.sales%rowtype;
begin
  if p_payment_method not in ('Efectivo', 'Transferencia', 'MercadoPago') then
    raise exception 'Método de pago inválido.';
  end if;

  update public.sales
  set payment_method = p_payment_method::public.payment_method_enum
  where id = p_sale_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'No se encontró la venta.';
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke execute on function public.update_sale_payment_method(uuid, text) from public;
grant execute on function public.update_sale_payment_method(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- Row Level Security para cash_registers:
-- lectura abierta a cualquier usuario logueado, y sin escritura
-- directa (solo por las funciones security definer de arriba).
-- ------------------------------------------------------------
alter table public.cash_registers enable row level security;

drop policy if exists "cash_registers: lectura para logueados" on public.cash_registers;
create policy "cash_registers: lectura para logueados" on public.cash_registers
  for select using (auth.uid() is not null);

revoke insert, update, delete on public.cash_registers from anon, authenticated;

-- ------------------------------------------------------------
-- La columna nueva de sales ya queda cubierta por la política
-- "sales: lectura para logueados" existente (SELECT de todas
-- las columnas). Las escrituras siguen cerradas.
-- ------------------------------------------------------------

-- Recargar el schema cache de PostgREST (evita PGRST202 tras
-- cambiar la firma de create_sale y crear las nuevas funciones).
notify pgrst, 'reload schema';