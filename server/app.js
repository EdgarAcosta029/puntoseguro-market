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
const userOut = u => ({ id: u.id, n: u.nombre, e: u.email, direccion: u.direccion || '', punto: u.punto_entrega || '', puntoId: u.punto_entrega_id || null, ine: u.ine_estado === 'verificada',
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
           p.descripcion AS d, u.nombre AS v, u.punto_entrega AS vp, p.vendedor_id AS vid, (u.ine_estado='verificada') AS vv, p.condicion AS con, p.opciones AS ops, p.popularidad AS pop, p.es_nuevo AS nw, p.color AS col, p.stock,
           (SELECT string_agg(ruta, '|' ORDER BY orden, id) FROM imagenes_producto_ce WHERE producto_id=p.id) AS imgs
    FROM productos_ce p JOIN categorias_ce c ON c.id=p.categoria_id JOIN categorias_ce pc ON pc.id=c.padre_id
    JOIN marcas_ce m ON m.id=p.marca_id LEFT JOIN usuarios_ce u ON u.id=p.vendedor_id
    WHERE p.stock > 0 OR EXISTS (SELECT 1 FROM pedido_items_ce i JOIN pedidos_ce pe ON pe.id=i.pedido_id WHERE i.producto_id=p.id AND pe.estado IN (0,1))
    ORDER BY p.id`);   // se oculta solo cuando ya no queda stock y no hay pedidos abiertos (todos confirmados por ambas partes)
  rows.forEach(r => { r.imgs = r.imgs ? r.imgs.split('|') : []; r.img = r.imgs[0] || null; });
  res.json(rows);
}));

app.get('/api/productos/:id/resenas', wrap(async (req, res) => {
  const [r] = await pool.query('SELECT autor, calificacion, comentario FROM resenas_ce WHERE producto_id=? ORDER BY id DESC', [req.params.id]);
  res.json(r.map(x => [x.autor, x.calificacion, x.comentario]));
}));

// Solo puede reseñar quien ya recibió (pedido entregado) una compra de ese vendedor
async function compro(uid, p) {
  const [[c]] = p.vendedor_id
    ? await pool.query('SELECT 1 AS ok FROM pedidos_ce WHERE usuario_id=? AND vendedor_id=? AND estado=2 AND pago_estado<>\'reembolsado\' LIMIT 1', [uid, p.vendedor_id])
    : await pool.query('SELECT 1 AS ok FROM pedidos_ce pe JOIN pedido_items_ce i ON i.pedido_id=pe.id WHERE pe.usuario_id=? AND i.producto_id=? AND pe.estado=2 AND pe.pago_estado<>\'reembolsado\' LIMIT 1', [uid, p.id]);
  return !!c;
}
const MOTIVO_NO_COMPRO = 'Solo pueden reseñar quienes compraron al vendedor y ya recibieron su pedido';

app.get('/api/productos/:id/puede-resenar', need, wrap(async (req, res) => {
  const [[p]] = await pool.query('SELECT id, vendedor_id FROM productos_ce WHERE id=?', [req.params.id]);
  if (!p) throw err(404, 'Producto no encontrado');
  if (p.vendedor_id === req.uid) return res.json({ ok: false, m: 'No puedes reseñar tu propio producto' });
  const [[ya]] = await pool.query('SELECT id FROM resenas_ce WHERE producto_id=? AND usuario_id=?', [p.id, req.uid]);
  if (ya) return res.json({ ok: false, m: 'Ya escribiste una reseña de este producto' });
  if (!(await compro(req.uid, p))) return res.json({ ok: false, m: MOTIVO_NO_COMPRO + '.' });
  res.json({ ok: true });
}));

app.post('/api/productos/:id/resenas', need, wrap(async (req, res) => {   // solo con sesión y con compra entregada al vendedor; una reseña por producto, nunca del propio
  const { calificacion, comentario } = req.body, cal = +calificacion;
  if (!(cal >= 1 && cal <= 5) || !(comentario || '').trim()) throw err(400, 'Escribe una calificación y un comentario');
  const [[p]] = await pool.query('SELECT id, vendedor_id FROM productos_ce WHERE id=?', [req.params.id]);
  if (!p) throw err(404, 'Producto no encontrado');
  if (p.vendedor_id === req.uid) throw err(403, 'No puedes reseñar tu propio producto');
  if (!(await compro(req.uid, p))) throw err(403, MOTIVO_NO_COMPRO);
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
  if (typeof punto === 'string') {
    let pid = null, txt = punto.trim().slice(0, 300);
    if (req.body.punto_id) {                       // eligió uno de los Puntos Seguros del mapa
      const [[ps]] = await pool.query('SELECT id, nombre, direccion FROM puntos_seguros_ce WHERE id=? AND activo=1', [+req.body.punto_id]);
      if (!ps) throw err(400, 'Ese Punto Seguro ya no está disponible');
      pid = ps.id; txt = (ps.nombre + ', ' + ps.direccion).slice(0, 300);
    }
    await pool.query('UPDATE usuarios_ce SET punto_entrega=?, punto_entrega_id=? WHERE id=?', [txt || null, txt ? pid : null, req.uid]);
  }
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

// ---------- Puntos Seguros (mapa) ----------
app.get('/api/puntos', wrap(async (req, res) => {
  const [r] = await pool.query('SELECT id, nombre, direccion, horario, descripcion, lat, lng, verificado FROM puntos_seguros_ce WHERE activo=1 ORDER BY nombre');
  res.json(r);
}));

// ---------- Direcciones y lugares guardados ----------
app.get('/api/direcciones', need, wrap(async (req, res) => {
  const [r] = await pool.query('SELECT id, etiqueta, texto FROM direcciones_ce WHERE usuario_id=? ORDER BY id', [req.uid]);
  res.json(r);
}));
app.post('/api/direcciones', need, wrap(async (req, res) => {
  const et = String(req.body.etiqueta || '').trim().slice(0, 40), tx = String(req.body.texto || '').trim().slice(0, 300);
  if (!et || !tx) throw err(400, 'Escribe un nombre (Casa, Trabajo...) y la dirección');
  const [[n]] = await pool.query('SELECT COUNT(*) AS n FROM direcciones_ce WHERE usuario_id=?', [req.uid]);
  if (n.n >= 10) throw err(400, 'Puedes guardar hasta 10 direcciones');
  const [r] = await pool.query('INSERT INTO direcciones_ce (usuario_id, etiqueta, texto) VALUES (?,?,?) RETURNING id', [req.uid, et, tx]);
  res.json({ id: r.insertId });
}));
app.delete('/api/direcciones/:id', need, wrap(async (req, res) => {
  await pool.query('DELETE FROM direcciones_ce WHERE id=? AND usuario_id=?', [req.params.id, req.uid]);
  res.json({ ok: true });
}));

// ---------- Verificación de identidad con INE ----------
// El OCR se hace en el navegador y la FOTO NUNCA llega aquí. Solo se recibe el texto leído (y corregido por la persona):
// se validan nombre y CURP y se guarda una huella (hash) para que una misma credencial no sirva en dos cuentas.
// Es una demostración: una verificación real usaría un proveedor certificado (validación contra el INE y prueba de vida).
const CURP = /^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$/;
const sinAcento = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
app.post('/api/yo/ine', need, wrap(async (req, res) => {
  const curp = sinAcento(req.body.curp).replace(/\s/g, ''), nombre = sinAcento(req.body.nombre).trim();
  if (!CURP.test(curp)) throw err(400, 'La CURP no tiene un formato válido. Revísala o toma otra foto');
  const yy = +curp.slice(4, 6), mm = +curp.slice(6, 8), dd = +curp.slice(8, 10), sig = /\d/.test(curp[16]) ? 1900 : 2000;
  const nac = new Date(sig + yy, mm - 1, dd);
  if (nac.getMonth() !== mm - 1 || nac.getDate() !== dd) throw err(400, 'La fecha de nacimiento de la CURP no es válida');
  if ((Date.now() - nac.getTime()) / 31557600000 < 18) throw err(403, 'Debes ser mayor de edad para verificar tu identidad');
  if (nombre.length < 3) throw err(400, 'Escribe el nombre como aparece en tu credencial');   // el nombre de la INE no tiene que coincidir con el de la cuenta
  const hash = require('crypto').createHash('sha256').update(curp + SECRET).digest('hex');
  try { await pool.query("UPDATE usuarios_ce SET ine_estado='verificada', ine_fecha=now(), ine_hash=? WHERE id=?", [hash, req.uid]); }
  catch (e) { if (e.code === '23505') throw err(409, 'Esa credencial ya está asociada a otra cuenta'); throw e; }
  res.json({ ok: true });
}));

// ---------- Descuentos y pedidos ----------
app.post('/api/descuento', wrap(async (req, res) => {
  const [[c]] = await pool.query('SELECT codigo,tipo,valor FROM codigos_descuento_ce WHERE codigo=? AND activo=1', [(req.body.codigo || '').trim().toUpperCase()]);
  if (!c) throw err(404, 'Código no válido');
  res.json(c);
}));

// ---------- Pagos y custodia de fondos (SIMULADOS) ----------
// Tarjeta y PayPal: el dinero queda "retenido" al instante. SPEI y efectivo: se genera una referencia y queda "pendiente"
// hasta que se "paga" (aquí con un botón de simulación). Al confirmar la entrega los fondos pasan a "liberado" (al vendedor).
// Si se cancela, vuelven al comprador ("reembolsado"). La CLABE y las referencias son de demostración: no existen en ningún banco.
const clabeDemo = id => { const b = '000000' + String(id).padStart(11, '0'), w = [3, 7, 1]; let t = 0; for (let k = 0; k < 17; k++) t += (b[k] * w[k % 3]) % 10; return b + ((10 - t % 10) % 10); };
const refSpei = id => String(id).padStart(7, '0').slice(-7);
const refEfectivo = id => '97' + String(id).padStart(10, '0') + String((id * 7919) % 100).padStart(2, '0');
const instr = x => x.pago === 'spei' ? { metodo: 'spei', clabe: x.pago_ref, referencia: refSpei(x.id), concepto: 'PSM-' + x.id, beneficiario: 'PuntoSeguro Market (demostración)', vence: x.pago_vence }
  : x.pago === 'oxxo' ? { metodo: 'oxxo', referencia: x.pago_ref, vence: x.pago_vence } : null;
const METODOS = ['tarjeta', 'spei', 'oxxo', 'paypal'];
const codigoSeg = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 8; i++) c += a[require('crypto').randomInt(a.length)]; return c; };

// Un pedido por vendedor. Entrega: 'vendedor' = en el punto que fijó el vendedor, 'chat' = se acuerda por chat con el vendedor.
app.post('/api/pedidos', wrap(async (req, res) => {
  const { items, codigo, nombre, email, pago, modo } = req.body, pg = pago || {};
  const tel = String(req.body.telefono || '').replace(/\D/g, '');
  if (tel.length !== 10) throw err(400, 'Escribe tu celular a 10 dígitos para que el vendedor pueda comunicarse contigo');
  if (!Array.isArray(items) || !items.length || !nombre || !valid(email) || !['vendedor', 'chat'].includes(modo))
    throw err(400, 'Datos del pedido incompletos');
  if (!METODOS.includes(pg.metodo)) throw err(400, 'Elige un método de pago');
  let detalle;
  if (pg.metodo === 'tarjeta') {
    if (!/^\d{4}$/.test(pg.ultimos4 || '') || !['Visa', 'Mastercard', 'American Express'].includes(pg.marca)) throw err(400, 'Revisa los datos de tu tarjeta');
    detalle = pg.marca + ' •••• ' + pg.ultimos4;
  } else if (pg.metodo === 'paypal') {
    if (!valid(pg.email)) throw err(400, 'Escribe el correo de tu cuenta de PayPal');
    detalle = 'PayPal: ' + pg.email;
  } else detalle = pg.metodo === 'spei' ? 'Transferencia SPEI' : 'Efectivo en tienda de conveniencia';
  const retenido = pg.metodo === 'tarjeta' || pg.metodo === 'paypal';
  if (modo === 'chat' && !req.uid) throw err(401, 'Para acordar el punto por chat necesitas iniciar sesión');
  const cn = await pool.getConnection();
  try {
    await cn.beginTransaction();
    const prods = new Map();                       // precios, stock y opciones siempre se leen de la base
    for (const it of items) if (!prods.has(+it.id)) {
      const [[p]] = await cn.query('SELECT p.id,p.nombre,p.precio,p.stock,p.opciones,p.vendedor_id,u.email AS vemail,u.punto_entrega AS punto,u.punto_entrega_id AS punto_id FROM productos_ce p LEFT JOIN usuarios_ce u ON u.id=p.vendedor_id WHERE p.id=? FOR UPDATE OF p', [+it.id]);
      if (!p) throw err(400, 'Producto no válido');
      prods.set(p.id, { ...p, usado: 0 });
    }
    const grupos = new Map();                      // vendedor_id (o 0 = plataforma) -> líneas
    for (const it of items) {
      const p = prods.get(+it.id), q = Math.floor(+it.cant);
      if (!(q >= 1)) throw err(400, 'Producto no válido');
      if (p.vendedor_id && (p.vendedor_id === req.uid || (p.vemail || '').toLowerCase() === String(email).trim().toLowerCase()))
        throw err(403, 'No puedes comprar tu propio producto');
      p.usado += q;
      if (p.stock < p.usado) throw err(409, `Sin stock suficiente de ${p.nombre}`);
      const partes = [], ops = p.opciones || {};
      for (const g of Object.keys(ops)) {          // la variante elegida debe existir en las opciones del producto
        const v = it.variante && it.variante[g];
        if (!ops[g].includes(v)) throw err(400, `Elige ${g} para ${p.nombre}`);
        partes.push(g + ': ' + v);
      }
      const k = p.vendedor_id || 0;
      if (!grupos.has(k)) grupos.set(k, { punto: p.punto, punto_id: p.punto_id, lines: [] });
      grupos.get(k).lines.push([p, q, partes.join(' · ') || null]);
    }
    let c = null;
    if (codigo) [[c]] = await cn.query('SELECT * FROM codigos_descuento_ce WHERE codigo=? AND activo=1 AND tipo=\'porcentaje\'', [codigo]);
    const pagos = []; let totalGral = 0;
    for (const [vid, g] of grupos) {
      if (vid && modo === 'vendedor' && !g.punto) throw err(400, 'Uno de los vendedores aún no definió su punto de entrega. Elige acordarlo por chat.');
      const sub = g.lines.reduce((t, [p, q]) => t + p.precio * q, 0);
      const d = c ? Math.round(sub * c.valor / 100) : 0, total = sub - d;
      const m = vid ? modo : 'tienda', cod = req.uid ? null : codigoSeg();   // los invitados reciben un código para dar seguimiento
      const punto = m === 'vendedor' ? g.punto : m === 'tienda' ? 'Punto Seguro de PuntoSeguro Market (te lo confirmamos por correo)' : null;
      const [r] = await cn.query('INSERT INTO pedidos_ce (usuario_id,nombre,email,telefono,codigo_seguimiento,vendedor_id,entrega_modo,punto_acordado,punto_id,estado,pago,pago_estado,pago_detalle,subtotal,descuento,total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id',
        [req.uid, nombre, email, tel || null, cod, vid || null, m, punto, m === 'vendedor' ? g.punto_id : null, punto ? 1 : 0, pg.metodo, retenido ? 'retenido' : 'pendiente', detalle, sub, d, total]);
      for (const [p, q, vr] of g.lines) {
        await cn.query('INSERT INTO pedido_items_ce (pedido_id,producto_id,nombre,precio,cantidad,variante) VALUES (?,?,?,?,?,?)', [r.insertId, p.id, p.nombre, p.precio, q, vr]);
        await cn.query('UPDATE productos_ce SET stock=stock-?, popularidad=popularidad+? WHERE id=?', [q, q, p.id]);
      }
      let ins = null;
      if (!retenido) {
        const ref = pg.metodo === 'spei' ? clabeDemo(r.insertId) : refEfectivo(r.insertId);
        await cn.query("UPDATE pedidos_ce SET pago_ref=?, pago_vence=now() + (?::int * interval '1 hour') WHERE id=?", [ref, pg.metodo === 'spei' ? 72 : 48, r.insertId]);
        const [[x]] = await cn.query('SELECT id, pago, pago_ref, pago_vence FROM pedidos_ce WHERE id=?', [r.insertId]);
        ins = instr(x);
      }
      pagos.push({ id: r.insertId, codigo: cod, total, metodo: pg.metodo, estado: retenido ? 'retenido' : 'pendiente', detalle, ins });
      totalGral += total;
    }
    await cn.commit();
    res.json({ id: pagos[0].id, ids: pagos.map(x => x.id), total: totalGral, pagos });
  } catch (e) { await cn.rollback(); throw e; } finally { cn.release(); }
}));

const SEL_PED = `pe.*, to_char(pe.creado AT TIME ZONE 'America/Mexico_City','DD/MM/YYYY') AS d, pe.total AS t, pe.estado AS st,
  ps.lat AS plat, ps.lng AS plng, pp.lat AS prlat, pp.lng AS prlng, v.nombre AS nom_v, v.ine_estado AS ine_v, c.nombre AS nom_c, c.ine_estado AS ine_c`;
const JOIN_PED = `FROM pedidos_ce pe LEFT JOIN usuarios_ce v ON v.id=pe.vendedor_id LEFT JOIN usuarios_ce c ON c.id=pe.usuario_id
  LEFT JOIN puntos_seguros_ce ps ON ps.id=pe.punto_id LEFT JOIN puntos_seguros_ce pp ON pp.id=pe.punto_propuesto_id`;
const vista = (x, yo, rol) => ({ id: x.id, d: x.d, t: x.t, st: x.st, modo: x.entrega_modo, punto: x.punto_acordado || '', plat: x.plat, plng: x.plng,
  inv: !x.usuario_id, mail: x.email, tel: rol === 'v' ? (x.telefono || '') : '', prop: x.punto_propuesto || '', prlat: x.prlat, prlng: x.prlng, mio: !!x.punto_propuesto && x.propuesto_por === yo,
  otro: rol === 'c' ? (x.nom_v || '') : x.nombre, comprador: x.nombre,
  ine_yo: (rol === 'c' ? x.ine_c : x.ine_v) === 'verificada', ine_otro: (rol === 'c' ? x.ine_v : x.ine_c) === 'verificada',
  cc: x.comprador_confirmo, vc: x.vendedor_confirmo, pago: x.pago, pe: x.pago_estado, pd: x.pago_detalle || '', ins: instr(x) });
async function conItems(o, yo, rol) {
  for (const x of o) {
    const [it] = await pool.query('SELECT nombre, cantidad, variante FROM pedido_items_ce WHERE pedido_id=? ORDER BY id', [x.id]);
    x.items = it.map(i => i.nombre + (i.variante ? ' (' + i.variante + ')' : '') + ' ×' + i.cantidad);
  }
  return o.map(x => ({ ...vista(x, yo, rol), items: x.items }));
}
app.get('/api/pedidos', need, wrap(async (req, res) => {
  const [o] = await pool.query(`SELECT ${SEL_PED} ${JOIN_PED} WHERE pe.usuario_id=? ORDER BY pe.id`, [req.uid]);
  res.json((await conItems(o, req.uid, 'c')).map(x => ({ ...x, id: 'PED-' + x.id, n: x.id })));
}));

// Pagar una referencia SPEI / efectivo (simulado). Lo hace el comprador con cuenta o, si compró como invitado, con su correo.
app.post('/api/pedidos/:id/simular-pago', wrap(async (req, res) => {
  const [[p]] = await pool.query('SELECT * FROM pedidos_ce WHERE id=?', [req.params.id]);
  const mio = p && ((req.uid && p.usuario_id === req.uid) || (!p.usuario_id && String(req.body.email || '').trim().toLowerCase() === p.email.toLowerCase()));
  if (!mio) throw err(404, 'Pedido no encontrado');
  if (p.pago_estado !== 'pendiente') throw err(400, 'Este pedido no tiene un pago pendiente');
  if (p.pago_vence && new Date(p.pago_vence) < new Date()) throw err(410, 'La referencia de pago venció');
  await pool.query("UPDATE pedidos_ce SET pago_estado='retenido' WHERE id=?", [p.id]);
  res.json({ ok: true });
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
  let t = String(req.body.punto || '').trim().slice(0, 300), pid = null;
  if (req.body.punto_id) {                         // propuso uno de los Puntos Seguros del mapa
    const [[ps]] = await pool.query('SELECT id, nombre, direccion FROM puntos_seguros_ce WHERE id=? AND activo=1', [+req.body.punto_id]);
    if (!ps) throw err(400, 'Ese Punto Seguro ya no está disponible');
    pid = ps.id; t = (ps.nombre + ', ' + ps.direccion).slice(0, 300);
  }
  if (!t) throw err(400, 'Escribe el lugar propuesto');
  await pool.query('UPDATE pedidos_ce SET punto_propuesto=?, punto_propuesto_id=?, propuesto_por=? WHERE id=?', [t, pid, req.uid, req.params.id]);
  await pool.query('INSERT INTO mensajes_pedido_ce (pedido_id,usuario_id,texto) VALUES (?,?,?)', [req.params.id, req.uid, '📍 Propongo vernos en: ' + t]);
  res.json({ ok: true });
}));
app.post('/api/pedidos/:id/aceptar', need, part, wrap(async (req, res) => {        // acepta quien NO propuso
  const p = req.ped;
  if (p.entrega_modo !== 'chat' || p.estado !== 0 || !p.punto_propuesto) throw err(400, 'No hay un punto por aceptar');
  if (p.propuesto_por === req.uid) throw err(403, 'Debe aceptarlo la otra persona');
  await pool.query('UPDATE pedidos_ce SET punto_acordado=punto_propuesto, punto_id=punto_propuesto_id, punto_propuesto=NULL, punto_propuesto_id=NULL, propuesto_por=NULL, estado=1 WHERE id=?', [p.id]);
  await pool.query('INSERT INTO mensajes_pedido_ce (pedido_id,usuario_id,texto) VALUES (?,?,?)', [p.id, req.uid, '✅ Acepto el punto: ' + p.punto_propuesto]);
  res.json({ ok: true });
}));
// La entrega se completa cuando CONFIRMAN las dos partes: el comprador ("recibí e inspeccioné") y el vendedor ("entregué").
// Al completarse se liberan los fondos en custodia y el producto sale del catálogo si ya no tiene stock. (En compras a la tienda solo confirma el comprador.)
async function confirmar(req, res, esComprador) {
  const p = req.ped;
  if (esComprador !== !!req.soyComprador) throw err(403, esComprador ? 'Solo el comprador confirma que recibió' : 'Solo el vendedor confirma que entregó');
  if (p.estado !== 1) throw err(400, 'Primero debe acordarse el punto de entrega');
  if (p.pago_estado !== 'retenido') throw err(409, 'El pago aún no está en custodia. Debe pagarse la referencia antes de entregar');
  const col = esComprador ? 'comprador_confirmo' : 'vendedor_confirmo';
  if (p[col]) throw err(400, 'Ya confirmaste esta entrega');
  if (process.env.REQUIRE_INE === '1') {           // opcional: exigir identidad verificada a ambas partes
    const [r] = await pool.query("SELECT COUNT(*) AS n FROM usuarios_ce WHERE id IN (?,?) AND ine_estado='verificada'", [p.usuario_id, p.vendedor_id || 0]);
    if (r[0].n < (p.usuario_id ? 1 : 0) + (p.vendedor_id ? 1 : 0)) throw err(409, 'Comprador y vendedor deben verificar su identidad con INE antes de entregar');
  }
  await pool.query(`UPDATE pedidos_ce SET ${col}=1 WHERE id=?`, [p.id]);
  const [[x]] = await pool.query('SELECT comprador_confirmo AS cc, vendedor_confirmo AS vc FROM pedidos_ce WHERE id=?', [p.id]);
  const completo = x.cc === 1 && (x.vc === 1 || !p.vendedor_id);
  if (completo) await pool.query("UPDATE pedidos_ce SET estado=2, pago_estado='liberado' WHERE id=?", [p.id]);
  if (p.entrega_modo !== 'tienda' && p.usuario_id)
    await pool.query('INSERT INTO mensajes_pedido_ce (pedido_id,usuario_id,texto) VALUES (?,?,?)', [p.id, req.uid, esComprador ? '✅ Confirmo que recibí el producto' : '✅ Confirmo que entregué el producto']);
  res.json({ ok: true, completo });
}
app.post('/api/pedidos/:id/recibido', need, part, wrap((req, res) => confirmar(req, res, true)));
app.post('/api/pedidos/:id/entregado', need, part, wrap((req, res) => confirmar(req, res, false)));
async function cancelarPedido(p, uid) {            // cancela antes de entregar: el dinero vuelve al comprador y el stock se repone
  if (p.estado > 1 || p.comprador_confirmo || p.vendedor_confirmo) throw err(400, 'Este pedido ya no se puede cancelar');
  const cn = await pool.getConnection();
  try {
    await cn.beginTransaction();
    const [it] = await cn.query('SELECT producto_id, cantidad FROM pedido_items_ce WHERE pedido_id=?', [p.id]);
    for (const i of it) await cn.query('UPDATE productos_ce SET stock=stock+? WHERE id=?', [i.cantidad, i.producto_id]);
    await cn.query('UPDATE pedidos_ce SET estado=3, pago_estado=?, punto_propuesto=NULL, punto_propuesto_id=NULL WHERE id=?', [p.pago_estado === 'retenido' ? 'reembolsado' : 'cancelado', p.id]);
    if (p.entrega_modo !== 'tienda' && p.usuario_id && uid)
      await cn.query('INSERT INTO mensajes_pedido_ce (pedido_id,usuario_id,texto) VALUES (?,?,?)', [p.id, uid, '❌ Pedido cancelado' + (p.pago_estado === 'retenido' ? '. Los fondos se devuelven al comprador.' : '.')]);
    await cn.commit();
  } catch (e) { await cn.rollback(); throw e; } finally { cn.release(); }
}
app.post('/api/pedidos/:id/cancelar', need, part, wrap(async (req, res) => { await cancelarPedido(req.ped, req.uid); res.json({ ok: true }); }));

// ---------- Seguimiento de pedidos de invitados (número de pedido + código) ----------
const intentos = new Map();                         // límite sencillo contra adivinar códigos: 30 intentos por IP cada 15 min
const limita = (req, res, next) => {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim(), t = Date.now(), r = intentos.get(ip);
  if (!r || r.reset < t) intentos.set(ip, { n: 1, reset: t + 900000 });
  else if (++r.n > 30) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo' });
  next();
};
const pedidoInvitado = async body => {
  const id = parseInt(String(body.pedido || '').replace(/\D/g, ''), 10), cod = String(body.codigo || '').trim().toUpperCase();
  const [[p]] = id && cod ? await pool.query('SELECT * FROM pedidos_ce WHERE id=? AND codigo_seguimiento=? AND usuario_id IS NULL', [id, cod]) : [[]];
  if (!p) throw err(404, 'No encontramos un pedido con ese número y código. Revísalos');
  return p;
};
const verSeguimiento = async p => {
  const [o] = await pool.query(`SELECT ${SEL_PED} ${JOIN_PED} WHERE pe.id=?`, [p.id]);
  const [x] = await conItems(o, null, 'c');
  return { ...x, n: p.id };
};
app.post('/api/seguimiento', limita, wrap(async (req, res) => { res.json(await verSeguimiento(await pedidoInvitado(req.body))); }));
app.post('/api/seguimiento/pagar', limita, wrap(async (req, res) => {
  const p = await pedidoInvitado(req.body);
  if (p.pago_estado !== 'pendiente') throw err(400, 'Este pedido no tiene un pago pendiente');
  if (p.pago_vence && new Date(p.pago_vence) < new Date()) throw err(410, 'La referencia de pago venció');
  await pool.query("UPDATE pedidos_ce SET pago_estado='retenido' WHERE id=?", [p.id]);
  res.json(await verSeguimiento(p));
}));
app.post('/api/seguimiento/recibido', limita, wrap(async (req, res) => {   // el invitado confirma con su código; cuenta como confirmación del comprador
  const p = await pedidoInvitado(req.body), fake = { ped: p, soyComprador: true, uid: null };
  let r; await confirmar(fake, { json: x => { r = x; } }, true);
  res.json({ ...r, pedido: await verSeguimiento(p) });
}));
app.post('/api/seguimiento/cancelar', limita, wrap(async (req, res) => { const p = await pedidoInvitado(req.body); await cancelarPedido(p, null); res.json(await verSeguimiento(p)); }));

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

// ---------- Mensajes de contacto, suscriptores y Puntos Seguros (administración) ----------
const adm = (req, res, next) => (ADMIN_KEY && req.headers['x-admin-key'] === ADMIN_KEY) ? next() : res.status(403).json({ error: 'Clave de administrador incorrecta' });
app.get('/api/admin/mensajes', adm, wrap(async (req, res) => {
  const [m] = await pool.query("SELECT id, nombre, email, mensaje, leido, to_char(creado AT TIME ZONE 'America/Mexico_City','DD/MM/YYYY HH24:MI') AS f FROM mensajes_contacto_ce ORDER BY id DESC");
  const [s] = await pool.query("SELECT email, to_char(creado AT TIME ZONE 'America/Mexico_City','DD/MM/YYYY') AS f FROM suscriptores_newsletter_ce ORDER BY id DESC");
  res.json({ mensajes: m, suscriptores: s });
}));
app.put('/api/admin/mensajes/:id', adm, wrap(async (req, res) => {
  await pool.query('UPDATE mensajes_contacto_ce SET leido=? WHERE id=?', [+!!req.body.leido, req.params.id]);
  res.json({ ok: true });
}));
app.delete('/api/admin/mensajes/:id', adm, wrap(async (req, res) => {
  await pool.query('DELETE FROM mensajes_contacto_ce WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));
const datosPunto = b => {
  const nombre = String(b.nombre || '').trim().slice(0, 120), dir = String(b.direccion || '').trim().slice(0, 250), lat = +b.lat, lng = +b.lng;
  if (!nombre || !dir || !(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180) || b.lat === '' || b.lng === '') throw err(400, 'Completa nombre, dirección y ubicación en el mapa');
  return [nombre, dir, String(b.horario || '').trim().slice(0, 120) || null, String(b.descripcion || '').trim() || null, lat, lng, +!!b.verificado, +(b.activo !== false && b.activo !== 0)];
};
app.get('/api/admin/puntos', adm, wrap(async (req, res) => { const [r] = await pool.query('SELECT * FROM puntos_seguros_ce ORDER BY id'); res.json(r); }));
app.post('/api/admin/puntos', adm, wrap(async (req, res) => {
  const [r] = await pool.query('INSERT INTO puntos_seguros_ce (nombre,direccion,horario,descripcion,lat,lng,verificado,activo) VALUES (?,?,?,?,?,?,?,?) RETURNING id', datosPunto(req.body));
  res.json({ id: r.insertId });
}));
app.put('/api/admin/puntos/:id', adm, wrap(async (req, res) => {
  await pool.query('UPDATE puntos_seguros_ce SET nombre=?, direccion=?, horario=?, descripcion=?, lat=?, lng=?, verificado=?, activo=? WHERE id=?', [...datosPunto(req.body), req.params.id]);
  res.json({ ok: true });
}));
app.delete('/api/admin/puntos/:id', adm, wrap(async (req, res) => { await pool.query('DELETE FROM puntos_seguros_ce WHERE id=?', [req.params.id]); res.json({ ok: true }); }));

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
  const condicion = ['nuevo', 'seminuevo', 'usado'].includes(b.condicion) ? b.condicion : 'usado';
  const opciones = {};                                // [{nombre:'Color', valores:'Negro, Azul'}] -> {"Color":["Negro","Azul"]}
  for (const g of Array.isArray(b.opciones) ? b.opciones.slice(0, 3) : []) {
    const n = t(g.nombre).slice(0, 30), v = [...new Set(t(g.valores).split(',').map(x => x.trim().slice(0, 30)).filter(Boolean))].slice(0, 12);
    if (n && v.length) opciones[n] = v;
  }
  const [r] = await pool.query('INSERT INTO productos_ce (nombre,descripcion,emoji,color,categoria_id,marca_id,precio,precio_anterior,stock,es_nuevo,vendedor_id,condicion,opciones) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb) RETURNING id',
    [t(b.nombre), t(b.descripcion), t(b.emoji) || '📦', color, sub, marca, precio, ant, stock, +!!b.es_nuevo, vendedor || null, condicion, JSON.stringify(opciones)]);
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
  const [o] = await pool.query(`SELECT ${SEL_PED} ${JOIN_PED} WHERE pe.vendedor_id=? ORDER BY pe.id DESC`, [req.uid]);
  res.json((await conItems(o, req.uid, 'v')).map(x => ({ ...x, n: x.id })));
}));
app.use((e, req, res, next) => {                 // errores que no pasaron por wrap(): subida de archivos, JSON inválido, etc.
  if (e && e.name === 'MulterError') return res.status(400).json({ error: SUBE });
  if (e && e.type === 'entity.parse.failed') return res.status(400).json({ error: 'Solicitud no válida' });
  console.error(e);
  res.status(500).json({ error: 'Error del servidor' });
});

module.exports = app;
