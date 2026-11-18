// Conexión a PostgreSQL (Supabase). Ofrece la misma forma de uso que mysql2: pool.query(sql, [params]) -> [filas]
// Escribe los parámetros con "?" y aquí se convierten a $1, $2...
const { Pool, types } = require('pg');
types.setTypeParser(1700, parseFloat);          // NUMERIC -> número (precios)
types.setTypeParser(20, v => parseInt(v, 10));  // BIGINT -> número

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Falta DATABASE_URL (la cadena de conexión de Supabase). Revisa tu archivo .env');
const local = /@(localhost|127\.0\.0\.1)/.test(url);
const pool = new Pool({
  connectionString: url,
  ssl: local ? false : { rejectUnauthorized: false },
  max: process.env.VERCEL ? 1 : 10               // en Vercel cada función usa pocas conexiones
});

const conv = sql => { let n = 0; return sql.replace(/\?/g, () => '$' + (++n)); };
const run = (c, sql, params) => c.query(conv(sql), params).then(r =>
  [r.command === 'SELECT' ? r.rows : { insertId: r.rows[0] && r.rows[0].id, affectedRows: r.rowCount }]);

module.exports = {
  query: (sql, params) => run(pool, sql, params),
  async getConnection() {
    const c = await pool.connect();
    return {
      query: (sql, params) => run(c, sql, params),
      beginTransaction: () => c.query('BEGIN'), commit: () => c.query('COMMIT'),
      rollback: () => c.query('ROLLBACK'), release: () => c.release()
    };
  }
};
