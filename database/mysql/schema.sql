-- Base de datos de la tienda "PuntoSeguro Market" (MySQL 8 / MariaDB 10.5+)
-- Uso:  mysql -u root -p < database/schema.sql
-- Para empezar de cero: DROP DATABASE nombre_db;  y volver a ejecutar este archivo.
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS nombre_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nombre_db;

CREATE TABLE usuarios_ce (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  direccion TEXT NULL,
  punto_entrega TEXT NULL,                         -- punto donde el vendedor entrega sus productos
  pref_email TINYINT(1) NOT NULL DEFAULT 1,
  pref_sms TINYINT(1) NOT NULL DEFAULT 0,
  pref_promo TINYINT(1) NOT NULL DEFAULT 1,
  creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE categorias_ce (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  padre_id INT NULL,
  FOREIGN KEY (padre_id) REFERENCES categorias_ce(id)
);
CREATE TABLE marcas_ce (id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(80) NOT NULL UNIQUE);
CREATE TABLE productos_ce (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT NULL,
  emoji VARCHAR(16) NOT NULL DEFAULT '📦',        -- se muestra si el producto no tiene imagen
  color VARCHAR(9) NOT NULL DEFAULT '#9DB7C4',
  categoria_id INT NOT NULL,                       -- subcategoría (su padre es la categoría principal)
  marca_id INT NOT NULL,
  precio DECIMAL(10,2) NOT NULL,
  precio_anterior DECIMAL(10,2) NULL,              -- si tiene valor, el producto está en oferta
  stock INT NOT NULL DEFAULT 0,
  popularidad INT NOT NULL DEFAULT 0,
  es_nuevo TINYINT(1) NOT NULL DEFAULT 0,
  vendedor_id INT NULL,                            -- usuario que lo vende (NULL = vende la tienda)
  creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias_ce(id),
  FOREIGN KEY (marca_id) REFERENCES marcas_ce(id),
  FOREIGN KEY (vendedor_id) REFERENCES usuarios_ce(id) ON DELETE SET NULL
);
CREATE TABLE imagenes_producto_ce (   -- solo guarda la RUTA; el archivo vive en public/uploads/productos/
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  ruta VARCHAR(255) NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  FOREIGN KEY (producto_id) REFERENCES productos_ce(id) ON DELETE CASCADE
);
CREATE TABLE resenas_ce (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  usuario_id INT NULL,
  autor VARCHAR(100) NOT NULL,
  calificacion TINYINT NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
  comentario TEXT NOT NULL,
  creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES productos_ce(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios_ce(id) ON DELETE SET NULL
);
CREATE TABLE carritos_guardados_ce (
  usuario_id INT PRIMARY KEY,
  contenido JSON NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios_ce(id) ON DELETE CASCADE
);
CREATE TABLE lista_deseos_ce (
  usuario_id INT NOT NULL,
  producto_id INT NOT NULL,
  PRIMARY KEY (usuario_id, producto_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios_ce(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos_ce(id) ON DELETE CASCADE
);
CREATE TABLE codigos_descuento_ce (
  codigo VARCHAR(40) PRIMARY KEY,
  tipo ENUM('porcentaje','envio') NOT NULL,
  valor INT NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1
);
CREATE TABLE pedidos_ce (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,                             -- NULL = compra como invitado
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  vendedor_id INT NULL,                            -- cada pedido es de un solo vendedor (NULL = plataforma)
  entrega_modo VARCHAR(10) NOT NULL DEFAULT 'chat', -- vendedor | chat | tienda
  punto_acordado TEXT NULL,
  punto_propuesto TEXT NULL,
  propuesto_por INT NULL,
  pago VARCHAR(20) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  descuento DECIMAL(10,2) NOT NULL DEFAULT 0,
  envio DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  estado TINYINT NOT NULL DEFAULT 0,               -- 0 pedido confirmado, 1 punto de entrega acordado, 2 entregado
  creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios_ce(id) ON DELETE SET NULL,
  FOREIGN KEY (vendedor_id) REFERENCES usuarios_ce(id) ON DELETE SET NULL
) AUTO_INCREMENT=1001;
CREATE TABLE mensajes_pedido_ce (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  usuario_id INT NOT NULL,
  texto VARCHAR(500) NOT NULL,
  creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pedido_id) REFERENCES pedidos_ce(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios_ce(id) ON DELETE CASCADE
);
CREATE TABLE pedido_items_ce (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  producto_id INT NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  precio DECIMAL(10,2) NOT NULL,
  cantidad INT NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos_ce(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos_ce(id)
);
CREATE TABLE mensajes_contacto_ce (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL, email VARCHAR(150) NOT NULL, mensaje TEXT NOT NULL,
  creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE suscriptores_newsletter_ce (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(150) NOT NULL UNIQUE,
  creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== Datos iniciales =====
-- La tienda empieza SIN productos. Para agregar los tuyos usa database/agregar_productos.sql
INSERT INTO codigos_descuento_ce (codigo,tipo,valor) VALUES ('BIENVENIDO10','porcentaje',10);
