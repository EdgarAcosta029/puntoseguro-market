-- Ejecuta esto UNA sola vez si ya tienes creada la base nombre_db (sin borrarla).
-- Si vas a crear la base desde cero con schema.sql, no necesitas este archivo.
USE nombre_db;
SET SQL_SAFE_UPDATES = 0;   -- Workbench bloquea UPDATE/DELETE sin clave si esto está activo

ALTER TABLE usuarios_ce ADD COLUMN punto_entrega TEXT NULL AFTER direccion;

ALTER TABLE pedidos_ce
  MODIFY direccion TEXT NULL,
  ADD COLUMN vendedor_id INT NULL AFTER direccion,
  ADD COLUMN entrega_modo VARCHAR(10) NOT NULL DEFAULT 'tienda' AFTER vendedor_id,
  ADD COLUMN punto_acordado TEXT NULL AFTER entrega_modo,
  ADD COLUMN punto_propuesto TEXT NULL AFTER punto_acordado,
  ADD COLUMN propuesto_por INT NULL AFTER punto_propuesto,
  ADD CONSTRAINT fk_pedidos_ce_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios_ce(id) ON DELETE SET NULL;

-- Estados nuevos: 0 pedido confirmado, 1 punto acordado, 2 entregado
UPDATE pedidos_ce SET estado=2 WHERE estado>2;

CREATE TABLE IF NOT EXISTS mensajes_pedido_ce (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  usuario_id INT NOT NULL,
  texto VARCHAR(500) NOT NULL,
  creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pedido_id) REFERENCES pedidos_ce(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios_ce(id) ON DELETE CASCADE
);

-- Ya no hay costo de envío: se quita el código de envío gratis
DELETE FROM codigos_descuento_ce WHERE codigo='ENVIOGRATIS';

SET SQL_SAFE_UPDATES = 1;
