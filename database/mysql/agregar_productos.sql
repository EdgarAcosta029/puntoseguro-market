-- Plantilla para agregar tus propios productos. Cambia los textos y ejecútala en MySQL Workbench.
-- Ejecuta primero los bloques 1 a 3 (una sola vez por categoría y marca) y luego el 4 por cada producto.
USE nombre_db;
SET NAMES utf8mb4;

-- 1) Categoría principal y subcategoría (la subcategoría apunta a la principal con padre_id)
INSERT INTO categorias_ce (nombre, padre_id) VALUES ('NOMBRE DE CATEGORÍA', NULL);
SET @cat = LAST_INSERT_ID();
INSERT INTO categorias_ce (nombre, padre_id) VALUES ('NOMBRE DE SUBCATEGORÍA', @cat);
SET @sub = LAST_INSERT_ID();

-- 2) Marca
INSERT INTO marcas_ce (nombre) VALUES ('NOMBRE DE MARCA');
SET @marca = LAST_INSERT_ID();

-- 3) Producto (precio_anterior solo si está en oferta, si no pon NULL; es_nuevo: 1 o 0)
INSERT INTO productos_ce (nombre, descripcion, emoji, color, categoria_id, marca_id, precio, precio_anterior, stock, popularidad, es_nuevo)
VALUES ('NOMBRE DEL PRODUCTO', 'Descripción del producto.', '📦', '#9DB7C4', @sub, @marca, 199.00, NULL, 10, 0, 1);
SET @prod = LAST_INSERT_ID();

-- 4) Imagen (opcional): copia el archivo a public/uploads/productos/ y registra su ruta
INSERT INTO imagenes_producto_ce (producto_id, ruta, orden) VALUES (@prod, '/uploads/productos/mi-foto.jpg', 0);
