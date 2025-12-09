require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg'); // CAMBIO: Usamos pg en lugar de sqlite3
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// --- CONEXIÓN A BASE DE DATOS (POSTGRESQL) ---
// Railway provee la variable DATABASE_URL automáticamente
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Necesario para Railway
});

// Función helper para consultas (simula lo que tenías antes pero con Postgres)
const query = async (text, params) => await pool.query(text, params);

const initDB = async () => {
    try {
        await createTables();
        await seedDatabase(); // AQUÍ SE CARGA EL MENÚ AUTOMÁTICAMENTE
        console.log('✅ Base de datos inicializada y menú cargado.');
    } catch (err) {
        console.error('❌ Error inicializando DB:', err);
    }
};

const createTables = async () => {
    // Nota: En Postgres usamos SERIAL en vez de AUTOINCREMENT y TEXT en vez de LONGTEXT
    await query(`CREATE TABLE IF NOT EXISTS dishes (id SERIAL PRIMARY KEY, name TEXT, category TEXT, price INTEGER, description TEXT, image TEXT, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await query(`CREATE TABLE IF NOT EXISTS reservations (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, date TEXT, timeSlot TEXT, guests INTEGER, items TEXT, total INTEGER, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await query(`CREATE TABLE IF NOT EXISTS admin (id SERIAL PRIMARY KEY, username TEXT UNIQUE, password TEXT, token TEXT)`);
    await query(`CREATE TABLE IF NOT EXISTS config (id SERIAL PRIMARY KEY, key TEXT UNIQUE, value TEXT)`);
    
    // Insertar datos por defecto si no existen
    await query(`INSERT INTO admin (username, password) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING`, ['admin', '1234']);
    await query(`INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['minHours', '8']);
    await query(`INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['maxCapacity', '30']);
    await query(`INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['timeSlots', '["12:00-13:00", "13:00-14:00", "18:00-19:00", "19:00-20:00"]']);
};

// --- CARGA MASIVA DE PLATOS (Tu menú original) ---
const seedDatabase = async () => {
    const res = await query("SELECT COUNT(*) FROM dishes");
    const count = parseInt(res.rows[0].count);
    
    if (count > 0) {
        console.log(`ℹ️ La base de datos ya tiene ${count} platos. No se requiere carga inicial.`);
        return; 
    }

    console.log("🔄 Base de datos vacía. Cargando menú completo...");

    const dishes = [
        // --- CAFETERÍA ---
        {cat: "Cafetería", name: "Café Nevado", price: 5000, desc: "Café, Crema batida"},
        {cat: "Cafetería", name: "Cappu Nevado", price: 6500, desc: "Café, Crema batida, Leche"},
        {cat: "Cafetería", name: "Moca Nevado", price: 7500, desc: "Café, Crema batida, Chocolate"},
        {cat: "Cafetería", name: "Cappuccino + Sabor", price: 7000, desc: "Cappu + Vainilla, Menta o Canela"},
        {cat: "Cafetería", name: "Cappuccino + Baileys", price: 8500, desc: ""},
        {cat: "Cafetería", name: "Affogato", price: 8000, desc: "Helado, Espresso, galleta"},
        {cat: "Cafetería", name: "Affogato + Baileys", price: 10000, desc: ""},
        {cat: "Cafetería", name: "Americano", price: 3000, desc: "Café filtrado"},
        {cat: "Cafetería", name: "Espresso", price: 3500, desc: "Café concentrado"},
        {cat: "Cafetería", name: "Cappuccino", price: 5800, desc: "Café, leche vaporizada, toque de canela"},
        {cat: "Cafetería", name: "Moca", price: 6800, desc: "Café, chocolate, leche vaporizada"},
        {cat: "Cafetería", name: "Latte", price: 6500, desc: "Café, Leche vaporizada"},
        {cat: "Cafetería", name: "Frappé de Café", price: 12000, desc: "Café, Leche, Granizado, Crema batida"},
        {cat: "Cafetería", name: "Frappé de Milo", price: 11000, desc: "Milo, Leche, Granizado, Crema batida"},
        {cat: "Cafetería", name: "Migao Colombiano", price: 15000, desc: "Galleta, Queso, Buñuelo, Pan, Masmelo, Canela y chocolate"},
        {cat: "Cafetería", name: "Aromática Frutos Rojos", price: 6000, desc: "Frutas Rojas, Agua caliente"},
        {cat: "Cafetería", name: "Aromática Frutos Amarillos", price: 6000, desc: "Frutos Amarillos, Agua caliente"},
        {cat: "Cafetería", name: "Chocolate", price: 5000, desc: "En agua o leche"},
        {cat: "Cafetería", name: "Aguapanela", price: 3000, desc: ""},
        {cat: "Cafetería", name: "Aguapanela en Leche", price: 3300, desc: ""},
        {cat: "Cafetería", name: "Té Chai", price: 5000, desc: "Té negro, Especias, Leche"},
        {cat: "Cafetería", name: "Chocolate + Masmelo", price: 7000, desc: ""},
        {cat: "Cafetería", name: "Infusión aromática", price: 2500, desc: "Papeleta (Frutos rojos, Manzanilla, etc)"},
        {cat: "Cafetería", name: "Aromática en Leche", price: 3800, desc: ""},
        {cat: "Cafetería", name: "Mantecada MANÁ", price: 4000, desc: ""},
        {cat: "Cafetería", name: "Hojaldre de pollo", price: 3500, desc: ""},
        {cat: "Cafetería", name: "Palito de Queso", price: 3500, desc: ""},
        {cat: "Cafetería", name: "Croissant jamón y queso", price: 3500, desc: ""},
        {cat: "Cafetería", name: "Arepa con queso", price: 3000, desc: ""},
        {cat: "Cafetería", name: "Buñuelo", price: 3000, desc: ""},
        {cat: "Cafetería", name: "Galletas de Café", price: 5000, desc: ""},
        {cat: "Cafetería", name: "Galletas de Queso", price: 5000, desc: ""},
        {cat: "Cafetería", name: "Galletas New York", price: 5000, desc: "Chocolate o Queso"},

        // --- REPOSTERÍA ---
        {cat: "Repostería", name: "Copa de Helado Normal", price: 4000, desc: ""},
        {cat: "Repostería", name: "Copa de Helado Premium", price: 6500, desc: "Con diferentes frutas"},
        {cat: "Repostería", name: "Fresas con Crema", price: 10000, desc: "Chocolate, piazza, mini chips"},
        {cat: "Repostería", name: "Fresas con Crema Premium", price: 12000, desc: "Fruticrema"},
        {cat: "Repostería", name: "Torta de Red Velvet", price: 7300, desc: ""},
        {cat: "Repostería", name: "Torta de Chocolate", price: 7300, desc: ""},
        {cat: "Repostería", name: "Torta Genovesa", price: 7300, desc: ""},
        {cat: "Repostería", name: "Torta de Zanahoria", price: 7300, desc: ""},
        {cat: "Repostería", name: "Torta de Queso", price: 7300, desc: ""},
        {cat: "Repostería", name: "Torta Selva Negra", price: 7300, desc: ""},
        {cat: "Repostería", name: "Cheescake Frutos Rojos", price: 8000, desc: ""},
        {cat: "Repostería", name: "Cheescake Frutos Amarillos", price: 8000, desc: ""},
        {cat: "Repostería", name: "Brownie", price: 7000, desc: ""},
        {cat: "Repostería", name: "Brownie con Helado", price: 10000, desc: ""},
        {cat: "Repostería", name: "Quesillo", price: 7300, desc: ""},
        {cat: "Repostería", name: "Cupcake de Red Velvet", price: 5000, desc: ""},
        {cat: "Repostería", name: "Cupcake de Vainilla", price: 4000, desc: ""},

        // --- MALTEADAS ---
        {cat: "Malteadas", name: "Malteada Vainilla", price: 11500, desc: "Helado, Leche, Chantilly"},
        {cat: "Malteadas", name: "Malteada Arequipe", price: 12500, desc: "Helado, Arequipe, Leche, Chantilly"},
        {cat: "Malteadas", name: "Malteada Oreo", price: 12500, desc: "Helado, Oreo, Leche, Chantilly"},
        {cat: "Malteadas", name: "Malteada Café", price: 13500, desc: "Helado, Café, Leche, Chantilly"},
        {cat: "Malteadas", name: "Malteada Milo", price: 12500, desc: "Helado, Milo, Leche, Chantilly"},
        {cat: "Malteadas", name: "Malteada Fresa", price: 12500, desc: "Helado, Fresa, Leche, Chantilly"},

        // --- PLATOS A LA CARTA ---
        {cat: "Platos a la Carta", name: "Huevos Benedictinos", price: 19000, desc: "Con salsa holandesa"},
        {cat: "Platos a la Carta", name: "Caldo de Costilla", price: 12900, desc: "Con pan/arepa y bebida"},
        {cat: "Platos a la Carta", name: "Caldo con Huevo", price: 12900, desc: "En agua o leche"},
        {cat: "Platos a la Carta", name: "Caldo de Bagre", price: 17000, desc: "En agua o leche"},
        {cat: "Platos a la Carta", name: "Caldo de Pollo", price: 12900, desc: ""},
        {cat: "Platos a la Carta", name: "Tortilla Española", price: 19900, desc: "Huevos, pollo, chorizo, vegetales"},
        {cat: "Platos a la Carta", name: "Tostadas Francesas", price: 16000, desc: "Con dips de queso mozzarella"},
        {cat: "Platos a la Carta", name: "Desayuno Perfecto", price: 19500, desc: "Caldo, arepa/pan, huevos al gusto, bebida"},
        {cat: "Platos a la Carta", name: "Tamal", price: 12900, desc: "Con queso, pan y bebida"},
        {cat: "Platos a la Carta", name: "Huevos al Gusto", price: 13000, desc: "Pericos, Rancheros, Revueltos o Fritos"},
        {cat: "Platos a la Carta", name: "Omelette", price: 15000, desc: ""},
        {cat: "Platos a la Carta", name: "Churrasco (330g)", price: 47000, desc: "Ensalada, papa criolla, chorizo"},
        {cat: "Platos a la Carta", name: "Filet Mignon", price: 48000, desc: "Lomo fino, salsa champiñones, vino tinto"},
        {cat: "Platos a la Carta", name: "Medallones de Res", price: 52000, desc: "Salsa de camarones"},
        {cat: "Platos a la Carta", name: "Cordon Blue", price: 40000, desc: "Pechuga rellena jamón y queso, salsa tocineta"},
        {cat: "Platos a la Carta", name: "Pechuga Hawaiana", price: 34000, desc: "Gratinada con piña y queso"},
        {cat: "Platos a la Carta", name: "Pasta con Pollo 4 Quesos", price: 40000, desc: "Con tostadas al ajillo"},
        {cat: "Platos a la Carta", name: "Arroz Marinero", price: 50000, desc: "Mariscos y vegetales"},
        {cat: "Platos a la Carta", name: "Pastas Green Langostinos", price: 43000, desc: "Salsa vegetales verdes"},
        {cat: "Platos a la Carta", name: "Salmón Frutos Rojos", price: 48000, desc: "Con ensalada y francesas"},
        {cat: "Platos a la Carta", name: "Salmón Toscana", price: 52000, desc: "Con patacones y ensalada"},
        {cat: "Platos a la Carta", name: "Ceviche Cartagenero", price: 30000, desc: "Camarones, salsa casa, verduras"},
        {cat: "Platos a la Carta", name: "Ceviche Peruano", price: 30000, desc: "Salsa rosada, maíz, aguacate"},
        {cat: "Platos a la Carta", name: "Causita de Langostino", price: 50000, desc: "Puré de papa amarilla, pimentón"},
        {cat: "Platos a la Carta", name: "Ceviche Especial Maná", price: 31900, desc: "Chicharrón de cerdo, salsa casa"},
        {cat: "Platos a la Carta", name: "Ensalada Griega", price: 12900, desc: ""},
        {cat: "Platos a la Carta", name: "Ensalada César", price: 15000, desc: ""},
        {cat: "Platos a la Carta", name: "Ensalada Waldorf", price: 16900, desc: ""},
        {cat: "Platos a la Carta", name: "Ensalada de Frutas", price: 13900, desc: "Con helado $16.900"},
        {cat: "Platos a la Carta", name: "Menú Vegetariano: Hamburguesa", price: 19900, desc: "Champiñones, maíz, vegetales, queso"},
        {cat: "Platos a la Carta", name: "Menú Vegetariano: Maicitos", price: 23000, desc: ""},
        {cat: "Platos a la Carta", name: "Menú Vegetariano: Wraps", price: 19000, desc: "Tortilla rellena vegetales salteados"},

        // --- COMIDA RÁPIDA ---
        {cat: "Comida Rápida", name: "Wrap de Pollo", price: 20000, desc: "Pechuga, vegetales, ripio, jamón, queso, tocineta"},
        {cat: "Comida Rápida", name: "Wrap de Carne", price: 20000, desc: "Carne, vegetales, ripio, jamón, queso, tocineta"},
        {cat: "Comida Rápida", name: "Wrap Mixto", price: 23000, desc: "Carne, pollo, chorizo argentino"},
        {cat: "Comida Rápida", name: "Hamburguesa Clásica", price: 16000, desc: "Carne artesanal, jamón, queso, vegetales"},
        {cat: "Comida Rápida", name: "Hamburguesa Mixta", price: 21000, desc: "Carne, pollo desmechado, tocineta"},
        {cat: "Comida Rápida", name: "Hamburguesa La Pamplonesa", price: 23000, desc: "Carne, desmechada, génovas, salchichón"},
        {cat: "Comida Rápida", name: "Hamburguesa Alemana", price: 22000, desc: "Queso doble crema, mermelada tocineta"},
        {cat: "Comida Rápida", name: "Hamburguesa Chicken's", price: 20000, desc: "Pechuga asada"},
        {cat: "Comida Rápida", name: "Hamburguesa Doble", price: 29900, desc: "Doble carne artesanal"},
        {cat: "Comida Rápida", name: "Hamburguesa Especial Maná", price: 35000, desc: "Bañada en queso, topping chorizo/tocineta"},
        {cat: "Comida Rápida", name: "Hamburguesa Hawaiana", price: 35000, desc: "Piña asada con tajín"},
        {cat: "Comida Rápida", name: "Perro Americano", price: 15900, desc: "Salchicha americana, papa ripio, queso, tocineta"},
        {cat: "Comida Rápida", name: "Perro Mixto", price: 20000, desc: "Con pollo desmechado"},
        {cat: "Comida Rápida", name: "Perro Argentino", price: 22000, desc: "Chorizo argentino, chimichurri"},
        {cat: "Comida Rápida", name: "Perro Doble", price: 24500, desc: "Doble salchicha"},
        {cat: "Comida Rápida", name: "Desgranado de Pollo", price: 23000, desc: "Maíz dulce, pechuga, queso, tocineta"},
        {cat: "Comida Rápida", name: "Desgranado de Carne", price: 23000, desc: "Maíz dulce, carne, queso, tocineta"},
        {cat: "Comida Rápida", name: "Desgranado Mixto", price: 27000, desc: "Carne y Pollo"},
        {cat: "Comida Rápida", name: "Picada Personal", price: 25900, desc: ""},
        {cat: "Comida Rápida", name: "Picada Doble", price: 39900, desc: ""},
        {cat: "Comida Rápida", name: "Picada Familiar", price: 64900, desc: ""},
        {cat: "Comida Rápida", name: "Sandwich Clásico", price: 12000, desc: "Jamón y queso"},
        {cat: "Comida Rápida", name: "Sandwich Pollo", price: 15000, desc: "Pollo desmechado"},
        {cat: "Comida Rápida", name: "Sandwich Carne", price: 15000, desc: "Carne desmechada"},
        {cat: "Comida Rápida", name: "Sandwich Mixto", price: 18000, desc: ""},
        {cat: "Comida Rápida", name: "Club House Maná", price: 25000, desc: "Doble piso, filete pechuga, huevo"},
        {cat: "Comida Rápida", name: "Patacón Pollo", price: 15000, desc: ""},
        {cat: "Comida Rápida", name: "Patacón Carne", price: 15000, desc: ""},
        {cat: "Comida Rápida", name: "Patacón Mixto", price: 20000, desc: ""},
        {cat: "Comida Rápida", name: "Patacón Trifásico", price: 30000, desc: ""},
        {cat: "Comida Rápida", name: "Salchipapa Clásica", price: 16000, desc: ""},
        {cat: "Comida Rápida", name: "Salchipapa Pollo", price: 20000, desc: ""},
        {cat: "Comida Rápida", name: "Salchipapa Carne", price: 21000, desc: ""},
        {cat: "Comida Rápida", name: "Salchipapa Mixta", price: 25000, desc: ""},
        {cat: "Comida Rápida", name: "Coripapa", price: 18000, desc: ""},
        {cat: "Comida Rápida", name: "Child Croquette (Infantil)", price: 21900, desc: "Croqueta carne, francesa, jugo"},
        {cat: "Comida Rápida", name: "Chickentender (Infantil)", price: 21900, desc: "Pechuga apanada"},
        {cat: "Comida Rápida", name: "Miniburger (Infantil)", price: 24900, desc: ""},

        // --- BEBIDAS ---
        {cat: "Bebidas", name: "Jugo Natural (Agua)", price: 7000, desc: "Guanábana, Mango, Mora, Fresa, Maracuyá..."},
        {cat: "Bebidas", name: "Jugo Natural (Leche)", price: 9000, desc: ""},
        {cat: "Bebidas", name: "Limonada Clásica", price: 5000, desc: ""},
        {cat: "Bebidas", name: "Limonada de Panela", price: 6000, desc: ""},
        {cat: "Bebidas", name: "Limonada Burbujeante", price: 7000, desc: "Con soda"},
        {cat: "Bebidas", name: "Limonada Santandereana", price: 7500, desc: "Hipinto, hierbabuena"},
        {cat: "Bebidas", name: "Limonada Hierbabuena", price: 6500, desc: ""},
        {cat: "Bebidas", name: "Cerezada", price: 8500, desc: ""},
        {cat: "Bebidas", name: "Limonada de Coco", price: 10000, desc: ""},
        {cat: "Bebidas", name: "Soda Frutos Rojos", price: 10000, desc: ""},
        {cat: "Bebidas", name: "Soda Frutos Amarillos", price: 10000, desc: ""},
        {cat: "Bebidas", name: "Infusión de Soda", price: 10000, desc: "Trozos de fruta"},
        {cat: "Bebidas", name: "Mocktail Frutos Rojos", price: 10000, desc: ""},
        {cat: "Bebidas", name: "Mocktail Amarillo", price: 10000, desc: ""},
        {cat: "Bebidas", name: "Marácumango", price: 8000, desc: ""},
        {cat: "Bebidas", name: "Michelada Clásica", price: 1500, desc: ""},
        {cat: "Bebidas", name: "Michelada Mango Biche", price: 4500, desc: ""},
        {cat: "Bebidas", name: "Michelada Frutos Rojos", price: 5000, desc: ""},
        {cat: "Bebidas", name: "Michelada Maná", price: 6000, desc: "Whiskey, Tequila, Tajín"},
        {cat: "Bebidas", name: "Cerveza Andina/Poker/Bud/Aguila", price: 5000, desc: ""},
        {cat: "Bebidas", name: "Club Colombia/Heineken", price: 5500, desc: ""},
        {cat: "Bebidas", name: "Corona", price: 9000, desc: ""},
        {cat: "Bebidas", name: "Coronita", price: 6000, desc: ""},
        {cat: "Bebidas", name: "Agua", price: 2000, desc: ""},
        {cat: "Bebidas", name: "Gaseosa 350ml", price: 3200, desc: ""},
        {cat: "Bebidas", name: "Gaseosa 1.5 Lt", price: 8000, desc: ""},
        {cat: "Bebidas", name: "Jarra Limonada", price: 9000, desc: ""},
        {cat: "Bebidas", name: "Jarra Cerezada", price: 13000, desc: ""},

        // --- COCTELES ---
        {cat: "Cocteles", name: "Mojito Clásico", price: 14000, desc: "Ron, Hierbabuena, Soda"},
        {cat: "Cocteles", name: "Margarita Tradicional", price: 15000, desc: "Tequila, Triple Sec, Limón"},
        {cat: "Cocteles", name: "Piña Colada", price: 19000, desc: ""},
        {cat: "Cocteles", name: "On The Beach", price: 18000, desc: "Vodka, Durazno, Naranja"},
        {cat: "Cocteles", name: "Orgasm", price: 18000, desc: "Amaretto, Licor Café, Baileys"},
        {cat: "Cocteles", name: "Penicillin", price: 19000, desc: "Jack honey, Ginebra"},
        {cat: "Cocteles", name: "Moscow Mule", price: 18000, desc: "Vodka, Cerveza, Ginger"},
        {cat: "Cocteles", name: "Daikiri", price: 15000, desc: ""},
        {cat: "Cocteles", name: "Caipiroska", price: 16000, desc: ""},
        {cat: "Cocteles", name: "Caipirissima", price: 16000, desc: ""},
        {cat: "Cocteles", name: "Whiskey Sour", price: 14000, desc: ""},
        {cat: "Cocteles", name: "Alexander", price: 18000, desc: "Licor Café, Baileys, Ginebra"},
        {cat: "Cocteles", name: "Copa de Vino", price: 12000, desc: ""},
        {cat: "Cocteles", name: "Vino Caliente", price: 15000, desc: ""}
    ];

    for (const d of dishes) {
        await query("INSERT INTO dishes (category, name, price, description) VALUES ($1, $2, $3, $4)", 
            [d.cat, d.name, d.price, d.desc || ""]
        );
    }
    console.log("✅ Menú cargado exitosamente en Postgres.");
};

// --- SEGURIDAD ---
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No autorizado' });
    try {
        const resDb = await query('SELECT * FROM admin WHERE token = $1', [token]);
        if (resDb.rows.length === 0) return res.status(403).json({ error: 'Sesión expirada' });
        next();
    } catch { res.status(500).json({ error: 'Error auth' }); }
};

// --- RUTAS (Adaptadas a Postgres) ---
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await query('SELECT * FROM admin WHERE username=$1 AND password=$2', [username, password]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Datos incorrectos' });
        const token = crypto.randomBytes(32).toString('hex');
        await query('UPDATE admin SET token=$1 WHERE username=$2', [token, username]);
        res.json({ message: 'OK', token });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/logout', async (req, res) => {
    await query('UPDATE admin SET token=NULL'); // Logout global por simplicidad
    res.json({ message: 'Bye' });
});

app.get('/api/dishes', async (req, res) => {
    try {
        const result = await query('SELECT * FROM dishes ORDER BY category, name');
        res.json(result.rows);
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/dishes/:id', async (req, res) => {
    const result = await query('SELECT * FROM dishes WHERE id=$1', [req.params.id]);
    res.json(result.rows[0] || {});
});

app.post('/api/dishes', requireAuth, async (req, res) => {
    const { name, category, price, description, image } = req.body;
    await query('INSERT INTO dishes (name,category,price,description,image) VALUES ($1,$2,$3,$4,$5)', [name, category, price, description, image]);
    res.json({ message: 'Creado' });
});

app.put('/api/dishes/:id', requireAuth, async (req, res) => {
    const { name, category, price, description, image } = req.body;
    if (image) await query('UPDATE dishes SET name=$1, category=$2, price=$3, description=$4, image=$5 WHERE id=$6', [name, category, price, description, image, req.params.id]);
    else await query('UPDATE dishes SET name=$1, category=$2, price=$3, description=$4 WHERE id=$5', [name, category, price, description, req.params.id]);
    res.json({ message: 'Actualizado' });
});

app.delete('/api/dishes/:id', requireAuth, async (req, res) => {
    await query('DELETE FROM dishes WHERE id=$1', [req.params.id]);
    res.json({ message: 'Eliminado' });
});

// Configuración y Reservas (Postgres Syntax)
app.get('/api/config', async(req,res)=>{
    const result = await query('SELECT * FROM config');
    const r={};
    result.rows.forEach(x=>{try{r[x.key]=JSON.parse(x.value)}catch{r[x.key]=x.value}});
    res.json(r);
});

app.put('/api/config/:key', requireAuth, async(req,res)=>{
    const v=typeof req.body.value==='string'?req.body.value:JSON.stringify(req.body.value);
    await query('INSERT INTO config (key,value) VALUES($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2', [req.params.key,v]);
    res.json({message:'OK'});
});

app.post('/api/reservations', async(req,res)=>{
    const {name,phone,date,timeSlot,guests,items,total}=req.body;
    await query('INSERT INTO reservations (name,phone,date,timeSlot,guests,items,total) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [name,phone,date,timeSlot,guests,JSON.stringify(items),total]);
    res.json({message:'OK'});
});

app.get('/api/reservations', requireAuth, async(req,res)=>{
    const result = await query('SELECT * FROM reservations ORDER BY date DESC');
    const r = result.rows;
    r.forEach(x=>{try{x.items=JSON.parse(x.items)}catch{x.items=[]}});
    res.json(r);
});

app.delete('/api/reservations/:id', requireAuth, async(req,res)=>{
    await query('DELETE FROM reservations WHERE id=$1',[req.params.id]);
    res.json({message:'Borrado'});
});

// Servir frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('*.html', (req, res) => res.sendFile(path.join(__dirname, '../frontend', req.path)));

// Iniciar servidor
initDB().then(() => app.listen(PORT, () => console.log(`🚀 Servidor PostgreSQL listo en puerto ${PORT}`)));
