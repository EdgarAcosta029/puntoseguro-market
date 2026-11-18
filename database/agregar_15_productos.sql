-- 15 productos adicionales (de ejemplo) para PuntoSeguro Market. Ejecútalo en el SQL Editor de Supabase.
-- Crea las categorías y marcas que falten y no duplica las que ya existen.
-- Cambia nombres, precios, descripciones y stock por los de tus productos reales.
INSERT INTO categorias_ce (nombre, padre_id) SELECT 'Tecnología', NULL WHERE NOT EXISTS (SELECT 1 FROM categorias_ce WHERE nombre='Tecnología' AND padre_id IS NULL);
INSERT INTO categorias_ce (nombre, padre_id) SELECT 'Celulares', (SELECT id FROM categorias_ce WHERE nombre='Tecnología' AND padre_id IS NULL LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM categorias_ce WHERE nombre='Celulares' AND padre_id IS NOT NULL);
INSERT INTO categorias_ce (nombre, padre_id) SELECT 'Computadoras', (SELECT id FROM categorias_ce WHERE nombre='Tecnología' AND padre_id IS NULL LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM categorias_ce WHERE nombre='Computadoras' AND padre_id IS NOT NULL);
INSERT INTO categorias_ce (nombre, padre_id) SELECT 'Audio', (SELECT id FROM categorias_ce WHERE nombre='Tecnología' AND padre_id IS NULL LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM categorias_ce WHERE nombre='Audio' AND padre_id IS NOT NULL);
INSERT INTO categorias_ce (nombre, padre_id) SELECT 'Videojuegos', (SELECT id FROM categorias_ce WHERE nombre='Tecnología' AND padre_id IS NULL LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM categorias_ce WHERE nombre='Videojuegos' AND padre_id IS NOT NULL);
INSERT INTO categorias_ce (nombre, padre_id) SELECT 'Moda', NULL WHERE NOT EXISTS (SELECT 1 FROM categorias_ce WHERE nombre='Moda' AND padre_id IS NULL);
INSERT INTO categorias_ce (nombre, padre_id) SELECT 'Ropa', (SELECT id FROM categorias_ce WHERE nombre='Moda' AND padre_id IS NULL LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM categorias_ce WHERE nombre='Ropa' AND padre_id IS NOT NULL);
INSERT INTO categorias_ce (nombre, padre_id) SELECT 'Calzado', (SELECT id FROM categorias_ce WHERE nombre='Moda' AND padre_id IS NULL LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM categorias_ce WHERE nombre='Calzado' AND padre_id IS NOT NULL);
INSERT INTO categorias_ce (nombre, padre_id) SELECT 'Accesorios', NULL WHERE NOT EXISTS (SELECT 1 FROM categorias_ce WHERE nombre='Accesorios' AND padre_id IS NULL);
INSERT INTO categorias_ce (nombre, padre_id) SELECT 'Relojes', (SELECT id FROM categorias_ce WHERE nombre='Accesorios' AND padre_id IS NULL LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM categorias_ce WHERE nombre='Relojes' AND padre_id IS NOT NULL);
INSERT INTO categorias_ce (nombre, padre_id) SELECT 'Bolsas', (SELECT id FROM categorias_ce WHERE nombre='Accesorios' AND padre_id IS NULL LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM categorias_ce WHERE nombre='Bolsas' AND padre_id IS NOT NULL);

INSERT INTO marcas_ce (nombre) VALUES ('Apple') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO marcas_ce (nombre) VALUES ('Casio') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO marcas_ce (nombre) VALUES ('JBL') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO marcas_ce (nombre) VALUES ('Lenovo') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO marcas_ce (nombre) VALUES ('Levi''s') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO marcas_ce (nombre) VALUES ('Nike') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO marcas_ce (nombre) VALUES ('Nintendo') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO marcas_ce (nombre) VALUES ('Samsung') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO marcas_ce (nombre) VALUES ('Sony') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO marcas_ce (nombre) VALUES ('Targus') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO marcas_ce (nombre) VALUES ('Xiaomi') ON CONFLICT (nombre) DO NOTHING;

INSERT INTO productos_ce (nombre, descripcion, emoji, color, categoria_id, marca_id, precio, precio_anterior, stock, es_nuevo) VALUES
('iPhone 12 de 128 GB', 'Usado en buen estado, batería al 86%. Incluye cable. Desbloqueado para cualquier compañía.', '📱', '#7E96B8', (SELECT id FROM categorias_ce WHERE nombre='Celulares' AND padre_id IS NOT NULL LIMIT 1), (SELECT id FROM marcas_ce WHERE nombre='Apple'), 8500, NULL, 1, 0),
('Samsung Galaxy S21', 'Usado, pantalla sin rayones. 128 GB, desbloqueado. Incluye funda.', '📱', '#A89BB8', (SELECT id FROM categorias_ce WHERE nombre='Celulares' AND padre_id IS NOT NULL LIMIT 1), (SELECT id FROM marcas_ce WHERE nombre='Samsung'), 6200, NULL, 1, 0),
('Xiaomi Redmi Note 11', 'Seminuevo, 128 GB. Incluye cargador original y caja.', '📱', '#7C8C99', (SELECT id FROM categorias_ce WHERE nombre='Celulares' AND padre_id IS NOT NULL LIMIT 1), (SELECT id FROM marcas_ce WHERE nombre='Xiaomi'), 2800, 3300, 2, 0),
('Laptop Lenovo ThinkPad T480', 'Intel Core i5, 16 GB de RAM y SSD de 256 GB. Teclado en excelente estado.', '💻', '#6F7C85', (SELECT id FROM categorias_ce WHERE nombre='Computadoras' AND padre_id IS NOT NULL LIMIT 1), (SELECT id FROM marcas_ce WHERE nombre='Lenovo'), 7400, NULL, 1, 0),
('MacBook Air 2017', '13 pulgadas, 8 GB de RAM y SSD de 128 GB. Incluye cargador.', '💻', '#9DB7C4', (SELECT id FROM categorias_ce WHERE nombre='Computadoras' AND padre_id IS NOT NULL LIMIT 1), (SELECT id FROM marcas_ce WHERE nombre='Apple'), 9800, 11500, 1, 0),
('Tablet Samsung Galaxy Tab A7', 'Pantalla de 10.4 pulgadas, 32 GB. Usada con funda protectora.', '📟', '#8FA9A3', (SELECT id FROM categorias_ce WHERE nombre='Computadoras' AND padre_id IS NOT NULL LIMIT 1), (SELECT id FROM marcas_ce WHERE nombre='Samsung'), 2900, NULL, 2, 1),
('Audífonos Sony WH-1000XM3', 'Con cancelación de ruido. Almohadillas recién cambiadas y estuche incluido.', '🎧', '#17262B', (SELECT id FROM categorias_ce WHERE nombre='Audio' AND padre_id IS NOT NULL LIMIT 1), (SELECT id FROM marcas_ce WHERE nombre='Sony'), 2600, NULL, 1, 0),
('AirPods de 2.ª generación', 'Usados, estuche de carga incluido. Funcionan perfecto.', '🎧', '#D9E2E1', (SELECT id FROM categorias_ce WHERE nombre='Audio' AND padre_id IS NOT NULL LIMIT 1), (SELECT id FROM marcas_ce WHERE nombre='Apple'), 1500, NULL, 2, 0),
('Bocina JBL Flip 5', 'Resistente al agua, batería de unas 10 horas. Con cable de carga.', '🔊', '#C77D5A', (SELECT id FROM categorias_ce WHERE nombre='Audio' AND padre_id IS NOT NULL LIMIT 1), (SELECT id FROM marcas_ce WHERE nombre='JBL'), 1400, NULL, 2, 0),
('Control DualShock 4 para PS4', 'Original, sin drift. Se vende con cable USB.', '🎮', '#6F7C85', (SELECT id FROM categorias_ce WHERE nombre='Videojuegos' AND padre_id IS NOT NULL LIMIT 1), (SELECT id FROM marcas_ce WHERE nombre='Sony'), 650, NULL, 3, 0),
('Nintendo Switch con base', 'Modelo estándar con base, cables y dos Joy-Con. Sin juegos.', '🎮', '#C98B7A', (SELECT id FROM categorias_ce WHERE nombre='Videojuegos' AND padre_id IS NOT NULL LIMIT 1), (SELECT id FROM marcas_ce WHERE nombre='Nintendo'), 5200, 6000, 1, 0),
('Chamarra de mezclilla', 'Talla M, color azul medio. Poco uso, sin manchas ni rotos.', '🧥', '#7E96B8', (SELECT id FROM categorias_ce WHERE nombre='Ropa' AND padre_id IS NOT NULL LIMIT 1), (SELECT id FROM marcas_ce WHERE nombre='Levi''s'), 550, NULL, 2, 1),
('Tenis Nike Air Max, talla 27', 'Usados con desgaste leve en la suela. Se entregan limpios.', '👟', '#B8A06A', (SELECT id FROM categorias_ce WHERE nombre='Calzado' AND padre_id IS NOT NULL LIMIT 1), (SELECT id FROM marcas_ce WHERE nombre='Nike'), 1300, NULL, 1, 0),
('Reloj Casio G-Shock', 'Resistente a golpes y agua. Correa en buen estado.', '⌚', '#17262B', (SELECT id FROM categorias_ce WHERE nombre='Relojes' AND padre_id IS NOT NULL LIMIT 1), (SELECT id FROM marcas_ce WHERE nombre='Casio'), 1100, NULL, 2, 0),
('Mochila para laptop', 'Compartimento acolchado para laptop de hasta 15.6 pulgadas. Sin roturas.', '🎒', '#7FA27A', (SELECT id FROM categorias_ce WHERE nombre='Bolsas' AND padre_id IS NOT NULL LIMIT 1), (SELECT id FROM marcas_ce WHERE nombre='Targus'), 420, NULL, 3, 1);
