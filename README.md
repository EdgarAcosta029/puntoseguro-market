# PuntoSeguro Market

Plataforma C2C de compraventa entre particulares con entrega en puntos seguros (proyecto de Comercio Electrónico, UJAT).
Vendedores y compradores son los mismos usuarios. No hay paquetería: el vendedor fija su punto de entrega o ambos acuerdan un punto intermedio por chat. El comprador confirma la entrega al recibir el producto (momento en el que se liberaría el pago en custodia, simulado).

## Cómo está armado
- `public/`: la página (HTML, CSS y JavaScript). Vercel la sirve como sitio estático.
- `api/index.js` + `server/app.js`: la API (Express). Vercel la ejecuta como función.
- `server/db.js`: conexión a PostgreSQL (Supabase). `server/storage.js`: fotos en Supabase Storage.
- `database/schema_supabase.sql`: crea las 14 tablas `_ce`. `database/mysql/`: versión anterior en MySQL (ya no se usa).
- `vercel.json`: indica a Vercel dónde está el sitio y que `/api/*` va a la función.

## Despliegue paso a paso

### 1) Supabase (base de datos y fotos)
1. En supabase.com crea un proyecto (anota la **contraseña de la base de datos**).
2. Entra a **SQL Editor > New query**, pega todo `database/schema_supabase.sql` y presiona **Run**. Esto crea las tablas, activa la seguridad (RLS) y crea el bucket público `productos` para las fotos.
3. (Opcional) Para tener productos de ejemplo, ejecuta también `database/agregar_15_productos.sql`.
4. Presiona **Connect** (arriba) y copia la cadena **Transaction pooler** (puerto 6543). Cambia `[YOUR-PASSWORD]` por tu contraseña. Esa es tu `DATABASE_URL`.
5. En **Project Settings > API** copia la **Project URL** (`SUPABASE_URL`) y la llave secreta: **service_role** (o **secret**) = `SUPABASE_SERVICE_KEY`. Es secreta: solo va en variables de entorno, nunca en el código ni en GitHub.
6. En **Storage** comprueba que existe el bucket `productos` y que aparece como **Public**.

### 2) Probar en tu computadora (recomendado antes de subir)
```powershell
copy .env.example .env      # llena DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET y ADMIN_KEY
npm install
npm start                   # http://localhost:3000
```
`JWT_SECRET` y `ADMIN_KEY` son dos claves largas que inventas tú (distintas entre sí).

### 3) GitHub
Crea un repositorio y sube la carpeta (el archivo `.env` NO se sube: ya está en `.gitignore`).
```powershell
git init
git add .
git commit -m "PuntoSeguro Market"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/puntoseguro-market.git
git push -u origin main
```

### 4) Vercel
1. En vercel.com: **Add New > Project** e importa el repositorio.
2. **Framework Preset: Other**. Deja Build Command y Output Directory como están (los toma de `vercel.json`).
3. En **Environment Variables** agrega: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET` (= `productos`), `JWT_SECRET`, `ADMIN_KEY`.
4. **Deploy**. Cuando termine, abre la URL que te da Vercel.

Si cambias una variable de entorno, haz **Redeploy** para que se aplique.

### 5) Revisa que todo funcione
- El inicio carga el catálogo (si no hay productos, no verás ninguno hasta publicar o cargar los de ejemplo).
- Crea una cuenta, entra a **Mi cuenta > Vender** y publica un producto con foto.
- `tu-url.vercel.app/admin.html` pide la `ADMIN_KEY`.
- Compra con otra cuenta, acuerda el punto por chat y confirma la entrega.

## Funciones de la fase 2 (qué hacen y qué es simulado)

| Función | Cómo funciona | ¿Real o simulado? |
|---|---|---|
| Mapa de Puntos Seguros | Menú **Puntos Seguros**: mapa OpenStreetMap + Leaflet (sin API key) con lista, horario y botón “Cómo llegar”. Los vendedores eligen su punto del mapa y en el chat se propone uno de la lista. El administrador los da de alta en `/admin.html` > Puntos Seguros (busca la dirección o hace clic en el mapa). | Real |
| Pagos | Tarjeta (Luhn, marca, vigencia, CVV; solo se guarda marca y últimos 4), SPEI (CLABE + referencia + concepto + vencimiento 72 h), efectivo (referencia con código de barras, 48 h) y PayPal (correo + ventana de aprobación). | **Simulado**: no se cobra nada. Tarjeta de prueba 4242 4242 4242 4242; rechazo con 4000 0000 0000 0002 |
| Custodia de fondos (escrow) | Estados: pendiente → en custodia → liberado (cuando el comprador confirma) o reembolsado (si se cancela). El vendedor ve “Mis cobros”. | **Simulado** (solo cambia un estado en la base de datos) |
| Verificación de INE | Mi cuenta > Verificar identidad: foto de la INE, OCR con Tesseract.js **en el navegador** (la foto no se sube), validación de CURP y mayoría de edad (el nombre de la INE no tiene que coincidir con el de la cuenta); guarda solo un hash de la CURP. Insignia “Verificado” y estado por pedido. | Demostración: no prueba que la credencial sea auténtica. Con `REQUIRE_INE=1` se exige a ambas partes para confirmar la entrega |
| Variantes y filtros | Al publicar se definen opciones (Color, Talla…) y el estado (nuevo/seminuevo/usado). El catálogo filtra por estado, opciones y vendedores verificados. | Real |
| Direcciones | Mi cuenta > Mis datos: hasta 10 lugares guardados, usables como punto de entrega. | Real |
| Mensajes de contacto | `/admin.html` > Mensajes: leer, marcar leído, eliminar y ver suscriptores. | Real |

**Entrega confirmada por ambas partes:** al comprar, el producto sigue visible como “Reservado” (nadie más puede comprarlo). Cuando el comprador confirma “recibí” y el vendedor confirma “entregué”, se liberan los fondos (simulado) y, si ya no queda stock, el producto sale del catálogo. Si el pedido se cancela antes, vuelve a estar disponible. Requiere `database/actualizacion_fase3_supabase.sql`.

**Compras como invitado:** piden celular (10 dígitos; ahora lo piden todos los compradores y lo ve el vendedor) y generan un código de seguimiento por pedido. En Ayuda > Seguimiento de pedido, con el número de pedido y el código, el invitado consulta el estado, paga su referencia, confirma que recibió o cancela antes de la entrega. Su confirmación cuenta como la del comprador. Requiere `database/actualizacion_fase4_supabase.sql`.

**Si ya tenías la tienda desplegada:** ejecuta `database/actualizacion_fase2_supabase.sql` en el SQL Editor de Supabase (es seguro repetirlo), opcionalmente `database/puntos_seguros_ejemplo.sql` (5 puntos con coordenadas aproximadas que debes corregir en el admin) y sube el código con `git add . && git commit -m "Fase 2" && git push`. Para la fase 3 ejecuta también `database/actualizacion_fase3_supabase.sql` y para la fase 4 `database/actualizacion_fase4_supabase.sql`.

## Límites y cuidados
- Las fotos pueden pesar hasta **4 MB** (Vercel no acepta peticiones más grandes).
- En el plan gratis de Supabase el proyecto se **pausa tras una semana sin uso**: se reactiva desde su panel.
- El chat de pedidos consulta al servidor cada 4 segundos mientras la pestaña está abierta; para un proyecto escolar es suficiente.
- Si alguna vez se publicó tu `service_role`/secret o tu contraseña de base, genera nuevas en Supabase y actualiza Vercel.
- El cobro con tarjeta es una demostración: no se procesa ningún pago real.
