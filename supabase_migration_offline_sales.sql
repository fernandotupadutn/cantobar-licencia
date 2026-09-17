-- ============================================================
-- MIGRACIÓN: Ventas offline (solo escritorio / Electron)
--
-- Ejecutá este script en el SQL Editor de Supabase sobre una base
-- YA EXISTENTE. Es idempotente: podés correrlo varias veces.
--
-- Qué hace:
--   1) create_sale() gana el parámetro opcional p_sale_id uuid
--      (default null). Si se pasa, la venta se inserta CON ESE id:
--      así el ticket impreso offline (que lleva el id local) coincide
--      con el de la venta sincronizada después.
--   2) Se dropea la firma vieja de 5 args y se deja UNA sola
--      función canónica (sin overloads) para evitar el bug
--      PGRST203 documentado en supabase_fix_create_sale.sql.
--
-- La web sigue llamando con los mismos 5 argumentos (defaults),
-- así que NO cambia su comportamiento. El total y los precios se
-- siguen calculando en el servidor; el cliente no puede inventar
-- montos ni id de otra venta (collide y falla el insert).
--
-- (El schema completo supabase_schema.sql ya incluye estos
-- cambios; este script solo aplica la delta sobre bases viejas.)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Dropear la firma vieja create_sale(text, jsonb, text, text, uuid)
-- ------------------------------------------------------------
drop function if exists public.create_sale(text, jsonb, text, text, uuid);

-- ------------------------------------------------------------
-- 2) create_sale() canónica + p_sale_id (opcional).
--    Una sola función, sin overloads.
-- ------------------------------------------------------------
create or replace function public.create_sale(
  p_payment_method text,
  p_items jsonb,
  p_mp_order_id text default null,
  p_mp_payment_id text default null,
  p_cash_register_id uuid default null,
  p_sale_id uuid default null
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

  -- p_sale_id lo genera el escritorio para que el ticket offline y la
  -- venta sincronizada compartan id (y número de ticket). gen_random_uuid()
  -- mantiene el comportamiento original para la web.
  insert into sales (id, seller_id, payment_method, total_amount, mp_order_id, mp_payment_id, cash_register_id)
  values (coalesce(p_sale_id, gen_random_uuid()), v_seller, p_payment_method::payment_method_enum, 0, p_mp_order_id, p_mp_payment_id, v_cr_id)
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

-- ------------------------------------------------------------
-- 3) Permisos: solo la función canónica (6 args), nadie más escribe.
-- ------------------------------------------------------------
revoke execute on function public.create_sale(text, jsonb, text, text, uuid, uuid) from public;
grant execute on function public.create_sale(text, jsonb, text, text, uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 4) Recargar el cache de esquema de PostgREST (evita PGRST202).
-- ------------------------------------------------------------
notify pgrst, 'reload schema';