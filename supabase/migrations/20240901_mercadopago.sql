-- ============================================================
-- MIGRACIÓN: Integración Mercado Pago (QR + Point Smart) en CantoBar POS
--
-- Ejecutá este script en el SQL Editor de Supabase sobre una base
-- YA EXISTENTE para agregar el método de pago "MercadoPago" y las
-- referencias de la order. Es idempotente: podés correrlo varias veces.
--
-- (Si preferís, el schema completo supabase_schema.sql ya incluye
-- estos cambios; este script solo aplica la delta sobre bases viejas.)
-- ============================================================

-- 1) Agregar 'MercadoPago' al enum de métodos de pago.
do $$
begin
  alter type public.payment_method_enum
    add value if not exists 'MercadoPago';
exception when duplicate_object then null;
end $$;

-- 2) Columna order de Mercado Pago (id de la order ORD...).
do $$
begin
  alter table public.sales add column if not exists mp_order_id text;
exception when duplicate_column then null;
end $$;

-- 3) Columna payment de Mercado Pago (id del pago acaeditado).
do $$
begin
  alter table public.sales add column if not exists mp_payment_id text;
exception when duplicate_column then null;
end $$;

-- 4) Recrear create_sale() aceptando las referencias MP (con default
--    null para no romper llamadas anteriores Efectivo/Transferencia).
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

-- 5) Permisos: solo usuarios logueados (authenticated) pueden llamarla.
revoke execute on function public.create_sale(text, jsonb, text, text) from public;
grant execute on function public.create_sale(text, jsonb, text, text) to authenticated;
