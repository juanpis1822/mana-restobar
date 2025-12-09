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
// Aseguramos que la carpeta exista para que Railway no falle
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'manacoffee.db');
let db;

// Promisificar consultas para usar async/await
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
                await seedDatabase(); // Carga el menú si está vacío
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

// --- CARGA DEL MENÚ ---
const seedDatabase = async () => {
    const res = await getAsync("SELECT COUNT(*) as count FROM dishes");
    if (res.count > 0) return; // Si ya hay platos, no hace nada

    console.log("🔄 Base de datos vacía. Cargando menú completo...");

    // TU LISTA DE PLATOS ORIGINAL
    const dishes = [
        {cat: "Cafetería", name: "Café Nevado", price: 5000, desc: "Café, Crema batida"},
        {cat: "Cafetería", name: "Cappu Nevado", price: 6500, desc: "Café, Crema batida, Leche"},
        {cat: "Cafetería", name: "Moca Nevado", price: 7500, desc: "Café, Crema batida, Chocolate"},
        {cat: "Cafetería", name: "Cappuccino + Sabor", price: 7000, desc: "Cappu + Vainilla, Menta o Canela"},
        {cat: "Cafetería", name: "Cappuccino + Baileys", price: 8500, desc: ""},
        {cat: "Cafetería", name: "Affogato", price: 8000, desc: "Helado, Espresso, galleta"},
        {cat: "Cafetería", name: "Americano", price: 3000, desc: "Café filtrado"},
        {cat: "Cafetería", name: "Espresso", price: 3500, desc: "Café concentrado"},
        {cat: "Cafetería", name: "Cappuccino", price: 5800, desc: "Café, leche vaporizada, toque de canela"},
        {cat: "Cafetería", name: "Moca", price: 6800, desc: "Café, chocolate, leche vaporizada"},
        {cat: "Cafetería", name: "Latte", price: 6500, desc: "Café, Leche vaporizada"},
        {cat: "Cafetería", name: "Frappé de Café", price: 12000, desc: "Café, Leche, Granizado, Crema batida"},
        {cat: "Cafetería", name: "Frappé de Milo", price: 11000, desc: "Milo, Leche, Granizado, Crema batida"},
        {cat: "Cafetería", name: "Migao Colombiano", price: 15000, desc: "Galleta, Queso, Buñuelo, Pan, Masmelo, Canela y chocolate"},
        {cat: "Cafetería", name: "Aromática Frutos Rojos", price: 6000, desc: "Frutas Rojas, Agua caliente"},
        {cat: "Cafetería", name: "Chocolate", price: 5000, desc: "En agua o leche"},
        {cat: "Cafetería", name: "Aguapanela", price: 3000, desc: ""},
        {cat: "Cafetería", name: "Té Chai", price: 5000, desc: "Té negro, Especias, Leche"},
        {cat: "Cafetería", name: "Mantecada MANÁ", price: 4000, desc: ""},
        {cat: "Cafetería", name: "Hojaldre de pollo", price: 3500, desc: ""},
        {cat: "Cafetería", name: "Palito de Queso", price: 3500, desc: ""},
        {cat: "Cafetería", name: "Croissant jamón y queso", price: 3500, desc: ""},
        {cat: "Cafetería", name: "Arepa con queso", price: 3000, desc: ""},
        {cat: "Cafetería", name: "Buñuelo", price: 3000, desc: ""},
        {cat: "Cafetería", name: "Galletas de Café", price: 5000, desc: ""},
        {cat: "Repostería", name: "Copa de Helado Normal", price: 4000, desc: ""},
        {cat: "Repostería", name: "Copa de Helado Premium", price: 6500, desc: "Con diferentes frutas"},
        {cat: "Repostería", name: "Fresas con Crema", price: 10000, desc: "Chocolate, piazza, mini chips"},
        {cat: "Repostería", name: "Fresas con Crema Premium", price: 12000, desc: "Fruticrema"},
        {cat: "Repostería", name: "Torta de Red Velvet", price: 7300, desc: ""},
        {cat: "Repostería", name: "Torta de Chocolate", price: 7300, desc: ""},
        {cat: "Repostería", name: "Cheescake Frutos Rojos", price: 8000, desc: ""},
        {cat: "Repostería", name: "Brownie con Helado", price: 10000, desc: ""},
        {cat: "Malteadas", name: "Malteada Vainilla", price: 11500, desc: "Helado, Leche, Chantilly"},
        {cat: "Malteadas", name: "Malteada Arequipe", price: 12500, desc: "Helado, Arequipe, Leche, Chantilly"},
        {cat: "Malteadas", name: "Malteada Oreo", price: 12500, desc: "Helado, Oreo, Leche, Chantilly"},
        {cat: "Malteadas", name: "Malteada Café", price: 13500, desc: "Helado, Café, Leche, Chantilly"},
        {cat: "Malteadas", name: "Malteada Milo", price: 12500, desc: "Helado, Milo, Leche, Chantilly"},
        {cat: "Malteadas", name: "Malteada Fresa", price: 12500, desc: "Helado, Fresa, Leche, Chantilly"},
        {cat: "Platos a la Carta", name: "Huevos Benedictinos", price: 19000, desc: "Con salsa holandesa"},
        {cat: "Platos a la Carta", name: "Caldo de Costilla", price: 12900, desc: "Con pan/arepa y bebida"},
        {cat: "Platos a la Carta", name: "Caldo con Huevo", price: 12900, desc: "En agua o leche"},
        {cat: "Platos a la Carta", name: "Tortilla Española", price: 19900, desc: "Huevos, pollo, chorizo, vegetales"},
        {cat: "Platos a la Carta", name: "Tostadas Francesas", price: 16000, desc: "Con dips de queso mozzarella"},
        {cat: "Platos a la Carta", name: "Desayuno Perfecto", price: 19500, desc: "Caldo, arepa/pan, huevos al gusto, bebida"},
        {cat: "Platos a la Carta", name: "Tamal", price: 12900, desc: "Con queso, pan y bebida"},
        {cat: "Platos a la Carta", name: "Huevos al Gusto", price: 13000, desc: "Pericos, Rancheros, Revueltos o Fritos"},
        {cat: "Platos a la Carta", name: "Churrasco (330g)", price: 47000, desc: "Ensalada, papa criolla, chorizo"},
        {cat: "Platos a la Carta", name: "Filet Mignon", price: 48000, desc: "Lomo fino, salsa champiñones, vino tinto"},
        {cat: "Platos a la Carta", name: "Cordon Blue", price: 40000, desc: "Pechuga rellena jamón y queso, salsa tocineta"},
        {cat: "Platos a la Carta", name: "Pechuga Hawaiana", price: 34000, desc: "Gratinada con piña y queso"},
        {cat: "Platos a la Carta", name: "Pasta con Pollo 4 Quesos", price: 40000, desc: "Con tostadas al ajillo"},
        {cat: "Platos a la Carta", name: "Arroz Marinero", price: 50000, desc: "Mariscos y vegetales"},
        {cat: "Platos a la Carta", name: "Salmón Frutos Rojos", price: 48000, desc: "Con ensalada y francesas"},
        {cat: "Platos a la Carta", name: "Ceviche Cartagenero", price: 30000, desc: "Camarones, salsa casa, verduras"},
        {cat: "Platos a la Carta", name: "Ceviche Peruano", price: 30000, desc: "Salsa rosada, maíz, aguacate"},
        {cat: "Platos a la Carta", name: "Ensalada César", price: 15000, desc: ""},
        {cat: "Platos a la Carta", name: "Ensalada de Frutas", price: 13900, desc: "Con helado $16.900"},
        {cat: "Comida Rápida", name: "Wrap de Pollo", price: 20000, desc: "Pechuga, vegetales, ripio, jamón, queso, tocineta"},
        {cat: "Comida Rápida", name: "Hamburguesa Clásica", price: 16000, desc: "Carne artesanal, jamón, queso, vegetales"},
        {cat: "Comida Rápida", name: "Hamburguesa Mixta", price: 21000, desc: "Carne, pollo desmechado, tocineta"},
        {cat: "Comida Rápida", name: "Hamburguesa Especial Maná", price: 35000, desc: "Bañada en queso, topping chorizo/tocineta"},
        {cat: "Comida Rápida", name: "Perro Americano", price: 15900, desc: "Salchicha americana, papa ripio, queso, tocineta"},
        {cat: "Comida Rápida", name: "Desgranado de Pollo", price: 23000, desc: "Maíz dulce, pechuga, queso, tocineta"},
        {cat: "Comida Rápida", name: "Picada Personal", price: 25900, desc: ""},
        {cat: "Comida Rápida", name: "Picada Familiar", price: 64900, desc: ""},
        {cat: "Comida Rápida", name: "Sandwich Clásico", price: 12000, desc: "Jamón y queso"},
        {cat: "Comida Rápida", name: "Sandwich Pollo", price: 15000, desc: "Pollo desmechado"},
        {cat: "Comida Rápida", name: "Club House Maná", price: 25000, desc: "Doble piso, filete pechuga, huevo"},
        {cat: "Comida Rápida", name: "Patacón Pollo", price: 15000, desc: ""},
        {cat: "Comida Rápida", name: "Patacón Mixto", price: 20000, desc: ""},
        {cat: "Comida Rápida", name: "Salchipapa Clásica", price: 16000, desc: ""},
        {cat: "Comida Rápida", name: "Salchipapa Mixta", price: 25000, desc: ""},
        {cat: "Comida Rápida", name: "Child Croquette (Infantil)", price: 21900, desc: "Croqueta carne, francesa, jugo"},
        {cat: "Bebidas", name: "Jugo Natural (Agua)", price: 7000, desc: "Guanábana, Mango, Mora, Fresa, Maracuyá..."},
        {cat: "Bebidas", name: "Jugo Natural (Leche)", price: 9000, desc: ""},
        {cat: "Bebidas", name: "Limonada Clásica", price: 5000, desc: ""},
        {cat: "Bebidas", name: "Limonada de Coco", price: 10000, desc: ""},
        {cat: "Bebidas", name: "Cerezada", price: 8500, desc: ""},
        {cat: "Bebidas", name: "Soda Frutos Rojos", price: 10000, desc: ""},
        {cat: "Bebidas", name: "Michelada Clásica", price: 1500, desc: ""},
        {cat: "Bebidas", name: "Cerveza Andina/Poker/Bud/Aguila", price: 5000, desc: ""},
        {cat: "Bebidas", name: "Corona", price: 9000, desc: ""},
        {cat: "Cocteles", name: "Mojito Clásico", price: 14000, desc: "Ron, Hierbabuena, Soda"},
        {cat: "Cocteles", name: "Margarita Tradicional", price: 15000, desc: "Tequila, Triple Sec, Limón"},
        {cat: "Cocteles", name: "Piña Colada", price: 19000, desc: ""},
        {cat: "Cocteles", name: "Copa de Vino", price: 12000, desc: ""}
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
