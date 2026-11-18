-- Plantilla para agregar productos propios en el SQL Editor de Supabase.
-- (Lo más cómodo es publicarlos desde la página: Mi cuenta > Vender, o el panel /admin.html)
-- Cambia los textos y ejecuta los bloques 1 a 3.

-- 1) Categoría principal y subcategoría (si ya existen, no se duplican)
INSERT INTO categorias_ce (nombre, padre_id)
SELECT 'NOMBRE DE CATEGORÍA', NULL WHERE NOT EXISTS (SELECT 1 FROM categorias_ce WHERE nombre='NOMBRE DE CATEGORÍA' AND padre_id IS NULL);
INSERT INTO categorias_ce (nombre, padre_id)
SELECT 'NOMBRE DE SUBCATEGORÍA', (SELECT id FROM categorias_ce WHERE nombre='NOMBRE DE CATEGORÍA' AND padre_id IS NULL LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categorias_ce WHERE nombre='NOMBRE DE SUBCATEGORÍA' AND padre_id IS NOT NULL);

-- 2) Marca
INSERT INTO marcas_ce (nombre) VALUES ('NOMBRE DE MARCA') ON CONFLICT (nombre) DO NOTHING;

-- 3) Producto (precio_anterior solo si está en oferta, si no pon NULL; es_nuevo: 1 o 0)
INSERT INTO productos_ce (nombre, descripcion, emoji, color, categoria_id, marca_id, precio, precio_anterior, stock, popularidad, es_nuevo)
VALUES ('NOMBRE DEL PRODUCTO', 'Descripción del producto.', '📦', '#9DB7C4',
  (SELECT id FROM categorias_ce WHERE nombre='NOMBRE DE SUBCATEGORÍA' AND padre_id IS NOT NULL LIMIT 1),
  (SELECT id FROM marcas_ce WHERE nombre='NOMBRE DE MARCA'), 199.00, NULL, 10, 0, 1);
-- Las fotos se suben desde la página (se guardan en Supabase Storage).
