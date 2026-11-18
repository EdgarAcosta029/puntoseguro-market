-- Ejecuta esto UNA sola vez si ya tenías creada la base nombre_db (sin borrarla).
-- Si vas a crear la base desde cero con schema.sql, no necesitas este archivo.
USE nombre_db;
ALTER TABLE productos_ce
  ADD COLUMN vendedor_id INT NULL AFTER es_nuevo,
  ADD CONSTRAINT fk_productos_ce_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios_ce(id) ON DELETE SET NULL;
