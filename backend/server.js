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
    
    await runAsync(`INSERT OR IGNORE INTO admin (username, password) VALUES (?, ?)`, ['admin', '1234']);
    await runAsync(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, ['minHours', '8']);
    await runAsync(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, ['maxCapacity', '30']);
    await runAsync(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, ['timeSlots', '["12:00-13:00", "13:00-14:00", "18:00-19:00", "19:00-20:00"]']);
};

// --- CARGA DEL MENÚ MASIVO (+300 ÍTEMS) ---
const seedDatabase = async () => {
    const res = await getAsync("SELECT COUNT(*) as count FROM dishes");
    // COMENTA ESTA LÍNEA SI QUIERES FORZAR LA RECARGA DE DATOS:
    if (res.count > 0) return; 

    console.log("🔄 Iniciando carga masiva del menú...");

    const dishes = [
        // ==================== CAFETERÍA: NEVADOS ====================
        { cat: "Nevados", name: "Café Nevado", price: 5000, desc: "Café, Crema batida." },
        { cat: "Nevados", name: "Cappu Nevado", price: 6500, desc: "Café, Crema batida, Leche." },
        { cat: "Nevados", name: "Moca Nevado", price: 7500, desc: "Café, Crema batida, Chocolate." },

        // ==================== CAFETERÍA: CLÁSICOS ====================
        { cat: "Clásicos Café", name: "Americano (7oz)", price: 3000, desc: "Café filtrado pequeño." },
        { cat: "Clásicos Café", name: "Americano (9oz)", price: 3500, desc: "Café filtrado grande." },
        { cat: "Clásicos Café", name: "Espresso", price: 3500, desc: "Café concentrado." },
        { cat: "Clásicos Café", name: "Cappuccino (7oz)", price: 5800, desc: "Con canela." },
        { cat: "Clásicos Café", name: "Cappuccino (9oz)", price: 6800, desc: "Con canela." },
        { cat: "Clásicos Café", name: "Cappuccino Vainilla", price: 7000, desc: "Saborizado." },
        { cat: "Clásicos Café", name: "Cappuccino Menta", price: 7000, desc: "Saborizado." },
        { cat: "Clásicos Café", name: "Cappuccino Canela", price: 7000, desc: "Saborizado." },
        { cat: "Clásicos Café", name: "Cappuccino + Baileys", price: 8500, desc: "Con licor." },
        { cat: "Clásicos Café", name: "Moca", price: 6500, desc: "Café, chocolate, leche." },
        { cat: "Clásicos Café", name: "Latte (7oz)", price: 5500, desc: "Leche vaporizada." },
        { cat: "Clásicos Café", name: "Latte (9oz)", price: 6500, desc: "Leche vaporizada." },
        { cat: "Clásicos Café", name: "Affogato", price: 8000, desc: "Helado, espresso, galleta." },
        { cat: "Clásicos Café", name: "Affogato + Baileys", price: 10000, desc: "Con licor." },
        { cat: "Clásicos Café", name: "Adicional de Queso", price: 3500, desc: "Porción." },

        // ==================== CAFETERÍA: FRAPPÉS ====================
        { cat: "Frappés", name: "Frappé de Café", price: 12000, desc: "Café, leche, granizado, crema." },
        { cat: "Frappés", name: "Frappé de Milo", price: 11000, desc: "Milo, leche, granizado, crema." },

        // ==================== CAFETERÍA: BEBIDAS CALIENTES ====================
        { cat: "Bebidas Calientes", name: "Chocolate en Agua", price: 5000, desc: "Caliente." },
        { cat: "Bebidas Calientes", name: "Chocolate en Leche", price: 5000, desc: "Caliente." },
        { cat: "Bebidas Calientes", name: "Chocolate + Masmelo", price: 7000, desc: "Con masmelos." },
        { cat: "Bebidas Calientes", name: "Aguapanela", price: 3000, desc: "Caliente." },
        { cat: "Bebidas Calientes", name: "Aguapanela en Leche", price: 3300, desc: "Caliente." },
        { cat: "Bebidas Calientes", name: "Té Chai", price: 5000, desc: "Té negro y especias." },
        { cat: "Bebidas Calientes", name: "Aromática Frutos Rojos", price: 6000, desc: "Frutas naturales." },
        { cat: "Bebidas Calientes", name: "Aromática Frutos Amarillos", price: 6000, desc: "Frutas naturales." },
        // Aromáticas de Papeleta (Desglosadas)
        { cat: "Bebidas Calientes", name: "Infusión Frutos Rojos", price: 2500, desc: "Papeleta." },
        { cat: "Bebidas Calientes", name: "Infusión Manzanilla", price: 2500, desc: "Papeleta." },
        { cat: "Bebidas Calientes", name: "Infusión Hierbabuena", price: 2500, desc: "Papeleta." },
        { cat: "Bebidas Calientes", name: "Infusión Manzanilla-Miel", price: 2500, desc: "Papeleta con jengibre." },
        { cat: "Bebidas Calientes", name: "Infusión Limonaria", price: 2500, desc: "Papeleta." },
        { cat: "Bebidas Calientes", name: "Infusión Toronjil", price: 2500, desc: "Papeleta." },
        { cat: "Bebidas Calientes", name: "Infusión Menta", price: 2500, desc: "Papeleta." },
        { cat: "Bebidas Calientes", name: "Aromática en Leche", price: 3800, desc: "Cualquier sabor en leche." },

        // ==================== MALTEADAS ====================
        { cat: "Malteadas", name: "Malteada Vainilla", price: 11500, desc: "Clásica." },
        { cat: "Malteadas", name: "Malteada Arequipe", price: 12500, desc: "Dulce de leche." },
        { cat: "Malteadas", name: "Malteada Oreo", price: 12500, desc: "Con galleta." },
        { cat: "Malteadas", name: "Malteada Café", price: 13500, desc: "Con espresso." },
        { cat: "Malteadas", name: "Malteada Milo", price: 12500, desc: "Chocolate crocante." },
        { cat: "Malteadas", name: "Malteada Fresa", price: 12500, desc: "Fruta." },

        // ==================== REPOSTERÍA ====================
        { cat: "Repostería", name: "Torta Red Velvet", price: 7300, desc: "Porción." },
        { cat: "Repostería", name: "Torta Chocolate", price: 7300, desc: "Porción." },
        { cat: "Repostería", name: "Torta Genovesa", price: 7300, desc: "Porción." },
        { cat: "Repostería", name: "Torta Zanahoria", price: 7300, desc: "Porción." },
        { cat: "Repostería", name: "Torta Queso", price: 7300, desc: "Porción." },
        { cat: "Repostería", name: "Torta Selva Negra", price: 7300, desc: "Porción." },
        { cat: "Repostería", name: "Cheesecake Frutos Rojos", price: 8000, desc: "Porción." },
        { cat: "Repostería", name: "Cheesecake Frutos Amarillos", price: 8000, desc: "Porción." },
        { cat: "Repostería", name: "Brownie", price: 7000, desc: "Solo." },
        { cat: "Repostería", name: "Brownie con Helado", price: 10000, desc: "Con helado." },
        { cat: "Repostería", name: "Quesillo", price: 7300, desc: "Postre de leche." },
        { cat: "Repostería", name: "Cupcake Red Velvet", price: 5000, desc: "Unidad." },
        { cat: "Repostería", name: "Cupcake Vainilla", price: 4000, desc: "Unidad." },

        // ==================== ANTOJOS ====================
        { cat: "Antojos", name: "Mantecada MANÁ", price: 4000, desc: "Casera." },
        { cat: "Antojos", name: "Hojaldre de Pollo", price: 3500, desc: "Pastel." },
        { cat: "Antojos", name: "Palito de Queso", price: 3500, desc: "Horneado." },
        { cat: "Antojos", name: "Croissant Jamón y Queso", price: 3500, desc: "Horneado." },
        { cat: "Antojos", name: "Arepa con Queso", price: 3000, desc: "Asada." },
        { cat: "Antojos", name: "Buñuelo", price: 3000, desc: "Frito." },
        { cat: "Antojos", name: "Galletas de Café", price: 5000, desc: "Paquete." },
        { cat: "Antojos", name: "Galletas de Queso", price: 5000, desc: "Paquete." },
        { cat: "Antojos", name: "Galletas New York Choco", price: 5000, desc: "Unidad." },
        { cat: "Antojos", name: "Galletas New York Queso", price: 5000, desc: "Unidad." },

        // ==================== POSTRES Y HELADOS ====================
        { cat: "Postres", name: "Copa Helado Normal", price: 4000, desc: "Sencilla." },
        { cat: "Postres", name: "Copa Helado Premium", price: 6500, desc: "Con frutas." },
        { cat: "Postres", name: "Fresas con Crema", price: 10000, desc: "Clásicas." },
        { cat: "Postres", name: "Fresas Premium", price: 12000, desc: "Con fruticrema." },
        { cat: "Postres", name: "Migao Colombiano", price: 6000, desc: "Galleta, queso, buñuelo, masmelo." },

        // ==================== ADICIONALES DULCES ====================
        { cat: "Adicionales Dulces", name: "Nutella", price: 2000, desc: "Porción." },
        { cat: "Adicionales Dulces", name: "Crema Chantilly", price: 2500, desc: "Porción." },
        { cat: "Adicionales Dulces", name: "Masmelo (3un)", price: 2000, desc: "Unidades." },
        { cat: "Adicionales Dulces", name: "Bola de Helado", price: 3000, desc: "Porción." },
        { cat: "Adicionales Dulces", name: "Chocolate Líquido", price: 1200, desc: "Salsa." },
        { cat: "Adicionales Dulces", name: "Jamón y Queso", price: 6000, desc: "Porción." },

        // ==================== DESAYUNOS ====================
        { cat: "Desayunos", name: "Caldo de Costilla", price: 12900, desc: "Con arepa/pan y bebida." },
        { cat: "Desayunos", name: "Caldo con Huevo (Agua)", price: 12900, desc: "Con arepa/pan y bebida." },
        { cat: "Desayunos", name: "Caldo con Huevo (Leche)", price: 12900, desc: "Con arepa/pan y bebida." },
        { cat: "Desayunos", name: "Caldo de Bagre (Agua)", price: 17000, desc: "Con arepa/pan y bebida." },
        { cat: "Desayunos", name: "Caldo de Bagre (Leche)", price: 17000, desc: "Con arepa/pan y bebida." },
        { cat: "Desayunos", name: "Caldo de Pollo", price: 12900, desc: "Con arepa/pan y bebida." },
        { cat: "Desayunos", name: "Tortilla Española", price: 19900, desc: "Huevos, pollo, chorizo, vegetales." },
        { cat: "Desayunos", name: "Tostadas Francesas", price: 16000, desc: "Con dips de mozzarella." },
        { cat: "Desayunos", name: "Tamal con Chocolate", price: 12900, desc: "Completo." },
        { cat: "Desayunos", name: "Consomé de Costilla", price: 5000, desc: "Solo líquido." },
        { cat: "Desayunos", name: "Caldo sin Arepa", price: 9000, desc: "Solo plato fuerte." },

        // ==================== HUEVOS ====================
        { cat: "Huevos", name: "Huevos Pericos", price: 13000, desc: "Con acompañamiento y bebida." },
        { cat: "Huevos", name: "Huevos Rancheros", price: 13000, desc: "Con acompañamiento y bebida." },
        { cat: "Huevos", name: "Huevos Revueltos", price: 13000, desc: "Con acompañamiento y bebida." },
        { cat: "Huevos", name: "Huevos Fritos", price: 13000, desc: "Con acompañamiento y bebida." },
        { cat: "Huevos", name: "Omelette", price: 15000, desc: "Con acompañamiento y bebida." },
        { cat: "Huevos", name: "Huevos Benedictinos", price: 19000, desc: "Salsa holandesa." },

        // ==================== ADICIONALES SAL ====================
        { cat: "Adicionales Sal", name: "Arepa", price: 3000, desc: "Unidad." },
        { cat: "Adicionales Sal", name: "Queso", price: 3500, desc: "Porción." },
        { cat: "Adicionales Sal", name: "Tostadas", price: 1900, desc: "Porción." },
        { cat: "Adicionales Sal", name: "Costilla", price: 4900, desc: "Porción." },
        { cat: "Adicionales Sal", name: "Pan", price: 2500, desc: "Unidad." },
        { cat: "Adicionales Sal", name: "Tamal Solo", price: 6000, desc: "Unidad." },

        // ==================== RESTAURANTE: CARNES ====================
        { cat: "Carnes", name: "Churrasco (330gr)", price: 47000, desc: "Papa criolla, chorizo, ensalada." },
        { cat: "Carnes", name: "Filet Mignon", price: 48000, desc: "Lomo, salsa champiñones, vino." },
        { cat: "Carnes", name: "Medallones de Res", price: 52000, desc: "Salsa de camarones." },

        // ==================== RESTAURANTE: AVES ====================
        { cat: "Aves", name: "Cordon Blue", price: 40000, desc: "Relleno jamón/queso, salsa maíz." },
        { cat: "Aves", name: "Pechuga Hawaiana", price: 34000, desc: "Gratinada con piña." },
        { cat: "Aves", name: "Pasta Pollo 4 Quesos", price: 40000, desc: "Salsa quesos, tocino." },

        // ==================== RESTAURANTE: MARISCOS ====================
        { cat: "Mariscos", name: "Arroz Marinero", price: 50000, desc: "Mixtura mariscos." },
        { cat: "Mariscos", name: "Pastas Green", price: 43000, desc: "Con langostinos." },
        { cat: "Mariscos", name: "Salmón Frutos Rojos", price: 48000, desc: "Lomo en salsa dulce." },
        { cat: "Mariscos", name: "Salmón Toscana", price: 52000, desc: "Salsa cremosa, patacones." },

        // ==================== RESTAURANTE: CEVICHES ====================
        { cat: "Ceviches", name: "Ceviche Cartagenero", price: 30000, desc: "Camarones, plátano." },
        { cat: "Ceviches", name: "Ceviche Peruano", price: 30000, desc: "Camarones, maíz, aguacate." },
        { cat: "Ceviches", name: "Causita Langostino", price: 50000, desc: "Puré de papa, pimentón." },
        { cat: "Ceviches", name: "Ceviche Maná", price: 31900, desc: "Chicharrón de cerdo." },

        // ==================== RESTAURANTE: ENSALADAS ====================
        { cat: "Ensaladas", name: "Ensalada Griega", price: 12900, desc: "Fresca." },
        { cat: "Ensaladas", name: "Ensalada César", price: 15000, desc: "Pollo, crotones." },
        { cat: "Ensaladas", name: "Ensalada Waldorf", price: 16900, desc: "Manzana, nueces." },
        { cat: "Ensaladas", name: "Ensalada Frutas", price: 13900, desc: "Variedad fruta." },
        { cat: "Ensaladas", name: "Ensalada Frutas Helado", price: 16900, desc: "Con helado." },

        // ==================== ADICIONALES FUERTES ====================
        { cat: "Adicionales Almuerzo", name: "Arroz", price: 4000, desc: "Porción." },
        { cat: "Adicionales Almuerzo", name: "Papas Francesa", price: 5200, desc: "Porción." },
        { cat: "Adicionales Almuerzo", name: "Aguacate", price: 6000, desc: "Porción." },
        { cat: "Adicionales Almuerzo", name: "Carne Res", price: 8000, desc: "Porción." },
        { cat: "Adicionales Almuerzo", name: "Carne Cerdo", price: 8000, desc: "Porción." },
        { cat: "Adicionales Almuerzo", name: "Pechuga", price: 8000, desc: "Porción." },
        { cat: "Adicionales Almuerzo", name: "Sopa del día", price: 5000, desc: "Taza." },
        { cat: "Adicionales Almuerzo", name: "Ensalada día", price: 3200, desc: "Porción." },
        { cat: "Adicionales Almuerzo", name: "Tajadas Maduro", price: 3000, desc: "Porción." },
        { cat: "Adicionales Almuerzo", name: "Maíz", price: 3000, desc: "Porción." },
        { cat: "Adicionales Almuerzo", name: "Tocineta", price: 5000, desc: "Porción." },
        { cat: "Adicionales Almuerzo", name: "Huevo", price: 3000, desc: "Unidad." },
        { cat: "Adicionales Almuerzo", name: "Queso", price: 3500, desc: "Porción." },
        { cat: "Adicionales Almuerzo", name: "Chorizo", price: 4000, desc: "Unidad." },
        { cat: "Adicionales Almuerzo", name: "Salchicha", price: 3000, desc: "Unidad." },
        { cat: "Adicionales Almuerzo", name: "Granos día", price: 4000, desc: "Porción." },
        { cat: "Adicionales Almuerzo", name: "Patacones", price: 6500, desc: "Porción." },
        { cat: "Adicionales Almuerzo", name: "Papas Locas", price: 9900, desc: "Porción." },

        // ==================== COMIDA RÁPIDA: HAMBURGUESAS ====================
        { cat: "Hamburguesas", name: "Hamburguesa Clásica", price: 16000, desc: "Carne artesanal." },
        { cat: "Hamburguesas", name: "Hamburguesa Mixta", price: 21000, desc: "Carne y pollo." },
        { cat: "Hamburguesas", name: "La Pamplonesa", price: 23000, desc: "Carnes, embutidos." },
        { cat: "Hamburguesas", name: "Hamburguesa Alemana", price: 22000, desc: "Mermelada tocineta." },
        { cat: "Hamburguesas", name: "Hamburguesa Chicken's", price: 20000, desc: "Pechuga asada." },
        { cat: "Hamburguesas", name: "Hamburguesa Doble", price: 29900, desc: "Doble carne." },
        { cat: "Hamburguesas", name: "Especial Maná", price: 35000, desc: "Con todo." },
        { cat: "Hamburguesas", name: "Hamburguesa Hawaiana", price: 35000, desc: "Piña y tajín." },

        // ==================== COMIDA RÁPIDA: PERROS ====================
        { cat: "Perros Calientes", name: "Perro Americano", price: 15900, desc: "Salchicha americana." },
        { cat: "Perros Calientes", name: "Perro Mixto", price: 20000, desc: "Con pollo." },
        { cat: "Perros Calientes", name: "Perro Argentino", price: 22000, desc: "Con chorizo." },
        { cat: "Perros Calientes", name: "Perro Doble", price: 24500, desc: "Doble carne." },

        // ==================== COMIDA RÁPIDA: DESGRANADOS ====================
        { cat: "Desgranados", name: "Desgranado Pollo", price: 23000, desc: "Maíz y pollo." },
        { cat: "Desgranados", name: "Desgranado Carne", price: 23000, desc: "Maíz y carne." },
        { cat: "Desgranados", name: "Desgranado Mixto", price: 27000, desc: "Maíz y carnes." },

        // ==================== COMIDA RÁPIDA: PICADAS ====================
        { cat: "Picadas", name: "Picada Personal", price: 25900, desc: "1 persona." },
        { cat: "Picadas", name: "Picada Doble", price: 39900, desc: "2 personas." },
        { cat: "Picadas", name: "Picada Familiar", price: 64900, desc: "4 personas." },

        // ==================== COMIDA RÁPIDA: SANDWICHES ====================
        { cat: "Sandwiches", name: "Sandwich Clásico", price: 12000, desc: "Jamón y queso." },
        { cat: "Sandwiches", name: "Sandwich Pollo", price: 15000, desc: "Pollo desmechado." },
        { cat: "Sandwiches", name: "Sandwich Carne", price: 15000, desc: "Carne desmechada." },
        { cat: "Sandwiches", name: "Sandwich Mixto", price: 18000, desc: "Dos carnes." },
        { cat: "Sandwiches", name: "Club House Maná", price: 25000, desc: "Doble piso." },

        // ==================== COMIDA RÁPIDA: PATACONES ====================
        { cat: "Patacones", name: "Patacón Pollo", price: 15000, desc: "Pollo desmechado." },
        { cat: "Patacones", name: "Patacón Carne", price: 15000, desc: "Carne desmechada." },
        { cat: "Patacones", name: "Patacón Mixto", price: 20000, desc: "Dos carnes." },
        { cat: "Patacones", name: "Patacón Trifásico", price: 30000, desc: "Tres carnes." },

        // ==================== COMIDA RÁPIDA: SALCHIPAPAS ====================
        { cat: "Salchipapas", name: "Salchipapa Clásica", price: 16000, desc: "Sencilla." },
        { cat: "Salchipapas", name: "Salchipapa Pollo", price: 20000, desc: "Trozos pollo." },
        { cat: "Salchipapas", name: "Salchipapa Carne", price: 21000, desc: "Trozos carne." },
        { cat: "Salchipapas", name: "Salchipapa Mixta", price: 25000, desc: "Dos carnes." },
        { cat: "Salchipapas", name: "Coripapa", price: 18000, desc: "Con chorizo." },

        // ==================== COMIDA RÁPIDA: WRAPS ====================
        { cat: "Wraps", name: "Wrap Pollo", price: 20000, desc: "Vegetales y pollo." },
        { cat: "Wraps", name: "Wrap Carne", price: 20000, desc: "Vegetales y carne." },
        { cat: "Wraps", name: "Wrap Mixto", price: 23000, desc: "Pollo y carne." },

        // ==================== VEGETARIANO ====================
        { cat: "Vegetariano", name: "Hamburguesa Veggie", price: 19900, desc: "Champiñones." },
        { cat: "Vegetariano", name: "Maicitos Veggie", price: 23000, desc: "Maíz, vegetales." },
        { cat: "Vegetariano", name: "Wrap Veggie", price: 19000, desc: "Vegetales." },

        // ==================== INFANTIL ====================
        { cat: "Infantil", name: "Child Croquette", price: 21900, desc: "Croqueta, papas." },
        { cat: "Infantil", name: "Chickentender", price: 21900, desc: "Nuggets, papas." },
        { cat: "Infantil", name: "Miniburger", price: 24900, desc: "Mini hamburguesa." },

        // ==================== JUGOS EN AGUA ====================
        { cat: "Jugos Agua", name: "Jugo Guanábana (Agua)", price: 7000, desc: "Natural." },
        { cat: "Jugos Agua", name: "Jugo Mango (Agua)", price: 7000, desc: "Natural." },
        { cat: "Jugos Agua", name: "Jugo Mora (Agua)", price: 7000, desc: "Natural." },
        { cat: "Jugos Agua", name: "Jugo Fresa (Agua)", price: 7000, desc: "Natural." },
        { cat: "Jugos Agua", name: "Jugo Maracuyá (Agua)", price: 7000, desc: "Natural." },
        { cat: "Jugos Agua", name: "Jugo Durazno (Agua)", price: 7000, desc: "Natural." },

        // ==================== JUGOS EN LECHE ====================
        { cat: "Jugos Leche", name: "Jugo Guanábana (Leche)", price: 9000, desc: "Natural." },
        { cat: "Jugos Leche", name: "Jugo Mango (Leche)", price: 9000, desc: "Natural." },
        { cat: "Jugos Leche", name: "Jugo Mora (Leche)", price: 9000, desc: "Natural." },
        { cat: "Jugos Leche", name: "Jugo Fresa (Leche)", price: 9000, desc: "Natural." },
        { cat: "Jugos Leche", name: "Jugo Maracuyá (Leche)", price: 9000, desc: "Natural." },
        { cat: "Jugos Leche", name: "Jugo Durazno (Leche)", price: 9000, desc: "Natural." },

        // ==================== LIMONADAS ====================
        { cat: "Limonadas", name: "Limonada Clásica", price: 5000, desc: "Agua." },
        { cat: "Limonadas", name: "Limonada Panela", price: 6000, desc: "Agua de panela." },
        { cat: "Limonadas", name: "Limonada Burbujeante", price: 7000, desc: "Con soda." },
        { cat: "Limonadas", name: "Limonada Santandereana", price: 7500, desc: "Hipinto." },
        { cat: "Limonadas", name: "Limonada Hierbabuena", price: 6500, desc: "Refrescante." },
        { cat: "Limonadas", name: "Limonada Cerezada", price: 8500, desc: "Cereza." },
        { cat: "Limonadas", name: "Limonada Coco", price: 10000, desc: "Cremosa." },

        // ==================== SODAS Y MOCKTAILS ====================
        { cat: "Sodas", name: "Soda Frutos Rojos", price: 10000, desc: "Frutas." },
        { cat: "Sodas", name: "Soda Frutos Amarillos", price: 10000, desc: "Frutas." },
        { cat: "Sodas", name: "Infusión Soda Kiwi", price: 10000, desc: "Trozos fruta." },
        { cat: "Sodas", name: "Infusión Soda Fresa", price: 10000, desc: "Trozos fruta." },
        { cat: "Sodas", name: "Infusión Soda Mora", price: 10000, desc: "Trozos fruta." },
        { cat: "Sodas", name: "Infusión Soda Mango", price: 10000, desc: "Trozos fruta." },
        { cat: "Mocktails", name: "Frutos Rojos (Sin Licor)", price: 10000, desc: "Refrescante." },
        { cat: "Mocktails", name: "Amarillo Tropical", price: 10000, desc: "Sin licor." },
        { cat: "Mocktails", name: "Maracumango", price: 8000, desc: "Sin licor." },

        // ==================== MICHELADAS ====================
        { cat: "Micheladas", name: "Michelada Clásica", price: 1500, desc: "Solo limón y sal." },
        { cat: "Micheladas", name: "Michelada Mango Biche", price: 4500, desc: "Con fruta." },
        { cat: "Micheladas", name: "Michelada Frutos Rojos", price: 5000, desc: "Con fruta." },
        { cat: "Micheladas", name: "Michelada Frutos Amarillos", price: 5000, desc: "Con fruta." },
        { cat: "Micheladas", name: "Michelada Maná", price: 6000, desc: "Whiskey/Tequila." },
        { cat: "Micheladas", name: "Michelada Diablito", price: 7000, desc: "Picante." },

        // ==================== CERVEZAS ====================
        { cat: "Cervezas", name: "Andina", price: 5000, desc: "Nacional." },
        { cat: "Cervezas", name: "Poker", price: 5000, desc: "Nacional." },
        { cat: "Cervezas", name: "Budweiser", price: 5000, desc: "Importada." },
        { cat: "Cervezas", name: "Club Colombia", price: 5500, desc: "Nacional." },
        { cat: "Cervezas", name: "Corona", price: 9000, desc: "Importada." },
        { cat: "Cervezas", name: "Coronita", price: 6000, desc: "Importada." },
        { cat: "Cervezas", name: "Heineken", price: 5500, desc: "Importada." },
        { cat: "Cervezas", name: "Águila", price: 5000, desc: "Nacional." },

        // ==================== OTRAS BEBIDAS ====================
        { cat: "Otras Bebidas", name: "Agua Botella", price: 2000, desc: "Personal." },
        { cat: "Otras Bebidas", name: "Gaseosa 350ml", price: 3200, desc: "Personal." },
        { cat: "Otras Bebidas", name: "Gaseosa 500ml", price: 4000, desc: "Personal." },
        { cat: "Otras Bebidas", name: "Jugo Hit 250ml", price: 2900, desc: "Caja." },
        { cat: "Otras Bebidas", name: "Jugo Hit 350ml", price: 3200, desc: "Botella." },
        { cat: "Otras Bebidas", name: "Jugo Hit 500ml", price: 3600, desc: "Botella." },
        { cat: "Otras Bebidas", name: "Jarra Limonada", price: 9000, desc: "Compartir." },
        { cat: "Otras Bebidas", name: "Jarra Cerezada", price: 13000, desc: "Compartir." },
        { cat: "Otras Bebidas", name: "Jarra Panelada", price: 10000, desc: "Compartir." },
        { cat: "Otras Bebidas", name: "Gaseosa 1.5Lt", price: 8000, desc: "Grande." },
        { cat: "Otras Bebidas", name: "CocaCola 1.5Lt", price: 9000, desc: "Grande." },
        { cat: "Otras Bebidas", name: "Gaseosa 2.5Lt", price: 10000, desc: "Grande." },
        { cat: "Otras Bebidas", name: "Natu Malta Mini", price: 1800, desc: "Pequeña." },
        { cat: "Otras Bebidas", name: "Natu Malta 400ml", price: 3900, desc: "Mediana." },
        { cat: "Otras Bebidas", name: "Natu Malta Litro", price: 6000, desc: "Grande." },
        { cat: "Otras Bebidas", name: "Agua Litro", price: 3000, desc: "Grande." },
        { cat: "Otras Bebidas", name: "Soda 350ml", price: 3200, desc: "Personal." },
        { cat: "Otras Bebidas", name: "Soda 1.5Lt", price: 7000, desc: "Grande." },
        { cat: "Otras Bebidas", name: "Ginger", price: 3200, desc: "350ml." },
        { cat: "Otras Bebidas", name: "Gatorade", price: 4500, desc: "Hidratante." },
        { cat: "Otras Bebidas", name: "Mr Tea / Hatsu", price: 3700, desc: "Té." },
        { cat: "Otras Bebidas", name: "Suero Cristal", price: 3000, desc: "Hidratante." },

        // ==================== CÓCTELES ====================
        { cat: "Cócteles", name: "Mojito Clásico", price: 14000, desc: "Ron." },
        { cat: "Cócteles", name: "Margarita Tradicional", price: 15000, desc: "Tequila." },
        { cat: "Cócteles", name: "Piña Colada", price: 19000, desc: "Ron." },
        { cat: "Cócteles", name: "On The Beach", price: 18000, desc: "Vodka." },
        { cat: "Cócteles", name: "Orgasm", price: 18000, desc: "Amaretto." },
        { cat: "Cócteles", name: "Penicillin", price: 19000, desc: "Whiskey." },
        { cat: "Cócteles", name: "Moscow Mule", price: 18000, desc: "Vodka." },
        { cat: "Cócteles", name: "Daikiri", price: 15000, desc: "Ron." },
        { cat: "Cócteles", name: "Caipiroska", price: 16000, desc: "Vodka." },
        { cat: "Cócteles", name: "Caipirissima", price: 16000, desc: "Ron." },
        { cat: "Cócteles", name: "Whiskey Sour", price: 14000, desc: "Whiskey." },
        { cat: "Cócteles", name: "Alexander", price: 18000, desc: "Ginebra." },

        // ==================== VINOS ====================
        { cat: "Vinos", name: "Copa de Vino", price: 12000, desc: "Tinto o Blanco." },
        { cat: "Vinos", name: "Vino Caliente", price: 15000, desc: "Especia." }
    ];

    const stmt = db.prepare("INSERT INTO dishes (category, name, price, description) VALUES (?, ?, ?, ?)");
    dishes.forEach(d => stmt.run(d.cat, d.name, d.price, d.desc || ""));
    stmt.finalize();
    console.log("✅ Menú masivo cargado exitosamente.");
};

// --- SEGURIDAD Y RUTAS ---
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

initDB().then(() => app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`))).catch(console.error);
