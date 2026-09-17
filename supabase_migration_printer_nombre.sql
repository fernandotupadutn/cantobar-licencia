-- ============================================================
-- MIGRACIÓN: Nombre de impresora configurable
--
-- Ejecutá este script en el SQL Editor de Supabase sobre una base
-- YA EXISTENTE. Es idempotente: podés correrlo varias veces.
--
-- Agrega local_config.printer_name: el nombre (exacto o parcial)
-- de la impresora que QZ Tray tiene que buscar al imprimir. Si está
-- vacío, se sigue usando la impresora predeterminada de Windows.
--
-- (El schema completo supabase_schema.sql ya incluye este campo;
-- este script solo aplica la delta sobre bases viejas.)
-- ============================================================

alter table public.local_config
  add column if not exists printer_name text not null default '';

-- Recargar el cache de esquema de PostgREST.
notify pgrst, 'reload schema';