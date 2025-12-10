require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// --- BASE DE DATOS SQLITE ---
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'manacoffee.db');
let db;

// Promisificar consultas
const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { if(err) reject(err); else resolve({id:this.lastID}); });
});
const getAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { if(err) reject(err); else resolve(row); });
});
const allAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if(err) reject(err); else resolve(rows); });
});

const initDB = () => new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, async (err) => {
        if (err) { 
            console.error('Error BD:', err); 
            reject(err); 
        } else { 
            console.log('✅ Conectado a SQLite en: ' + dbPath);
            try {
                await createTables();
                await seedDatabase();
                resolve();
            } catch (error) {
                reject(error);
            }
        }
    });
});

const createTables = async () => {
    await runAsync(`CREATE TABLE IF NOT EXISTS dishes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, category TEXT, price INTEGER, description TEXT, image LONGTEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await runAsync(`CREATE TABLE IF NOT EXISTS reservations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, date TEXT, timeSlot TEXT, guests INTEGER, items TEXT, total INTEGER, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await runAsync(`CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, token TEXT)`);
    await runAsync(`CREATE TABLE IF NOT EXISTS config (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE, value TEXT)`);
    
    // Configuración inicial
    await runAsync(`INSERT OR IGNORE INTO admin (username, password) VALUES (?, ?)`, ['admin', '1234']);
    await runAsync(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, ['minHours', '8']);
    await runAsync(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, ['maxCapacity', '30']);
    await runAsync(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, ['timeSlots', '["12:00-13:00", "13:00-14:00", "18:00-19:00", "19:00-20:00"]']);
};

// --- CARGA DEL MENÚ (CORREGIDO) ---
const seedDatabase = async () => {
    const res = await getAsync("SELECT COUNT(*) as count FROM dishes");
    if (res.count > 0) return; // Si ya hay platos, no hace nada

    console.log("🔄 Base de datos vacía. Cargando menú completo...");

    // LISTA DE PLATOS INICIALES
    const dishes = [
        { 
            cat: "Comida Rápida", 
            name: "Hamburguesa Maná", 
            price: 18000, 
            desc: "Carne artesanal, queso, tocineta y vegetales frescos." 
        },
        { 
            cat: "Comida Rápida", 
            name: "Salchipapa Tradicional", 
            price: 12000, 
            desc: "Papas francesas, salchicha americana y salsas de la casa." 
        },
        { 
            cat: "Comida Rápida", 
            name: "Picada para dos", 
            price: 35000, 
            desc: "Chorizo, morcilla, carne de res, cerdo, papa criolla y arepa." 
        },
        { 
            cat: "Cafetería", 
            name: "Capuchino Especial", 
            price: 6500, 
            desc: "Café espresso con leche espumada y un toque de canela." 
        },
        { 
            cat: "Cafetería", 
            name: "Torta de Chocolate", 
            price: 8000, 
            desc: "Porción de torta casera bañada en chocolate." 
        }
    ];

    const stmt = db.prepare("INSERT INTO dishes (category, name, price, description) VALUES (?, ?, ?, ?)");
    dishes.forEach(d => stmt.run(d.cat, d.name, d.price, d.desc || ""));
    stmt.finalize();
    console.log("✅ Menú cargado exitosamente.");
};

// --- SEGURIDAD ---
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No autorizado' });
    try {
        const admin = await getAsync('SELECT * FROM admin WHERE token = ?', [token]);
        if (!admin) return res.status(403).json({ error: 'Sesión expirada' });
        next();
    } catch { res.status(500).json({ error: 'Error auth' }); }
};

// --- RUTAS ---
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await getAsync('SELECT * FROM admin WHERE username=? AND password=?', [username, password]);
        if (!admin) return res.status(401).json({ error: 'Datos incorrectos' });
        const token = crypto.randomBytes(32).toString('hex');
        await runAsync('UPDATE admin SET token=? WHERE username=?', [token, username]);
        res.json({ message: 'OK', token });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/logout', async (req, res) => {
    await runAsync('UPDATE admin SET token=NULL');
    res.json({ message: 'Bye' });
});

// Ruta faltante para cambiar contraseña
app.put('/api/admin/password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        const admin = await getAsync('SELECT * FROM admin WHERE username=?', ['admin']);
        if (admin.password !== currentPassword) {
            return res.status(400).json({ error: 'Contraseña actual incorrecta' });
        }
        await runAsync('UPDATE admin SET password=? WHERE username=?', [newPassword, 'admin']);
        res.json({ message: 'Contraseña actualizada' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dishes', async (req, res) => {
    try {
        const r = await allAsync('SELECT * FROM dishes ORDER BY category, name');
        res.json(r);
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/dishes/:id', async (req, res) => {
    const r = await getAsync('SELECT * FROM dishes WHERE id=?', [req.params.id]);
    res.json(r || {});
});

app.post('/api/dishes', requireAuth, async (req, res) => {
    const { name, category, price, description, image } = req.body;
    await runAsync('INSERT INTO dishes (name,category,price,description,image) VALUES (?,?,?,?,?)', [name, category, price, description, image]);
    res.json({ message: 'Creado' });
});

app.put('/api/dishes/:id', requireAuth, async (req, res) => {
    const { name, category, price, description, image } = req.body;
    if (image) await runAsync('UPDATE dishes SET name=?, category=?, price=?, description=?, image=? WHERE id=?', [name, category, price, description, image, req.params.id]);
    else await runAsync('UPDATE dishes SET name=?, category=?, price=?, description=? WHERE id=?', [name, category, price, description, req.params.id]);
    res.json({ message: 'Actualizado' });
});

app.delete('/api/dishes/:id', requireAuth, async (req, res) => {
    await runAsync('DELETE FROM dishes WHERE id=?', [req.params.id]);
    res.json({ message: 'Eliminado' });
});

app.get('/api/config', async(req,res)=>{const c=await allAsync('SELECT * FROM config');const r={};c.forEach(x=>{try{r[x.key]=JSON.parse(x.value)}catch{r[x.key]=x.value}});res.json(r)});
app.put('/api/config/:key', requireAuth, async(req,res)=>{const v=typeof req.body.value==='string'?req.body.value:JSON.stringify(req.body.value);await runAsync('INSERT OR REPLACE INTO config (key,value) VALUES(?,?)',[req.params.key,v]);res.json({message:'OK'})});

app.post('/api/reservations', async(req,res)=>{
    const {name,phone,date,timeSlot,guests,items,total}=req.body;
    await runAsync('INSERT INTO reservations (name,phone,date,timeSlot,guests,items,total) VALUES (?,?,?,?,?,?,?)',[name,phone,date,timeSlot,guests,JSON.stringify(items),total]);
    res.json({message:'OK'});
});
app.get('/api/reservations', requireAuth, async(req,res)=>{
    const r=await allAsync('SELECT * FROM reservations ORDER BY date DESC');
    r.forEach(x=>{try{x.items=JSON.parse(x.items)}catch{x.items=[]}});
    res.json(r);
});
app.delete('/api/reservations/:id', requireAuth, async(req,res)=>{await runAsync('DELETE FROM reservations WHERE id=?',[req.params.id]);res.json({message:'Borrado'})});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('*.html', (req, res) => res.sendFile(path.join(__dirname, '../frontend', req.path)));

// Iniciar
initDB().then(() => app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`))).catch(console.error);
