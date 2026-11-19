-- OPCIONAL: puntos seguros de ejemplo para Villahermosa, Tabasco.
-- IMPORTANTE: las coordenadas son APROXIMADAS (verificado = 0) y la página lo avisa. Entra a /admin.html,
-- sección "Puntos seguros", busca cada dirección y corrige el pin; al guardar queda como verificado.
INSERT INTO puntos_seguros_ce (nombre, direccion, horario, descripcion, lat, lng, verificado) VALUES
('Plaza Altabrisa Tabasco', 'Centro comercial, Villahermosa, Tabasco', 'Lun a Dom 11:00 a 21:00', 'Centro comercial con vigilancia y mucha afluencia. Verse en la entrada principal.', 17.9960, -92.9300, 0),
('Galerías Tabasco 2000', 'Zona Tabasco 2000, Villahermosa, Tabasco', 'Lun a Dom 11:00 a 21:00', 'Centro comercial con estacionamiento vigilado. Verse en el acceso principal.', 17.9975, -92.9395, 0),
('Plaza Crystal', 'Centro comercial, Villahermosa, Tabasco', 'Lun a Dom 11:00 a 21:00', 'Plaza con cámaras y seguridad privada. Verse cerca de la entrada.', 17.9880, -92.9280, 0),
('Parque La Choca', 'Villahermosa, Tabasco', 'Todos los días, de día', 'Parque público concurrido. Se recomienda ir antes de que oscurezca.', 17.9890, -92.9205, 0),
('Zócalo / Plaza de Armas', 'Centro de Villahermosa, Tabasco', 'Todos los días, de día', 'Espacio público céntrico con vigilancia municipal.', 17.9895, -92.9190, 0);
