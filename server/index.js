// Arranque local: npm start  ->  http://localhost:3000   (en Vercel se usa api/index.js)
const app = require('./app');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Tienda en http://localhost:${PORT}`));
