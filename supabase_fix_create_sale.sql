-- ============================================================
-- FIX: "Could not find the function public.create_sale(...)
--      in the schema cache" / PGRST203 ambiguo
-- ============================================================
-- Causa real:
--   * El error PGRST202 "Could not find ... in the schema cache"
--     en realidad era un schema cache de PostgREST desactualizado
--     (la función existía desde el schema). El mensaje ordena los
--     parámetros alfabéticamente, lo que confunde.
--   * Un fix anterior agregó un OVERLOAD con el orden alfabético
--     (create_sale(jsonb, text, text, text)). Eso dejó DOS funciones
--     con los mismos nombres de parámetro y PostgREST no puede
--     elegir (PGRST203 "Could not choose the best candidate").
--
-- Solución correcta: dejar UNA sola create_sale (la canónica
-- text, jsonb, text, text) y borrar el overload. PostgREST matchea
-- los parámetros por NOMBRE, el orden de definición no importa
-- mientras haya un único candidato.
-- Idempotente: podés correrlo varias veces.
-- ============================================================

-- 1) Eliminar el overload duplicado (jsonb, text, text, text).
drop function if exists public.create_sale(jsonb, text, text, text);

-- 2) Forzar la recarga del schema cache de PostgREST para que
--    quede únicamente create_sale(text, jsonb, text, text).
notify pgrst, 'reload schema';