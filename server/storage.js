// Fotos de productos: en Supabase Storage (bucket público). Sin Supabase configurado, en public/uploads (solo para desarrollo local).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), KEY = process.env.SUPABASE_SERVICE_KEY, BUCKET = process.env.SUPABASE_BUCKET || 'productos';
const nube = !!(URL_ && KEY);
const dir = path.join(__dirname, '..', 'public', 'uploads', 'productos');
const H = { apikey: KEY, ...(/^eyJ/.test(KEY || '') ? { Authorization: 'Bearer ' + KEY } : {}) };   // llave JWT (service_role) o llave nueva (sb_secret_...)

async function guardar(file) {                    // file viene de multer (en memoria); devuelve la URL pública
  const nombre = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(file.originalname).toLowerCase();
  if (nube) {
    const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${nombre}`, { method: 'POST', headers: { ...H, 'Content-Type': file.mimetype, 'x-upsert': 'false' }, body: file.buffer });
    if (!r.ok) { console.error('Storage:', r.status, await r.text()); throw Object.assign(new Error('No se pudo guardar la foto'), { status: 502 }); }
    return `${URL_}/storage/v1/object/public/${BUCKET}/${nombre}`;
  }
  if (process.env.VERCEL) throw Object.assign(new Error('Falta configurar SUPABASE_URL y SUPABASE_SERVICE_KEY'), { status: 500 });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, nombre), file.buffer);
  return '/uploads/productos/' + nombre;
}
async function borrar(ruta) {
  const nombre = path.basename(String(ruta));
  try {
    if (nube && /^https?:/.test(ruta)) await fetch(`${URL_}/storage/v1/object/${BUCKET}/${nombre}`, { method: 'DELETE', headers: H });
    else if (!/^https?:/.test(ruta)) fs.unlink(path.join(dir, nombre), () => {});
  } catch (e) { console.error('Storage (borrar):', e.message); }
}
module.exports = { guardar, borrar };
