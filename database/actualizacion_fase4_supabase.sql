-- Fase 4: celular del comprador y código de seguimiento para compras como invitado.
-- Ejecuta este archivo una vez en Supabase > SQL Editor. Es seguro repetirlo.
ALTER TABLE pedidos_ce ADD COLUMN IF NOT EXISTS telefono VARCHAR(20) NULL;
ALTER TABLE pedidos_ce ADD COLUMN IF NOT EXISTS codigo_seguimiento VARCHAR(12) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_codigo_uq ON pedidos_ce (codigo_seguimiento) WHERE codigo_seguimiento IS NOT NULL;
