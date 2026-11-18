// Aplicación de la tienda: API REST (Express + PostgreSQL de Supabase). La usan server/index.js (local) y api/index.js (Vercel)
require('dotenv').config();
const path = require('path');
const express = require('express');
const pool = require('./db'), storage = require('./storage');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), multer = require('multer');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const PROD = !!(process.env.VERCEL || process.env.NODE_ENV === 'production');
if (PROD && !process.env.JWT_SECRET) throw new Error('Falta JWT_SECRET en las variables de entorno');
const SECRET = process.env.JWT_SECRET || 'cambia-esta-clave';
const ADMIN_KEY = process.env.ADMIN_KEY || (PROD ? null : 'cambia-esta-clave-admin');   // en producción el panel de admin queda cerrado si no defines ADMIN_KEY
const err = (s, m) => Object.assign(new Error(m), { status: s });
const wrap = f => (req, res) => f(req, res).catch(e => {
  if (!e.status) console.error(e);
  res.status(e.status || 500).json({ error: e.status ? e.message : 'Error del servidor' });
});
const need = (req, res, next) => req.uid ? next() : res.status(401).json({ error: 'Inicia sesión para continuar' });
const valid = e => /^\S+@\S+\.\S+$/.test(e || '');
const token = id => jwt.sign({ id }, SECRET, { expiresIn: '7d' });
const userOut = u => ({ id: u.id, n: u.nombre, e: u.email, direccion: u.direccion || '', punto: u.punto_entrega || '',
  pref: { email: u.pref_email, sms: u.pref_sms, promo: u.pref_promo } });

app.use((req, res, next) => {          // identifica al usuario si manda token (si no, es invitado)
  try { req.uid = jwt.verify((req.headers.authorization || '').slice(7), SECRET).id; } catch (e) { req.uid = null; }
  next();
});

// ---------- Catálogo ----------
app.get('/api/productos', wrap(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT p.id, p.nombre AS n, p.emoji AS e, c.nombre AS s, pc.nombre AS c, m.nombre AS b,
           p.precio AS p, COALESCE(p.precio_anterior,0) AS o,
           COALESCE((SELECT ROUND(AVG(calificacion),1) FROM resenas_ce WHERE producto_id=p.id),0) AS r,
           p.descripcion AS d, u.nombre AS v, u.punto_entrega AS vp, p.vendedor_id AS vid, p.popularidad AS pop, p.es_nuevo AS nw, p.color AS col, p.stock,
           (SELECT string_agg(ruta, '|' ORDER BY orden, id) FROM imagenes_producto_ce WHERE producto_id=p.id) AS imgs
    FROM productos_ce p JOIN categorias_ce c ON c.id=p.categoria_id JOIN categorias_ce pc ON pc.id=c.padre_id
    JOIN marcas_ce m ON m.id=p.marca_id LEFT JOIN usuarios_ce u ON u.id=p.vendedor_id ORDER BY p.id`);
  rows.forEach(r => { r.imgs = r.imgs ? r.imgs.split('|') : []; r.img = r.imgs[0] || null; });
  res.json(rows);
}));

app.get('/api/productos/:id/resenas', wrap(async (req, res) => {
  const [r] = await pool.query('SELECT autor, calificacion, comentario FROM resenas_ce WHERE producto_id=? ORDER BY id DESC', [req.params.id]);
  res.json(r.map(x => [x.autor, x.calificacion, x.comentario]));
}));

app.post('/api/productos/:id/resenas', need, wrap(async (req, res) => {   // solo con sesión, una reseña por producto, nunca del propio producto
  const { calificacion, comentario } = req.body, cal = +calificacion;
  if (!(cal >= 1 && cal <= 5) || !(comentario || '').trim()) throw err(400, 'Escribe una calificación y un comentario');
  const [[p]] = await pool.query('SELECT id, vendedor_id FROM productos_ce WHERE id=?', [req.params.id]);
  if (!p) throw err(404, 'Producto no encontrado');
  if (p.vendedor_id === req.uid) throw err(403, 'No puedes reseñar tu propio producto');
  const [[ya]] = await pool.query('SELECT id FROM resenas_ce WHERE producto_id=? AND usuario_id=?', [p.id, req.uid]);
  if (ya) throw err(409, 'Ya escribiste una reseña de este producto');
  const [[u]] = await pool.query('SELECT nombre FROM usuarios_ce WHERE id=?', [req.uid]);
  await pool.query('INSERT INTO resenas_ce (producto_id,usuario_id,autor,calificacion,comentario) VALUES (?,?,?,?,?)', [p.id, req.uid, u.nombre, cal, comentario.trim()]);
  res.json({ ok: true });
}));

// ---------- Cuenta ----------
app.post('/api/registro', wrap(async (req, res) => {
  const { nombre, email, password } = req.body;
  if (!(nombre || '').trim() || !valid(email) || (password || '').length < 6) throw err(400, 'Revisa tu nombre, correo y contraseña (mínimo 6 caracteres)');
  try {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query('INSERT INTO usuarios_ce (nombre,email,password_hash) VALUES (?,?,?) RETURNING id', [nombre.trim(), email.trim().toLowerCase(), hash]);
    const [[u]] = await pool.query('SELECT * FROM usuarios_ce WHERE id=?', [r.insertId]);
    res.json({ token: token(u.id), user: userOut(u) });
  } catch (e) { if (e.code === '23505') throw err(409, 'Ese correo ya tiene cuenta'); throw e; }
}));

app.post('/api/login', wrap(async (req, res) => {
  const [[u]] = await pool.query('SELECT * FROM usuarios_ce WHERE email=?', [(req.body.email || '').trim().toLowerCase()]);
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password_hash))) throw err(401, 'Correo o contraseña incorrectos');
  res.json({ token: token(u.id), user: userOut(u) });
}));

app.get('/api/yo', need, wrap(async (req, res) => {
  const [[u]] = await pool.query('SELECT * FROM usuarios_ce WHERE id=?', [req.uid]);
  if (!u) throw err(401, 'Inicia sesión para continuar');
  res.json(userOut(u));
}));
app.put('/api/yo', need, wrap(async (req, res) => {
  const { direccion, pref, punto } = req.body;
  if (typeof direccion === 'string') await pool.query('UPDATE usuarios_ce SET direccion=? WHERE id=?', [direccion, req.uid]);
  if (typeof punto === 'string') await pool.query('UPDATE usuarios_ce SET punto_entrega=? WHERE id=?', [punto.trim().slice(0, 300) || null, req.uid]);
  if (pref) await pool.query('UPDATE usuarios_ce SET pref_email=?, pref_sms=?, pref_promo=? WHERE id=?',
    [+!!pref.email, +!!pref.sms, +!!pref.promo, req.uid]);
  res.json({ ok: true });
}));

app.get('/api/carrito', need, wrap(async (req, res) => {
  const [[c]] = await pool.query('SELECT contenido FROM carritos_guardados_ce WHERE usuario_id=?', [req.uid]);
  res.json({ items: c ? c.contenido : {} });
}));
app.put('/api/carrito', need, wrap(async (req, res) => {
  await pool.query('INSERT INTO carritos_guardados_ce (usuario_id, contenido) VALUES (?, ?::jsonb) ON CONFLICT (usuario_id) DO UPDATE SET contenido=EXCLUDED.contenido', [req.uid, JSON.stringify(req.body.items || {})]);
  res.json({ ok: true });
}));

app.get('/api/deseos', need, wrap(async (req, res) => {
  const [r] = await pool.query('SELECT producto_id FROM lista_deseos_ce WHERE usuario_id=?', [req.uid]);
  res.json({ ids: r.map(x => x.producto_id) });
}));
app.put('/api/deseos', need, wrap(async (req, res) => {
  const ids = (req.body.ids || []).map(Number).filter(Boolean);
  await pool.query('DELETE FROM lista_deseos_ce WHERE usuario_id=?', [req.uid]);
  if (ids.length) await pool.query('INSERT INTO lista_deseos_ce (usuario_id, producto_id) SELECT ?::int, p.id FROM productos_ce p WHERE p.id = ANY(?::int[]) ON CONFLICT DO NOTHING', [req.uid, ids]);
  res.json({ ok: true });
}));

// ---------- Descuentos y pedidos ----------
app.post('/api/descuento', wrap(async (req, res) => {
  const [[c]] = await pool.query('SELECT codigo,tipo,valor FROM codigos_descuento_ce WHERE codigo=? AND activo=1', [(req.body.codigo || '').trim().toUpperCase()]);
  if (!c) throw err(404, 'Código no válido');
  res.json(c);
}));

// Un pedido por vendedor. Entrega: 'vendedor' = en el punto que fijó el vendedor, 'chat' = se acuerda por chat con el vendedor.
app.post('/api/pedidos', wrap(async (req, res) => {
  const { items, codigo, nombre, email, pago, modo } = req.body;
  if (!Array.isArray(items) || !items.length || !nombre || !valid(email) || !['vendedor', 'chat'].includes(modo))
    throw err(400, 'Datos del pedido incompletos');
  if (modo === 'chat' && !req.uid) throw err(401, 'Para acordar el punto por chat necesitas iniciar sesión');
  const cn = await pool.getConnection();
  try {
    await cn.beginTransaction();
    const grupos = new Map();                      // vendedor_id (o 0 = plataforma) -> líneas
    for (const it of items) {                      // precios y stock siempre se leen de la base
      const [[p]] = await cn.query('SELECT p.id,p.nombre,p.precio,p.stock,p.vendedor_id,u.email AS vemail,u.punto_entrega AS punto FROM productos_ce p LEFT JOIN usuarios_ce u ON u.id=p.vendedor_id WHERE p.id=? FOR UPDATE OF p', [it.id]);
      const q = Math.floor(+it.cant);
      if (!p || !(q >= 1)) throw err(400, 'Producto no válido');
      if (p.vendedor_id && (p.vendedor_id === req.uid || (p.vemail || '').toLowerCase() === String(email).trim().toLowerCase()))
        throw err(403, 'No puedes comprar tu propio producto');
      if (p.stock < q) throw err(409, `Sin stock suficiente de ${p.nombre}`);
      const k = p.vendedor_id || 0;
      if (!grupos.has(k)) grupos.set(k, { punto: p.punto, lines: [] });
      grupos.get(k).lines.push([p, q]);
    }
    let c = null;
    if (codigo) [[c]] = await cn.query('SELECT * FROM codigos_descuento_ce WHERE codigo=? AND activo=1 AND tipo=\'porcentaje\'', [codigo]);
    const ids = []; let totalGral = 0;
    for (const [vid, g] of grupos) {
      if (vid && modo === 'vendedor' && !g.punto) throw err(400, 'Uno de los vendedores aún no definió su punto de entrega. Elige acordarlo por chat.');
      const sub = g.lines.reduce((t, [p, q]) => t + p.precio * q, 0);
      const d = c ? Math.round(sub * c.valor / 100) : 0, total = sub - d;
      const m = vid ? modo : 'tienda';
      const punto = m === 'vendedor' ? g.punto : m === 'tienda' ? 'Punto Seguro de PuntoSeguro Market (te lo confirmamos por correo)' : null;
      const [r] = await cn.query('INSERT INTO pedidos_ce (usuario_id,nombre,email,vendedor_id,entrega_modo,punto_acordado,estado,pago,subtotal,descuento,total) VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING id',
        [req.uid, nombre, email, vid || null, m, punto, punto ? 1 : 0, pago || 'tarjeta', sub, d, total]);
      for (const [p, q] of g.lines) {
        await cn.query('INSERT INTO pedido_items_ce (pedido_id,producto_id,nombre,precio,cantidad) VALUES (?,?,?,?,?)', [r.insertId, p.id, p.nombre, p.precio, q]);
        await cn.query('UPDATE productos_ce SET stock=stock-?, popularidad=popularidad+? WHERE id=?', [q, q, p.id]);
      }
      ids.push(r.insertId); totalGral += total;
    }
    await cn.commit();
    res.json({ id: ids[0], ids, total: totalGral });
  } catch (e) { await cn.rollback(); throw e; } finally { cn.release(); }
}));

const vista = (x, yo) => ({ id: x.id, d: x.d, t: x.t, st: x.st, modo: x.entrega_modo, punto: x.punto_acordado || '',
  inv: !x.usuario_id, mail: x.email, prop: x.punto_propuesto || '', mio: !!x.punto_propuesto && x.propuesto_por === yo, otro: x.otro || '' });
async function conItems(o, yo) {
  for (const x of o) {
    const [it] = await pool.query('SELECT nombre, cantidad FROM pedido_items_ce WHERE pedido_id=?', [x.id]);
    x.items = it.map(i => i.nombre + ' ×' + i.cantidad);
  }
  return o.map(x => ({ ...vista(x, yo), items: x.items, comprador: x.nombre }));
}
app.get('/api/pedidos', need, wrap(async (req, res) => {
  const [o] = await pool.query(`SELECT pe.*, to_char(pe.creado AT TIME ZONE 'America/Mexico_City','DD/MM/YYYY') AS d, pe.total AS t, pe.estado AS st, v.nombre AS otro
    FROM pedidos_ce pe LEFT JOIN usuarios_ce v ON v.id=pe.vendedor_id WHERE pe.usuario_id=? ORDER BY pe.id`, [req.uid]);
  res.json((await conItems(o, req.uid)).map(x => ({ ...x, id: 'PED-' + x.id, n: x.id })));
}));

// Chat y entrega: solo participan el comprador y el vendedor del pedido
const part = (req, res, next) => (async () => {
  const [[p]] = await pool.query('SELECT * FROM pedidos_ce WHERE id=?', [req.params.id]);
  if (!p || (p.usuario_id !== req.uid && p.vendedor_id !== req.uid)) throw err(404, 'Pedido no encontrado');
  req.ped = p; req.soyComprador = p.usuario_id === req.uid; next();
})().catch(e => res.status(e.status || 500).json({ error: e.status ? e.message : 'Error del servidor' }));
app.get('/api/pedidos/:id/mensajes', need, part, wrap(async (req, res) => {
  const [m] = await pool.query(`SELECT m.id, (m.usuario_id=?) AS mio, u.nombre AS quien, m.texto AS t, to_char(m.creado AT TIME ZONE 'America/Mexico_City','DD/MM HH24:MI') AS h
    FROM mensajes_pedido_ce m JOIN usuarios_ce u ON u.id=m.usuario_id WHERE m.pedido_id=? ORDER BY m.id`, [req.uid, req.params.id]);
  const p = req.ped;
  res.json({ msgs: m.map(x => ({ ...x, mio: !!x.mio })), st: p.estado, punto: p.punto_acordado || '', prop: p.punto_propuesto || '', mio: !!p.punto_propuesto && p.propuesto_por === req.uid });
}));
app.post('/api/pedidos/:id/mensajes', need, part, wrap(async (req, res) => {
  if (req.ped.entrega_modo === 'tienda' || !req.ped.usuario_id) throw err(400, 'Este pedido no tiene chat');
  const t = String(req.body.texto || '').trim().slice(0, 500);
  if (!t) throw err(400, 'Escribe un mensaje');
  await pool.query('INSERT INTO mensajes_pedido_ce (pedido_id,usuario_id,texto) VALUES (?,?,?)', [req.params.id, req.uid, t]);
  res.json({ ok: true });
}));
app.post('/api/pedidos/:id/punto', need, part, wrap(async (req, res) => {          // proponer un punto intermedio
  if (req.ped.entrega_modo !== 'chat' || req.ped.estado !== 0) throw err(400, 'Este pedido ya tiene punto de entrega');
  const t = String(req.body.punto || '').trim().slice(0, 300);
  if (!t) throw err(400, 'Escribe el lugar propuesto');
  await pool.query('UPDATE pedidos_ce SET punto_propuesto=?, propuesto_por=? WHERE id=?', [t, req.uid, req.params.id]);
  await pool.query('INSERT INTO mensajes_pedido_ce (pedido_id,usuario_id,texto) VALUES (?,?,?)', [req.params.id, req.uid, '📍 Propongo vernos en: ' + t]);
  res.json({ ok: true });
}));
app.post('/api/pedidos/:id/aceptar', need, part, wrap(async (req, res) => {        // acepta quien NO propuso
  const p = req.ped;
  if (p.entrega_modo !== 'chat' || p.estado !== 0 || !p.punto_propuesto) throw err(400, 'No hay un punto por aceptar');
  if (p.propuesto_por === req.uid) throw err(403, 'Debe aceptarlo la otra persona');
  await pool.query('UPDATE pedidos_ce SET punto_acordado=punto_propuesto, punto_propuesto=NULL, propuesto_por=NULL, estado=1 WHERE id=?', [p.id]);
  await pool.query('INSERT INTO mensajes_pedido_ce (pedido_id,usuario_id,texto) VALUES (?,?,?)', [p.id, req.uid, '✅ Acepto el punto: ' + p.punto_propuesto]);
  res.json({ ok: true });
}));
app.post('/api/pedidos/:id/recibido', need, part, wrap(async (req, res) => {       // el comprador confirma que recibió e inspeccionó
  if (!req.soyComprador) throw err(403, 'Solo el comprador confirma la entrega');
  if (req.ped.estado !== 1) throw err(400, 'Primero debe acordarse el punto de entrega');
  await pool.query('UPDATE pedidos_ce SET estado=2 WHERE id=?', [req.ped.id]);
  res.json({ ok: true });
}));

// ---------- Contacto y newsletter ----------
app.post('/api/contacto', wrap(async (req, res) => {
  const { nombre, email, mensaje } = req.body;
  if (!nombre || !valid(email) || !mensaje) throw err(400, 'Completa nombre, correo y mensaje');
  await pool.query('INSERT INTO mensajes_contacto_ce (nombre,email,mensaje) VALUES (?,?,?)', [nombre, email, mensaje]);
  res.json({ ok: true });
}));
app.post('/api/newsletter', wrap(async (req, res) => {
  if (!valid(req.body.email)) throw err(400, 'Escribe un correo válido');
  await pool.query('INSERT INTO suscriptores_newsletter_ce (email) VALUES (?) ON CONFLICT (email) DO NOTHING', [req.body.email.trim().toLowerCase()]);
  res.json({ ok: true });
}));

// ---------- Imágenes de producto (archivo en Supabase Storage, URL en la base) ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },               // Vercel acepta cuerpos de hasta ~4.5 MB
  fileFilter: (q, f, cb) => cb(null, /\.(jpe?g|png|webp)$/i.test(f.originalname) && /^image\/(jpeg|png|webp)$/.test(f.mimetype))
});
const SUBE = 'Sube una imagen JPG, PNG o WEBP de hasta 4 MB';
async function guardarFoto(idProducto, file) {
  const ruta = await storage.guardar(file);
  await pool.query('INSERT INTO imagenes_producto_ce (producto_id, ruta, orden) SELECT ?::int, ?::text, COALESCE(MAX(orden)+1,0) FROM imagenes_producto_ce WHERE producto_id=?', [idProducto, ruta, idProducto]);
  return ruta;
}
app.post('/api/productos/:id/imagenes', (req, res, next) =>
  (ADMIN_KEY && req.headers['x-admin-key'] === ADMIN_KEY) ? next() : res.status(403).json({ error: 'Clave de administrador incorrecta' }),
  upload.single('imagen'), wrap(async (req, res) => {
    if (!req.file) throw err(400, SUBE);
    res.json({ ruta: await guardarFoto(req.params.id, req.file) });
  }));

// ---------- Administración de productos (protegida con ADMIN_KEY) ----------
const adminOnly = (req, res, next) => (ADMIN_KEY && req.headers['x-admin-key'] === ADMIN_KEY)
  ? next() : res.status(403).json({ error: 'Clave de administrador incorrecta' });
async function idPorNombre(tabla, nombre, padre) {   // busca por nombre y, si no existe, lo crea
  const [[r]] = tabla === 'marcas'
    ? await pool.query('SELECT id FROM marcas_ce WHERE nombre=?', [nombre])
    : await pool.query('SELECT id FROM categorias_ce WHERE nombre=? AND ' + (padre ? 'padre_id=?' : 'padre_id IS NULL'), padre ? [nombre, padre] : [nombre]);
  if (r) return r.id;
  const [i] = tabla === 'marcas'
    ? await pool.query('INSERT INTO marcas_ce (nombre) VALUES (?) RETURNING id', [nombre])
    : await pool.query('INSERT INTO categorias_ce (nombre, padre_id) VALUES (?,?) RETURNING id', [nombre, padre || null]);
  return i.insertId;
}
app.get('/api/admin/catalogo', adminOnly, wrap(async (req, res) => {
  const [categorias] = await pool.query('SELECT id, nombre, padre_id FROM categorias_ce ORDER BY nombre');
  const [marcas] = await pool.query('SELECT nombre FROM marcas_ce ORDER BY nombre');
  const [productos] = await pool.query('SELECT p.id, p.nombre, p.precio, p.precio_anterior, p.stock, c.nombre AS sub FROM productos_ce p JOIN categorias_ce c ON c.id=p.categoria_id ORDER BY p.id DESC');
  const [imgs] = await pool.query('SELECT id, producto_id, ruta FROM imagenes_producto_ce ORDER BY orden, id');
  productos.forEach(p => { p.imgs = imgs.filter(i => i.producto_id === p.id); });
  res.json({ categorias, marcas: marcas.map(m => m.nombre), productos });
}));
async function crearProducto(b, vendedor) {          // la usan el panel de admin y los vendedores
  const t = s => (s == null ? '' : String(s)).trim();
  const precio = +b.precio, stock = Math.floor(+b.stock || 0), ant = +b.precio_anterior > 0 ? +b.precio_anterior : null;
  if (!t(b.nombre) || !t(b.categoria) || !t(b.subcategoria) || !t(b.marca) || !(precio > 0) || stock < 0)
    throw err(400, 'Completa nombre, categoría, subcategoría, marca, precio y stock');
  if (ant !== null && !(ant > precio)) throw err(400, 'El precio anterior debe ser mayor al precio actual');
  const cat = await idPorNombre('categorias', t(b.categoria), null);
  const sub = await idPorNombre('categorias', t(b.subcategoria), cat);
  const marca = await idPorNombre('marcas', t(b.marca));
  const color = /^#[0-9a-f]{6}$/i.test(t(b.color)) ? t(b.color) : '#9DB7C4';
  const [r] = await pool.query('INSERT INTO productos_ce (nombre,descripcion,emoji,color,categoria_id,marca_id,precio,precio_anterior,stock,es_nuevo,vendedor_id) VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING id',
    [t(b.nombre), t(b.descripcion), t(b.emoji) || '📦', color, sub, marca, precio, ant, stock, +!!b.es_nuevo, vendedor || null]);
  return r.insertId;
}
app.post('/api/admin/productos', adminOnly, wrap(async (req, res) => res.json({ id: await crearProducto(req.body, null) })));
app.put('/api/admin/productos/:id', adminOnly, wrap(async (req, res) => {
  const precio = +req.body.precio, stock = Math.floor(+req.body.stock), ant = +req.body.precio_anterior > 0 ? +req.body.precio_anterior : null;
  if (!(precio > 0) || !(stock >= 0) || (ant !== null && !(ant > precio))) throw err(400, 'Revisa el precio, el precio anterior (debe ser mayor) y el stock');
  await pool.query('UPDATE productos_ce SET precio=?, precio_anterior=?, stock=? WHERE id=?', [precio, ant, stock, req.params.id]);
  res.json({ ok: true });
}));
app.delete('/api/admin/productos/:id', adminOnly, wrap(async (req, res) => {
  const [im] = await pool.query('SELECT ruta FROM imagenes_producto_ce WHERE producto_id=?', [req.params.id]);
  try { await pool.query('DELETE FROM productos_ce WHERE id=?', [req.params.id]); }
  catch (e) { if (e.code === '23503') throw err(409, 'Este producto ya tiene pedidos y no se puede borrar. Ponle stock 0.'); throw e; }
  await Promise.all(im.map(i => storage.borrar(i.ruta)));
  res.json({ ok: true });
}));
app.delete('/api/admin/imagenes/:id', adminOnly, wrap(async (req, res) => {
  const [[i]] = await pool.query('SELECT ruta FROM imagenes_producto_ce WHERE id=?', [req.params.id]);
  if (i) { await pool.query('DELETE FROM imagenes_producto_ce WHERE id=?', [req.params.id]); await storage.borrar(i.ruta); }
  res.json({ ok: true });
}));

// ---------- Vendedores: cualquier usuario con cuenta publica y administra SUS productos ----------
const dueno = (req, res, next) => pool.query('SELECT id FROM productos_ce WHERE id=? AND vendedor_id=?', [req.params.id, req.uid])
  .then(([[p]]) => p ? next() : res.status(403).json({ error: 'Este producto no es tuyo' }))
  .catch(() => res.status(500).json({ error: 'Error del servidor' }));
app.get('/api/vender/productos', need, wrap(async (req, res) => {
  const [categorias] = await pool.query('SELECT id, nombre, padre_id FROM categorias_ce ORDER BY nombre');
  const [marcas] = await pool.query('SELECT nombre FROM marcas_ce ORDER BY nombre');
  const [productos] = await pool.query('SELECT p.id, p.nombre, p.precio, p.precio_anterior, p.stock, c.nombre AS sub FROM productos_ce p JOIN categorias_ce c ON c.id=p.categoria_id WHERE p.vendedor_id=? ORDER BY p.id DESC', [req.uid]);
  const [imgs] = productos.length ? await pool.query('SELECT id, producto_id, ruta FROM imagenes_producto_ce WHERE producto_id = ANY(?::int[]) ORDER BY orden, id', [productos.map(p => p.id)]) : [[]];
  productos.forEach(p => { p.imgs = imgs.filter(i => i.producto_id === p.id); });
  res.json({ categorias, marcas: marcas.map(m => m.nombre), productos });
}));
app.post('/api/vender/productos', need, wrap(async (req, res) => res.json({ id: await crearProducto(req.body, req.uid) })));
app.put('/api/vender/productos/:id', need, dueno, wrap(async (req, res) => {
  const precio = +req.body.precio, stock = Math.floor(+req.body.stock), ant = +req.body.precio_anterior > 0 ? +req.body.precio_anterior : null;
  if (!(precio > 0) || !(stock >= 0) || (ant !== null && !(ant > precio))) throw err(400, 'Revisa el precio, el precio anterior (debe ser mayor) y el stock');
  await pool.query('UPDATE productos_ce SET precio=?, precio_anterior=?, stock=? WHERE id=?', [precio, ant, stock, req.params.id]);
  res.json({ ok: true });
}));
app.delete('/api/vender/productos/:id', need, dueno, wrap(async (req, res) => {
  const [im] = await pool.query('SELECT ruta FROM imagenes_producto_ce WHERE producto_id=?', [req.params.id]);
  try { await pool.query('DELETE FROM productos_ce WHERE id=?', [req.params.id]); }
  catch (e) { if (e.code === '23503') throw err(409, 'Este producto ya tiene pedidos y no se puede borrar. Ponle stock 0.'); throw e; }
  await Promise.all(im.map(i => storage.borrar(i.ruta)));
  res.json({ ok: true });
}));
app.post('/api/vender/productos/:id/imagenes', need, dueno, upload.single('imagen'), wrap(async (req, res) => {
  if (!req.file) throw err(400, SUBE);
  res.json({ ruta: await guardarFoto(req.params.id, req.file) });
}));
app.delete('/api/vender/imagenes/:id', need, wrap(async (req, res) => {
  const [[i]] = await pool.query('SELECT i.ruta FROM imagenes_producto_ce i JOIN productos_ce p ON p.id=i.producto_id WHERE i.id=? AND p.vendedor_id=?', [req.params.id, req.uid]);
  if (!i) throw err(403, 'Esta foto no es tuya');
  await pool.query('DELETE FROM imagenes_producto_ce WHERE id=?', [req.params.id]);
  await storage.borrar(i.ruta);
  res.json({ ok: true });
}));
app.get('/api/vender/ventas', need, wrap(async (req, res) => {
  const [o] = await pool.query(`SELECT pe.*, to_char(pe.creado AT TIME ZONE 'America/Mexico_City','DD/MM/YYYY') AS d, pe.total AS t, pe.estado AS st, pe.nombre AS otro
    FROM pedidos_ce pe WHERE pe.vendedor_id=? ORDER BY pe.id DESC`, [req.uid]);
  res.json((await conItems(o, req.uid)).map(x => ({ ...x, n: x.id })));
}));
app.use((e, req, res, next) => {                 // errores que no pasaron por wrap(): subida de archivos, JSON inválido, etc.
  if (e && e.name === 'MulterError') return res.status(400).json({ error: SUBE });
  if (e && e.type === 'entity.parse.failed') return res.status(400).json({ error: 'Solicitud no válida' });
  console.error(e);
  res.status(500).json({ error: 'Error del servidor' });
});

module.exports = app;
