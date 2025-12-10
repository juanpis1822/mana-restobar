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

// --- CARGA DEL MENÚ COMPLETO ---
const seedDatabase = async () => {
    const res = await getAsync("SELECT COUNT(*) as count FROM dishes");
    // NOTA: Si quieres forzar la recarga del menú, comenta la siguiente línea (¡Cuidado! Duplicará platos si no borras la BD antes)
    if (res.count > 0) return; 

    console.log("🔄 Cargando menú completo de Maná Restobar...");

    const dishes = [
        // ============================================================
        // CATEGORÍA: COMIDA RÁPIDA
        // ============================================================
        
        [cite_start]// --- Hamburguesas [cite: 160] ---
        { cat: "Comida Rápida", name: "Hamburguesa Clásica", price: 16000, desc: "[Hamburguesa] Pan brioche, carne artesanal, jamón, queso, cebolla caramelizada y vegetales." },
        { cat: "Comida Rápida", name: "Hamburguesa Mixta", price: 21000, desc: "[Hamburguesa] Pan brioche, carne artesanal, pollo desmechado, tocineta, cebolla caramelizada y vegetales." },
        { cat: "Comida Rápida", name: "La Pamplonesa", price: 23000, desc: "[Hamburguesa] Carne artesanal, carne desmechada, génovas, salchichón, jamón, queso, tocineta." },
        { cat: "Comida Rápida", name: "Hamburguesa Alemana", price: 22000, desc: "[Hamburguesa] Carne artesanal, queso doble crema, mermelada de tocineta y cebolla caramelizada." },
        { cat: "Comida Rápida", name: "Hamburguesa Chicken's", price: 20000, desc: "[Hamburguesa] Pechuga asada, jamón, queso, tocineta, cebolla caramelizada y vegetales." },
        { cat: "Comida Rápida", name: "Hamburguesa Doble", price: 29900, desc: "[Hamburguesa] Doble carne artesanal, jamón, queso, tocineta, cebolla caramelizada y vegetales." },
        { cat: "Comida Rápida", name: "Especial Maná", price: 35000, desc: "[Hamburguesa] Carne, jamón, queso, cebolla morada, huevo, tocineta, bañada en queso y topping de chorizo." },
        { cat: "Comida Rápida", name: "Hamburguesa Hawaiana", price: 35000, desc: "[Hamburguesa] Carne artesanal, jamón, queso, tocineta, piña asada con tajín y vegetales." },

        [cite_start]// --- Hot Dogs [cite: 161] ---
        { cat: "Comida Rápida", name: "Perro Americano", price: 15900, desc: "[Hot Dog] Salchicha americana, papa ripio, queso, tocineta y salsas." },
        { cat: "Comida Rápida", name: "Perro Mixto", price: 20000, desc: "[Hot Dog] Salchicha americana, pollo desmechado, papa ripio, queso y tocineta." },
        { cat: "Comida Rápida", name: "Perro Argentino", price: 22000, desc: "[Hot Dog] Chorizo argentino bañado en chimichurri, papa ripio, queso y tocineta." },
        { cat: "Comida Rápida", name: "Perro Doble", price: 24500, desc: "[Hot Dog] Doble salchicha, doble queso, doble tocineta y pollo desmechado." },

        [cite_start]// --- Salchipapas [cite: 181] ---
        { cat: "Comida Rápida", name: "Salchipapa Clásica", price: 16000, desc: "[Salchipapa] Vegetales, papas francesa, proteína, queso y salsas." },
        { cat: "Comida Rápida", name: "Salchipapa de Pollo", price: 20000, desc: "[Salchipapa] Con trozos de pollo, queso y salsas." },
        { cat: "Comida Rápida", name: "Salchipapa Mixta", price: 25000, desc: "[Salchipapa] Con variedad de carnes, queso y salsas." },
        { cat: "Comida Rápida", name: "Coripapa", price: 18000, desc: "[Salchipapa] Especialidad de la casa con chorizo." },

        [cite_start]// --- Picadas [cite: 172] ---
        { cat: "Comida Rápida", name: "Picada Personal", price: 25900, desc: "[Picada] Vegetales, papas, maduritos, salchicha, chorizo, carnes y queso." },
        { cat: "Comida Rápida", name: "Picada Doble", price: 39900, desc: "[Picada] Para compartir: Carnes variadas, papas, arepa y acompañamientos." },
        { cat: "Comida Rápida", name: "Picada Familiar", price: 64900, desc: "[Picada] Gran tamaño: Mix de carnes, chorizos, papas y más." },

        [cite_start]// --- Desgranados [cite: 163] ---
        { cat: "Comida Rápida", name: "Desgranado de Pollo", price: 23000, desc: "[Desgranado] Base de maíz, pollo asado, queso gratinado y tocineta." },
        { cat: "Comida Rápida", name: "Desgranado de Carne", price: 23000, desc: "[Desgranado] Base de maíz, carne asada, queso gratinado y tocineta." },
        { cat: "Comida Rápida", name: "Desgranado Mixto", price: 27000, desc: "[Desgranado] Maíz, carne, pollo, queso gratinado y tocineta." },

        [cite_start]// --- Sandwiches [cite: 176] ---
        { cat: "Comida Rápida", name: "Sandwich Clásico", price: 12000, desc: "[Sandwich] Pan artesanal, jamón, queso y vegetales frescos." },
        { cat: "Comida Rápida", name: "Sandwich de Pollo", price: 15000, desc: "[Sandwich] Pollo desmechado, jamón, queso y vegetales." },
        { cat: "Comida Rápida", name: "Club House Maná", price: 25000, desc: "[Sandwich] Doble pan, filete de pechuga, huevo, jamón, queso y papas." },

        [cite_start]// --- Patacones [cite: 180] ---
        { cat: "Comida Rápida", name: "Patacón con Pollo", price: 15000, desc: "[Patacón] Tapa de patacón, vegetales, pollo, jamón y queso." },
        { cat: "Comida Rápida", name: "Patacón Mixto", price: 20000, desc: "[Patacón] Carne y pollo desmechado con queso y vegetales." },
        { cat: "Comida Rápida", name: "Patacón Trifásico", price: 30000, desc: "[Patacón] Tres carnes con todo el sabor de la casa." },

        [cite_start]// --- Wraps [cite: 148] ---
        { cat: "Comida Rápida", name: "Wrap de Pollo", price: 20000, desc: "[Wrap] Tortilla, trozos de pechuga, vegetales, ripio, jamón y tocineta." },
        { cat: "Comida Rápida", name: "Wrap Mixto", price: 23000, desc: "[Wrap] Carne, pollo, chorizo argentino, vegetales y queso." },

        // ============================================================
        // CATEGORÍA: CAFETERÍA
        // ============================================================

        [cite_start]// --- Clásicos Calientes [cite: 9] ---
        { cat: "Cafetería", name: "Café Americano", price: 3500, desc: "[Café] Café filtrado (9oz)." },
        { cat: "Cafetería", name: "Cappuccino", price: 6800, desc: "[Café] Café, leche vaporizada y toque de canela (9oz)." },
        { cat: "Cafetería", name: "Moca", price: 6500, desc: "[Café] Café, chocolate y leche vaporizada." },
        { cat: "Cafetería", name: "Latte", price: 6500, desc: "[Café] Café con leche vaporizada suave." },
        { cat: "Cafetería", name: "Café Nevado", price: 5000, desc: "[Café Frio] Café y crema batida." },
        { cat: "Cafetería", name: "Affogato", price: 8000, desc: "[Postre/Café] Helado, espresso y galleta." },

        [cite_start]// --- Bebidas Calientes [cite: 45] ---
        { cat: "Cafetería", name: "Chocolate", price: 5000, desc: "[Bebida] Chocolate en agua o leche." },
        { cat: "Cafetería", name: "Aguapanela con Queso", price: 3300, desc: "[Bebida] Aguapanela caliente (opción en leche)." },
        { cat: "Cafetería", name: "Té Chai", price: 5000, desc: "[Té] Té negro, especias y leche." },
        { cat: "Cafetería", name: "Aromática Frutos Rojos", price: 6000, desc: "[Té] Infusión de frutas rojas." },

        [cite_start]// --- Frappés y Malteadas [cite: 30, 53] ---
        { cat: "Cafetería", name: "Frappé de Café", price: 12000, desc: "[Frappé] Café, leche, granizado y crema batida." },
        { cat: "Cafetería", name: "Frappé de Milo", price: 11000, desc: "[Frappé] Milo, leche, granizado y crema batida." },
        { cat: "Cafetería", name: "Malteada de Vainilla", price: 11500, desc: "[Malteada] Helado, leche y chantilly." },
        { cat: "Cafetería", name: "Malteada de Oreo", price: 12500, desc: "[Malteada] Helado, galleta oreo, leche y chantilly." },
        { cat: "Cafetería", name: "Malteada de Arequipe", price: 12500, desc: "[Malteada] Helado, arequipe, leche y chantilly." },

        [cite_start]// --- Repostería [cite: 55] ---
        { cat: "Cafetería", name: "Torta Red Velvet", price: 7300, desc: "[Postre] Porción de torta roja aterciopelada." },
        { cat: "Cafetería", name: "Torta de Chocolate", price: 7300, desc: "[Postre] Porción de torta de chocolate." },
        { cat: "Cafetería", name: "Cheesecake Frutos Rojos", price: 8000, desc: "[Postre] Pastel de queso con salsa de frutos rojos." },
        { cat: "Cafetería", name: "Brownie con Helado", price: 10000, desc: "[Postre] Brownie caliente con bola de helado." },
        { cat: "Cafetería", name: "Fresas con Crema", price: 10000, desc: "[Postre] Fresas frescas con crema chantilly." },

        [cite_start]// --- Bebidas Frías y Cocteles [cite: 197, 202, 208] ---
        { cat: "Cafetería", name: "Limonada de Coco", price: 10000, desc: "[Bebida Fría] Esencia de coco, limón y crema." },
        { cat: "Cafetería", name: "Limonada Cerezada", price: 8500, desc: "[Bebida Fría] Cereza, limón y agua." },
        { cat: "Cafetería", name: "Soda Frutos Rojos", price: 10000, desc: "[Soda] Soda, limón, frutas rojas y menta." },
        { cat: "Cafetería", name: "Michelada Mango Biche", price: 4500, desc: "[Cerveza] Limón, mango, pimienta y tajín (sin licor)." },
        { cat: "Cafetería", name: "Mojito Clásico", price: 14000, desc: "[Coctel] Ron blanco, hierbabuena, limón y soda." },
        { cat: "Cafetería", name: "Margarita", price: 15000, desc: "[Coctel] Tequila, triple sec, limón y sal." },

        // ============================================================
        // CATEGORÍA: RESTAURANTE (Almuerzos y Fuertes)
        // ============================================================
        
        [cite_start]// --- Carnes y Aves [cite: 89, 101] ---
        { cat: "Restaurante", name: "Churrasco (330gr)", price: 47000, desc: "[Fuerte] Con ensalada, papa criolla al ajillo y chorizo." },
        { cat: "Restaurante", name: "Filet Mignon", price: 48000, desc: "[Fuerte] Lomo fino en salsa de champiñones y vino tinto." },
        { cat: "Restaurante", name: "Cordon Blue", price: 40000, desc: "[Fuerte] Pechuga rellena de jamón y queso en salsa de tocineta." },
        { cat: "Restaurante", name: "Pechuga Hawaiana", price: 34000, desc: "[Fuerte] Gratinada con piña asada y papas a la francesa." },

        [cite_start]// --- Mariscos y Ceviches [cite: 111, 124] ---
        { cat: "Restaurante", name: "Arroz Marinero", price: 50000, desc: "[Mariscos] Mixtura de mariscos y vegetales." },
        { cat: "Restaurante", name: "Salmón Frutos Rojos", price: 48000, desc: "[Pescado] Lomo de salmón en salsa de frutos rojos." },
        { cat: "Restaurante", name: "Ceviche Cartagenero", price: 30000, desc: "[Entrada] Camarones en salsa de la casa con plátano." },
        { cat: "Restaurante", name: "Ceviche Peruano", price: 30000, desc: "[Entrada] Camarones, maíz dulce, aguacate y limón." },

        [cite_start]// --- Desayunos [cite: 68] ---
        { cat: "Restaurante", name: "Caldo de Costilla", price: 12900, desc: "[Desayuno] Con arepa o pan y bebida caliente." },
        { cat: "Restaurante", name: "Tamal con Chocolate", price: 12900, desc: "[Desayuno] Tamal, queso, pan y bebida caliente." },
        { cat: "Restaurante", name: "Huevos al Gusto", price: 13000, desc: "[Desayuno] Pericos, revueltos o fritos con acompañamientos." }
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
