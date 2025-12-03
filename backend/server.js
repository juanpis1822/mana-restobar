require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración básica
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// --- BASE DE DATOS ---
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, 'manacoffee.db');
let db;

// Inicializar DB
const initDB = () => new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) { console.error('Error BD:', err); reject(err); }
        else { 
            console.log('✅ Conectado a SQLite');
            // Ejecutamos migraciones y luego creamos tablas si faltan
            fixDatabaseStructure().then(() => {
                createTables().then(resolve).catch(reject);
            });
        }
    });
});

// Helpers para Promesas
const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
    });
});

const getAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const allAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// --- AUTO-REPARACIÓN (FIX PARA EL ERROR "NO SUCH COLUMN: TOKEN") ---
const fixDatabaseStructure = () => new Promise((resolve) => {
    console.log('🔄 Verificando estructura de la base de datos...');
    
    // Intenta agregar la columna token. Si ya existe, dará error pero no importa, seguimos.
    db.run("ALTER TABLE admin ADD COLUMN token TEXT", (err) => {
        if (!err) console.log("✨ Columna 'token' agregada exitosamente.");
        resolve(); // Continuamos siempre
    });
});

// Crear Tablas
const createTables = () => new Promise((resolve, reject) => {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS dishes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, category TEXT, price INTEGER, description TEXT, image LONGTEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS reservations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, date TEXT, timeSlot TEXT, guests INTEGER, items TEXT, total INTEGER, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        
        // Tabla Admin (con token)
        db.run(`CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, token TEXT)`);
        
        db.run(`CREATE TABLE IF NOT EXISTS config (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE, value TEXT)`);

        // Datos por defecto
        db.run(`INSERT OR IGNORE INTO admin (username, password) VALUES (?, ?)`, ['admin', '1234']);
        db.run(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, ['minHours', '8']);
        db.run(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, ['maxCapacity', '30']);
        db.run(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, ['timeSlots', '["12:00-13:00", "13:00-14:00", "18:00-19:00", "19:00-20:00"]']);

        resolve();
    });
});

// --- MIDDLEWARE DE SEGURIDAD ---
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'No autorizado' });

    try {
        const admin = await getAsync('SELECT * FROM admin WHERE token = ?', [token]);
        if (!admin) return res.status(403).json({ error: 'Sesión expirada' });
        next();
    } catch (err) {
        return res.status(500).json({ error: 'Error de autenticación' });
    }
};

// --- RUTAS API ---

// Login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await getAsync('SELECT * FROM admin WHERE username = ? AND password = ?', [username, password]);
        
        if (!admin) return res.status(401).json({ error: 'Credenciales inválidas' });

        const token = crypto.randomBytes(32).toString('hex');
        await runAsync('UPDATE admin SET token = ? WHERE username = ?', [token, username]);

        res.json({ message: 'OK', token: token });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Logout
app.post('/api/admin/logout', async (req, res) => {
    try {
        await runAsync('UPDATE admin SET token = NULL');
        res.json({ message: 'Sesión cerrada' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cambiar Password (Protegido)
app.put('/api/admin/password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const admin = await getAsync('SELECT * FROM admin WHERE username = ?', ['admin']);
        
        if (admin.password !== currentPassword) {
            return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
        }

        await runAsync('UPDATE admin SET password = ? WHERE username = ?', [newPassword, 'admin']);
        res.json({ message: 'Contraseña actualizada' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Platos
app.get('/api/dishes', async (req, res) => {
    try { const r = await allAsync('SELECT * FROM dishes ORDER BY id DESC'); res.json(r); } 
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/dishes', requireAuth, async (req, res) => {
    try {
        const { name, category, price, description, image } = req.body;
        await runAsync('INSERT INTO dishes (name, category, price, description, image) VALUES (?,?,?,?,?)', [name, category, price, description, image]);
        res.json({ message: 'Creado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/dishes/:id', requireAuth, async (req, res) => {
    try { await runAsync('DELETE FROM dishes WHERE id = ?', [req.params.id]); res.json({ message: 'Eliminado' }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// Reservas
app.get('/api/reservations', requireAuth, async (req, res) => {
    try {
        const r = await allAsync('SELECT * FROM reservations ORDER BY date DESC');
        r.forEach(x => { try{x.items=JSON.parse(x.items)}catch{x.items=[]} });
        res.json(r);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reservations/:id', requireAuth, async (req, res) => {
    try {
        const r = await getAsync('SELECT * FROM reservations WHERE id=?', [req.params.id]);
        try{r.items=JSON.parse(r.items)}catch{r.items=[]}
        res.json(r);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reservations', async (req, res) => {
    try {
        const { name, phone, date, timeSlot, guests, items, total } = req.body;
        const conf = await getAsync('SELECT value FROM config WHERE key="maxCapacity"');
        const max = parseInt(conf?.value || 30);
        const used = (await allAsync('SELECT SUM(guests) as t FROM reservations WHERE date=? AND timeSlot=?', [date, timeSlot]))[0]?.t || 0;
        
        if(used + guests > max) return res.status(400).json({ error: 'Sin cupo suficiente' });

        await runAsync('INSERT INTO reservations (name, phone, date, timeSlot, guests, items, total) VALUES (?,?,?,?,?,?,?)', [name, phone, date, timeSlot, guests, JSON.stringify(items), total]);
        res.json({ message: 'Reserva exitosa' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/reservations/:id', requireAuth, async (req, res) => {
    try { await runAsync('DELETE FROM reservations WHERE id=?', [req.params.id]); res.json({ message: 'Eliminado' }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// Config
app.get('/api/config', async (req, res) => {
    const configs = await allAsync('SELECT * FROM config');
    const r = {}; configs.forEach(c => { try{r[c.key]=JSON.parse(c.value)}catch{r[c.key]=c.value} });
    res.json(r);
});

app.put('/api/config/:key', requireAuth, async (req, res) => {
    const val = typeof req.body.value === 'string' ? req.body.value : JSON.stringify(req.body.value);
    await runAsync('INSERT OR REPLACE INTO config (key, value) VALUES (?,?)', [req.params.key, val]);
    res.json({ message: 'Guardado' });
});

// Instagram (Opcional)
app.get('/api/instagram', async (req, res) => {
    try {
        const token = process.env.INSTAGRAM_ACCESS_TOKEN;
        if (!token) return res.json([]);
        const url = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&access_token=${token}`;
        const response = await axios.get(url);
        res.json(response.data.data.slice(0, 3));
    } catch { res.json([]); }
});

app.get('/api/health', (req, res) => res.json({ status: 'OK' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('*.html', (req, res) => res.sendFile(path.join(__dirname, '../frontend', req.path)));

// Servidor
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('❌ Error fatal:', err);
});
