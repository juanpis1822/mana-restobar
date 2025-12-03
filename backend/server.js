require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto'); // Para generar tokens de seguridad

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
            createTables().then(resolve).catch(reject);
        }
    });
});

// Helpers para Promesas (Async/Await)
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

// Crear Tablas
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

        // Admin (Ahora con columna TOKEN para seguridad)
        db.run(`CREATE TABLE IF NOT EXISTS admin (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            token TEXT
        )`);

        // Configuración
        db.run(`CREATE TABLE IF NOT EXISTS config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT NOT NULL
        )`);

        // Datos por defecto (Admin inicial)
        db.run(`INSERT OR IGNORE INTO admin (username, password) VALUES (?, ?)`, ['admin', '1234']);
        db.run(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, ['minHours', '8']);
        db.run(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, ['maxCapacity', '30']);
        db.run(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, ['timeSlots', '["12:00-13:00", "13:00-14:00", "18:00-19:00", "19:00-20:00"]']);

        resolve();
    });
});

// --- MIDDLEWARE DE SEGURIDAD (PROTECTOR DE RUTAS) ---
// Esta función verifica si quien pide datos es el admin real
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN123"

    if (!token) return res.status(401).json({ error: 'No autorizado. Falta token.' });

    try {
        // Buscamos si existe un admin con ese token activo
        const admin = await getAsync('SELECT * FROM admin WHERE token = ?', [token]);
        
        if (!admin) {
            return res.status(403).json({ error: 'Sesión expirada o inválida' });
        }
        
        // Si existe, dejamos pasar
        next();
    } catch (err) {
        return res.status(500).json({ error: 'Error de autenticación' });
    }
};

// ==========================================
// RUTAS DE LA API
// ==========================================

// --- 1. LOGIN & SEGURIDAD ---

// Login (Genera el token de sesión)
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await getAsync('SELECT * FROM admin WHERE username = ? AND password = ?', [username, password]);
        
        if (!admin) return res.status(401).json({ error: 'Credenciales inválidas' });

        // Generar un token único y seguro
        const token = crypto.randomBytes(32).toString('hex');
        
        // Guardar el token en la BD para este usuario
        await runAsync('UPDATE admin SET token = ? WHERE username = ?', [token, username]);

        res.json({ message: 'Bienvenido', token: token });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Logout (Borra el token para cerrar sesión real)
app.post('/api/admin/logout', async (req, res) => {
    try {
        // Borramos el token de todos los admins (o podrías hacerlo por usuario si envías quién es)
        await runAsync('UPDATE admin SET token = NULL');
        res.json({ message: 'Sesión cerrada' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cambiar Contraseña (PROTEGIDO)
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

// --- 2. PLATOS (DISHES) ---

// Ver platos (Público)
app.get('/api/dishes', async (req, res) => {
    try {
        const dishes = await allAsync('SELECT * FROM dishes ORDER BY id DESC');
        res.json(dishes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Crear plato (PROTEGIDO)
app.post('/api/dishes', requireAuth, async (req, res) => {
    try {
        const { name, category, price, description, image } = req.body;
        if (!name || !price) return res.status(400).json({ error: 'Faltan datos' });
        
        await runAsync(
            `INSERT INTO dishes (name, category, price, description, image) VALUES (?, ?, ?, ?, ?)`,
            [name, category, price, description || '', image || null]
        );
        res.json({ message: 'Plato creado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Borrar plato (PROTEGIDO)
app.delete('/api/dishes/:id', requireAuth, async (req, res) => {
    try {
        await runAsync('DELETE FROM dishes WHERE id = ?', [req.params.id]);
        res.json({ message: 'Eliminado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 3. RESERVAS ---

// Ver reservas (PROTEGIDO - Solo el admin debe ver la lista completa)
app.get('/api/reservations', requireAuth, async (req, res) => {
    try {
        const reservations = await allAsync('SELECT * FROM reservations ORDER BY date DESC, timeSlot ASC');
        reservations.forEach(r => { 
            try { r.items = JSON.parse(r.items); } catch(e) { r.items = []; }
        });
        res.json(reservations);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ver detalle de una reserva (PROTEGIDO)
app.get('/api/reservations/:id', requireAuth, async (req, res) => {
    try {
        const reservation = await getAsync('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
        if (!reservation) return res.status(404).json({ error: 'No encontrada' });
        try { reservation.items = JSON.parse(reservation.items); } catch(e) { reservation.items = []; }
        res.json(reservation);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Crear reserva (PÚBLICO - Los clientes deben poder reservar)
app.post('/api/reservations', async (req, res) => {
    try {
        const { name, phone, date, timeSlot, guests, items, total } = req.body;
        if (!name || !date || !timeSlot) return res.status(400).json({ error: 'Faltan datos' });

        // Verificar capacidad
        const config = await getAsync('SELECT value FROM config WHERE key = ?', ['maxCapacity']);
        const maxCapacity = parseInt(config?.value || 30);
        
        const existing = await allAsync('SELECT SUM(guests) as t FROM reservations WHERE date = ? AND timeSlot = ?', [date, timeSlot]);
        const used = existing[0]?.t || 0;

        if (used + guests > maxCapacity) {
            return res.status(400).json({ error: 'Lo sentimos, no hay cupo suficiente en ese horario.' });
        }

        await runAsync(
            `INSERT INTO reservations (name, phone, date, timeSlot, guests, items, total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, phone, date, timeSlot, guests, JSON.stringify(items), total]
        );
        res.json({ message: 'Reserva creada con éxito' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Borrar reserva (PROTEGIDO)
app.delete('/api/reservations/:id', requireAuth, async (req, res) => {
    try {
        await runAsync('DELETE FROM reservations WHERE id = ?', [req.params.id]);
        res.json({ message: 'Eliminado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 4. CONFIGURACIÓN ---

// Leer config (Público - el frontend necesita saber los horarios)
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

// Modificar config (PROTEGIDO)
app.put('/api/config/:key', requireAuth, async (req, res) => {
    try {
        const { value } = req.body;
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        await runAsync(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`, [req.params.key, valueStr]);
        res.json({ message: 'Configuración actualizada' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 5. EXTRAS ---
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// Servir Frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('*.html', (req, res) => res.sendFile(path.join(__dirname, '../frontend', req.path)));

// Iniciar Servidor
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`✅ Servidor seguro corriendo en http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('❌ Error fatal:', err);
});
