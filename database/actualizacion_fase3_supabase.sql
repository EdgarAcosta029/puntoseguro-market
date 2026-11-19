-- Fase 3: la entrega se completa cuando CONFIRMAN comprador y vendedor.
-- Ejecuta este archivo una vez en Supabase > SQL Editor. Es seguro repetirlo.
ALTER TABLE pedidos_ce ADD COLUMN IF NOT EXISTS comprador_confirmo SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE pedidos_ce ADD COLUMN IF NOT EXISTS vendedor_confirmo SMALLINT NOT NULL DEFAULT 0;
UPDATE pedidos_ce SET comprador_confirmo = 1, vendedor_confirmo = 1 WHERE estado = 2;
