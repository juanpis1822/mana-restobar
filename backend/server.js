require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const axios = require('axios'); // Para la API de Instagram si la usas

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// --- CONFIGURACIÓN DE BASE DE DATOS ---
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, 'manacoffee.db');
let db;

const initDB = () => new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) { console.error('Error BD:', err); reject(err); }
        else { 
            console.log('✅ Conectado a SQLite');
            migrateTables().then(createTables).then(resolve).catch(reject);
        }
    });
});

// --- HELPERS PARA PROMESAS (CORREGIDOS) ---
// Estos son los que arreglan el error del Login

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

// --- MIGRACIONES Y TABLAS ---
const migrateTables = () => new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='reservations'", (err, tables) => {
        if (err) { reject(err); return; }
        if (tables && tables.length > 0) {
            db.all("PRAGMA table_info(reservations)", (err, columns) => {
                if (err) { reject(err); return; }
                const hasTimeSlot = columns.some(col => col.name === 'timeSlot');
                if (!hasTimeSlot) {
                    console.log('🔄 Migrando tabla reservations...');
                    db.run('ALTER TABLE reservations RENAME TO reservations_old', (err) => {
                        if (err) { reject(err); return; }
                        console.log('✓ Tabla renombrada');
                        resolve();
                    });
                } else {
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
});

const createTables = () => new Promise((resolve, reject) => {
    db.serialize(() => {
        // Platos
        db.run(`CREATE TABLE IF NOT EXISTS dishes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price INTEGER NOT NULL,
            description TEXT,
            image LONGTEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Reservas
        db.run(`CREATE TABLE IF NOT EXISTS reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            date TEXT NOT NULL,
            timeSlot TEXT NOT NULL,
            guests INTEGER NOT NULL,
            items TEXT NOT NULL,
            total INTEGER NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Admin
        db.run(`CREATE TABLE IF NOT EXISTS admin (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )`);

        // Configuración
        db.run(`CREATE TABLE IF NOT EXISTS config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT NOT NULL
        )`);

        // Datos por defecto (Clave inicial: 1234)
        db.run(`INSERT OR IGNORE INTO admin (username, password) VALUES (?, ?)`, ['admin', '1234']);
        db.run(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, ['minHours', '8']);
        db.run(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, ['maxCapacity', '30']);
        db.run(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, ['timeSlots', '["12:00-13:00", "13:00-14:00", "18:00-19:00", "19:00-20:00"]']);

        resolve();
    });
});

// --- RUTAS DE LA API ---

// 1. PLATOS (DISHES)
app.get('/api/dishes', async (req, res) => {
    try {
        const dishes = await allAsync('SELECT * FROM dishes ORDER BY id DESC');
        res.json(dishes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/dishes', async (req, res) => {
    try {
        const { name, category, price, description, image } = req.body;
        if (!name || !category || !price) return res.status(400).json({ error: 'Faltan campos' });
        
        const result = await runAsync(
            `INSERT INTO dishes (name, category, price, description, image) VALUES (?, ?, ?, ?, ?)`,
            [name, category, price, description || '', image || null]
        );
        res.status(201).json({ id: result.id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/dishes/:id', async (req, res) => {
    try {
        await runAsync('DELETE FROM dishes WHERE id = ?', [req.params.id]);
        res.json({ message: 'Eliminado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. RESERVAS (RESERVATIONS)
app.get('/api/reservations', async (req, res) => {
    try {
        const reservations = await allAsync('SELECT * FROM reservations ORDER BY date DESC, timeSlot ASC');
        reservations.forEach(r => { 
            try { r.items = JSON.parse(r.items); } catch(e) { r.items = []; }
        });
        res.json(reservations);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reservations/:id', async (req, res) => {
    try {
        const reservation = await getAsync('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
        if (!reservation) return res.status(404).json({ error: 'No encontrada' });
        try { reservation.items = JSON.parse(reservation.items); } catch(e) { reservation.items = []; }
        res.json(reservation);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reservations', async (req, res) => {
    try {
        const { name, phone, date, timeSlot, guests, items, total } = req.body;
        if (!name || !phone || !date || !timeSlot || !guests || !items) return res.status(400).json({ error: 'Faltan campos' });

        const config = await getAsync('SELECT value FROM config WHERE key = ?', ['maxCapacity']);
        const maxCapacity = parseInt(config?.value || 30);

        const reservasHora = await allAsync(
            'SELECT SUM(guests) as totalGuests FROM reservations WHERE date = ? AND timeSlot = ?',
            [date, timeSlot]
        );
        const totalInSlot = reservasHora[0]?.totalGuests || 0;

        if (totalInSlot + guests > maxCapacity) {
            return res.status(400).json({ error: `Capacidad limitada. Disponible: ${maxCapacity - totalInSlot}` });
        }

        const result = await runAsync(
            `INSERT INTO reservations (name, phone, date, timeSlot, guests, items, total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, phone, date, timeSlot, guests, JSON.stringify(items), total]
        );
        res.status(201).json({ id: result.id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/reservations/:id', async (req, res) => {
    try {
        await runAsync('DELETE FROM reservations WHERE id = ?', [req.params.id]);
        res.json({ message: 'Eliminado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. CONFIGURACIÓN (CONFIG)
app.get('/api/config', async (req, res) => {
    try {
        const configs = await allAsync('SELECT key, value FROM config');
        const result = {};
        configs.forEach(c => {
            try { result[c.key] = JSON.parse(c.value); } catch { result[c.key] = c.value; }
        });
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/config/:key', async (req, res) => {
    try {
        const { value } = req.body;
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        await runAsync(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`, [req.params.key, valueStr]);
        res.json({ message: 'Actualizado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. ADMIN & LOGIN (Rutas Corregidas)
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Esta es la consulta que fallaba antes. Ahora usará el getAsync corregido.
        const admin = await getAsync('SELECT * FROM admin WHERE username = ? AND password = ?', [username, password]);
        
        if (!admin) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        
        res.json({ message: 'OK' });
    } catch (err) { 
        console.error("Login Error:", err);
        res.status(500).json({ error: err.message }); 
    }
});

// CAMBIAR CONTRASEÑA
app.put('/api/admin/password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Faltan datos' });

        // 1. Verificar actual
        const admin = await getAsync('SELECT * FROM admin WHERE username = ?', ['admin']);
        
        if (!admin || admin.password !== currentPassword) {
            return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
        }

        // 2. Actualizar
        await runAsync('UPDATE admin SET password = ? WHERE username = ?', [newPassword, 'admin']);
        
        res.json({ message: 'Contraseña actualizada' });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// --- RUTA INSTAGRAM (Opcional - solo si tienes token en .env) ---
app.get('/api/instagram', async (req, res) => {
    try {
        const token = process.env.INSTAGRAM_ACCESS_TOKEN;
        if (!token) return res.json([]); // Si no hay token, devuelve vacío

        const url = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&access_token=${token}`;
        const response = await axios.get(url);
        const data = response.data.data || [];
        res.json(data.slice(0, 3));
    } catch (error) {
        // No rompemos el servidor si falla instagram
        console.error('Error Instagram');
        res.json([]);
    }
});

// --- INICIO DEL SERVIDOR ---
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// Servir frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('*.html', (req, res) => res.sendFile(path.join(__dirname, '../frontend', req.path)));

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
});

initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('❌ Error al iniciar la base de datos:', err);
});