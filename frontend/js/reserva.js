const API_URL = '/api';
let selectedItems = {};
let allDishes = [];
let allTimeSlots = [];
let currentOrderType = 'reserva';
let currentFilterGroup = 'Todos';
let currentSubFilter = 'Todos';

const INGREDIENTS = [
    { name: "Arroz", price: 4000 },
    { name: "Papas a la Francesa", price: 5200 },
    { name: "Carnes (Res, Cerdo, Pechuga)", price: 8900 },
    { name: "Sopa del día", price: 5000 },
    { name: "Ensalada", price: 3200 },
    { name: "Tajadas de Maduro", price: 3000 },
    { name: "Maíz", price: 3000 },
    { name: "Tocineta", price: 5000 },
    { name: "Huevo", price: 3000 },
    { name: "Queso", price: 3500 },
    { name: "Chorizo", price: 4000 },
    { name: "Salchicha", price: 3000 },
    { name: "Granos del día", price: 4000 },
    { name: "Patacones", price: 6500 },
    { name: "Papas locas", price: 9900 }
];

let tempCustomQuantities = {}; 

const CATEGORY_GROUPS = {
    'Comida Rápida': ['Hamburguesas', 'Perros Calientes', 'Salchipapas', 'Desgranados', 'Picadas', 'Sandwiches', 'Patacones', 'Wraps', 'Vegetariano', 'Infantil'],
    'Restaurante': ['Desayunos', 'Huevos', 'Carnes', 'Aves', 'Mariscos', 'Ceviches', 'Ensaladas'],
    'Cafetería': ['Clásicos Café', 'Nevados', 'Frappés', 'Malteadas', 'Bebidas Calientes', 'Repostería', 'Postres', 'Antojos'],
    'Bebidas': ['Jugos Agua', 'Jugos Leche', 'Limonadas', 'Sodas', 'Mocktails', 'Micheladas', 'Cócteles', 'Cervezas', 'Vinos', 'Otras Bebidas']
};

document.addEventListener('DOMContentLoaded', () => {
    renderMenuForReservation();
    setupReservationForm();
    loadReservationConfig();
    renderIngredientsList();
});

function getCategoryEmoji(category) {
    const emojis = {
        'Clásicos Café': '☕', 'Nevados': '🍧', 'Frappés': '🥤', 'Malteadas': '🍦', 
        'Bebidas Calientes': '🍵', 'Repostería': '🍰', 'Postres': '🍮', 'Antojos': '🥐', 
        'Adicionales Dulces': '🍬', 'Desayunos': '🍳', 'Huevos': '🥚', 'Adicionales Sal': '🧀', 
        'Carnes': '🥩', 'Aves': '🍗', 'Mariscos': '🍤', 'Ceviches': '🍋', 'Ensaladas': '🥗', 
        'Adicionales Almuerzo': '🍚', 'Hamburguesas': '🍔', 'Perros Calientes': '🌭', 
        'Desgranados': '🌽', 'Picadas': '🍖', 'Sandwiches': '🥪', 'Patacones': '🍌', 
        'Salchipapas': '🍟', 'Wraps': '🌯', 'Vegetariano': '🥦', 'Infantil': '🧒', 
        'Jugos Agua': '🧃', 'Jugos Leche': '🥛', 'Limonadas': '🍋', 'Sodas': '🫧', 
        'Mocktails': '🍹', 'Micheladas': '🍻', 'Cócteles': '🍸', 'Cervezas': '🍺', 
        'Vinos': '🍷', 'Otras Bebidas': '🥤'
    };
    return emojis[category] || '🍽️';
}

// FILTRO NIVEL 1 (GRUPOS)
window.filterReservaMenu = function(group) {
    currentFilterGroup = group;
    currentSubFilter = 'Todos'; // Reset subfiltro
    
    // Activar botón visualmente
    document.querySelectorAll('#mainTabs .reserva-tab-btn').forEach(btn => {
        if(btn.innerText === group) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Manejar Sub-Filtros
    const subTabsContainer = document.getElementById('subFilterTabs');
    if (group === 'Todos' || !CATEGORY_GROUPS[group]) {
        subTabsContainer.style.display = 'none';
        subTabsContainer.innerHTML = '';
    } else {
        // Generar botones de subcategoría
        const subCategories = CATEGORY_GROUPS[group];
        let buttonsHtml = `<button class="reserva-tab-btn sub-btn active" onclick="filterBySubCategory('Todos')">Ver Todo ${group}</button>`;
        
        subCategories.forEach(sub => {
            buttonsHtml += `<button class="reserva-tab-btn sub-btn" onclick="filterBySubCategory('${sub}')">${sub}</button>`;
        });
        
        subTabsContainer.innerHTML = buttonsHtml;
        subTabsContainer.style.display = 'flex';
    }

    renderGrid();
};

// FILTRO NIVEL 2 (SUBCATEGORÍAS)
window.filterBySubCategory = function(subCat) {
    currentSubFilter = subCat;
    
    // Actualizar botones visualmente
    document.querySelectorAll('.sub-btn').forEach(btn => {
        // Comparación flexible para el botón "Ver Todo..."
        if(btn.innerText === subCat || (subCat === 'Todos' && btn.innerText.includes('Ver Todo'))) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    renderGrid();
};

async function renderMenuForReservation() {
    if (allDishes.length === 0) {
        try {
            const response = await fetch(API_URL + '/dishes');
            allDishes = await response.json();
        } catch (e) { console.error(e); }
    }
    renderGrid();
}

function renderGrid() {
    const grid = document.getElementById('reservaMenuGrid');
    if (!grid) return;

    let filteredDishes = allDishes;

    // 1. Filtrar por Grupo Principal
    if (currentFilterGroup !== 'Todos') {
        const allowedCategories = CATEGORY_GROUPS[currentFilterGroup] || [];
        filteredDishes = allDishes.filter(d => allowedCategories.includes(d.category));
        
        // 2. Filtrar por Subcategoría (si se seleccionó una específica)
        if (currentSubFilter !== 'Todos') {
            filteredDishes = filteredDishes.filter(d => d.category === currentSubFilter);
        }
    }

    // Tarjeta Especial "Arma tu Plato"
    let customCard = '';
    if (currentFilterGroup === 'Todos' || currentFilterGroup === 'Restaurante') {
        customCard = `
            <div class="reserva-menu-item special-card" onclick="openCustomPlateModal()">
                <div class="reserva-menu-item-icon" style="background: #fdf2e9; color: var(--primary); display:flex; justify-content:center; align-items:center;">
                    <i class="fa-solid fa-utensils" style="font-size: 3rem;"></i>
                </div>
                <h4>🛠️ Arma tu Plato</h4>
                <span class="price">A tu gusto</span>
                <button type="button" class="btn btn-sm btn-primary" style="margin-top:5px; width:100%;">Empezar</button>
            </div>
        `;
    }

    if (filteredDishes.length === 0 && !customCard) {
        grid.innerHTML = '<p style="text-align:center;color:#999;grid-column:1/-1;">No hay platos en esta sección.</p>';
        return;
    }

    const dishesHtml = filteredDishes.map(m => `
        <div class="reserva-menu-item">
            <div class="reserva-menu-item-icon" style="${!m.image ? 'display:flex;align-items:center;justify-content:center;background:#fff;' : ''}">
                ${m.image 
                    ? `<img src="${m.image}" alt="${m.name}">` 
                    : `<span style="font-size: 3rem;">${getCategoryEmoji(m.category)}</span>`}
            </div>
            <h4>${m.name}</h4>
            <span class="price">$${m.price.toLocaleString('es-CO')}</span>
            <div class="qty-control">
                <button type="button" onclick="changeQty(${m.id}, -1, '${m.name}', ${m.price})">-</button>
                <input type="number" id="qty-${m.id}" value="${selectedItems[m.id] ? selectedItems[m.id].qty : 0}" readonly>
                <button type="button" onclick="changeQty(${m.id}, 1, '${m.name}', ${m.price})">+</button>
            </div>
        </div>
    `).join('');

    grid.innerHTML = customCard + dishesHtml;
}

// ... (Resto de funciones: changeQty, modal de arma tu plato, envío de formulario, etc. IGUAL QUE ANTES) ...
// Copiar todo el resto del archivo anterior desde aquí hacia abajo
// Para brevedad, pego aquí las funciones esenciales que no cambian:

window.changeQty = function(id, delta, name, price) {
    const input = document.getElementById(`qty-${id}`);
    if (!input) return; 
    let newVal = parseInt(input.value) + delta;
    if (newVal < 0) newVal = 0;
    input.value = newVal;
    if (newVal > 0) selectedItems[id] = { name, price, qty: newVal, subtotal: newVal * price };
    else delete selectedItems[id];
    updateReservationSummary();
};

window.updateReservationItem = function(id, qty, name, price) { changeQty(id, 0, name, price); };

function renderIngredientsList() {
    const list = document.getElementById('ingredientsList');
    if(!list) return;
    list.innerHTML = INGREDIENTS.map((ing, index) => `
        <div class="ingredient-item">
            <div class="ing-info">
                <span>${ing.name}</span>
                <strong>$${ing.price.toLocaleString('es-CO')}</strong>
            </div>
            <div class="ing-controls">
                <button type="button" class="btn-qty" onclick="updateIngQty(${index}, -1)">-</button>
                <span id="ing-qty-${index}" class="qty-display">0</span>
                <button type="button" class="btn-qty" onclick="updateIngQty(${index}, 1)">+</button>
            </div>
        </div>
    `).join('');
}

window.openCustomPlateModal = function() {
    tempCustomQuantities = {}; 
    INGREDIENTS.forEach((_, index) => {
        const display = document.getElementById(`ing-qty-${index}`);
        if(display) display.textContent = "0";
    });
    document.getElementById('customTotal').textContent = "$0";
    document.getElementById('customPlateModal').style.display = 'flex';
};

window.closeCustomPlateModal = function() { document.getElementById('customPlateModal').style.display = 'none'; };

window.updateIngQty = function(index, delta) {
    const ingredient = INGREDIENTS[index];
    const display = document.getElementById(`ing-qty-${index}`);
    let currentQty = tempCustomQuantities[ingredient.name] || 0;
    let newQty = currentQty + delta;
    if (newQty < 0) newQty = 0;
    if (newQty > 0) tempCustomQuantities[ingredient.name] = newQty;
    else delete tempCustomQuantities[ingredient.name];
    display.textContent = newQty;
    display.style.color = newQty > 0 ? 'var(--primary)' : '#666';
    display.style.fontWeight = newQty > 0 ? 'bold' : 'normal';
    calculateCustomTotal();
};

function calculateCustomTotal() {
    let total = 0;
    for (const [name, qty] of Object.entries(tempCustomQuantities)) {
        const ing = INGREDIENTS.find(i => i.name === name);
        if (ing) total += ing.price * qty;
    }
    document.getElementById('customTotal').textContent = `$${total.toLocaleString('es-CO')}`;
}

window.addCustomPlateToOrder = function() {
    const ingredientNames = Object.keys(tempCustomQuantities);
    if(ingredientNames.length === 0) return alert("Selecciona al menos una porción.");
    let totalPlatePrice = 0;
    let descriptionParts = [];
    for (const [name, qty] of Object.entries(tempCustomQuantities)) {
        const ing = INGREDIENTS.find(i => i.name === name);
        if (ing) {
            totalPlatePrice += ing.price * qty;
            descriptionParts.push(`${qty}x ${name}`);
        }
    }
    const customId = 'custom_' + Date.now(); 
    selectedItems[customId] = { name: `Armado: ${descriptionParts.join(', ')}`, price: totalPlatePrice, qty: 1, subtotal: totalPlatePrice };
    updateReservationSummary();
    closeCustomPlateModal();
};

window.removeItem = function(id) {
    delete selectedItems[id];
    const input = document.getElementById(`qty-${id}`);
    if(input) input.value = 0;
    updateReservationSummary();
};

function updateReservationSummary() {
    const items = Object.values(selectedItems);
    const summaryDiv = document.getElementById('summaryItems');
    const totalEl = document.getElementById('totalPrice');
    if (items.length > 0) {
        let total = 0;
        let html = '';
        for (const [id, item] of Object.entries(selectedItems)) {
            total += item.subtotal;
            html += `<div class="summary-item"><div style="flex:1;"><span style="display:block; font-weight:bold;">${item.name}</span><small>Cant: ${item.qty} | $${item.subtotal.toLocaleString('es-CO')}</small></div><button type="button" onclick="removeItem('${id}')" style="color:red; background:none; border:none; cursor:pointer; font-size:1.2rem;">×</button></div>`;
        }
        summaryDiv.innerHTML = html;
        if (currentOrderType === 'domicilio') total += 1000;
        totalEl.textContent = `$${total.toLocaleString('es-CO')}`;
    } else {
        summaryDiv.innerHTML = '<p class="empty-msg" style="text-align:center;color:#999;">Ningún plato seleccionado</p>';
        totalEl.textContent = '$0';
    }
}

window.setOrderType = function(type) {
    currentOrderType = type;
    document.getElementById('orderType').value = type;
    document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
    if (type === 'reserva') {
        document.querySelector('.type-btn:first-child').classList.add('active');
        document.getElementById('dateTimeSection').style.display = 'block';
        document.getElementById('minHoursWarning').style.display = 'block';
        document.getElementById('deliveryWarning').style.display = 'none';
        document.getElementById('addressGroup').style.display = 'none';
        document.getElementById('address').required = false;
        document.getElementById('guestsGroup').style.display = 'block';
        document.getElementById('packagingCostRow').style.display = 'none';
        document.getElementById('submitBtn').textContent = 'Confirmar Reserva';
        document.getElementById('stepNumber').textContent = '4';
    } else {
        document.querySelector('.type-btn:last-child').classList.add('active');
        document.getElementById('dateTimeSection').style.display = 'none';
        document.getElementById('minHoursWarning').style.display = 'none';
        document.getElementById('deliveryWarning').style.display = 'block';
        document.getElementById('addressGroup').style.display = 'block';
        document.getElementById('address').required = true;
        document.getElementById('guestsGroup').style.display = 'none';
        document.getElementById('packagingCostRow').style.display = 'flex';
        document.getElementById('submitBtn').textContent = 'Pedir por WhatsApp';
        document.getElementById('stepNumber').textContent = '2';
    }
    updateReservationSummary();
};

async function loadReservationConfig() {
    try {
        const response = await fetch(API_URL + '/config');
        const config = await response.json();
        const minHours = config.minHours || 8;
        const maxCapacity = config.maxCapacity || 30;
        allTimeSlots = config.timeSlots || ["12:00-13:00", "13:00-14:00", "18:00-19:00"];
        localStorage.setItem('minReservationHours', minHours);
        localStorage.setItem('maxCapacity', maxCapacity);
        showMinHoursWarning(minHours);
        renderTimeSlotButtons();
    } catch (err) { console.error(err); }
}

function showMinHoursWarning(minHours) {
    const now = new Date();
    const nextAvailable = new Date(now.getTime() + minHours * 60 * 60 * 1000);
    const warningText = document.getElementById('warningText');
    if (warningText) {
        warningText.innerHTML = `Reservar con ${minHours}h de anticipación.<br>Disponible desde: ${nextAvailable.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'})}`;
    }
}

function renderTimeSlotButtons() {
    const container = document.getElementById('timeSlotsContainer');
    if (!container) return;
    container.innerHTML = allTimeSlots.map(slot => `
        <button type="button" class="time-slot-btn" onclick="handleTimeSlotClick('${slot}', this)">🕐 ${slot}</button>
    `).join('');
}

window.handleTimeSlotClick = function(slot, btnElement) {
    const dateStr = document.getElementById('reservationDate').value;
    if (!dateStr) return alert('📅 Selecciona primero la fecha.');
    document.querySelectorAll('.time-slot-btn').forEach(btn => btn.classList.remove('selected'));
    btnElement.classList.add('selected');
    document.getElementById('selectedTimeSlot').value = slot;
    checkSlotCapacity(dateStr, slot);
};

async function checkSlotCapacity(dateStr, timeSlot) {
    try {
        const response = await fetch(API_URL + '/reservations');
        const reservations = await response.json();
        const maxCapacity = parseInt(localStorage.getItem('maxCapacity') || 30);
        const slotReservations = reservations.filter(r => r.date === dateStr && r.timeSlot === timeSlot);
        const totalGuests = slotReservations.reduce((sum, r) => sum + r.guests, 0);
        const available = maxCapacity - totalGuests;
        const warningDiv = document.getElementById('capacityWarning');
        if (warningDiv) {
            warningDiv.style.backgroundColor = '';
            if (available < 5 && available > 0) {
                warningDiv.innerHTML = `⚠️ Quedan solo ${available} cupos.`;
                warningDiv.style.display = 'block';
            } else if (available <= 0) {
                warningDiv.innerHTML = `⛔ Agotado. Elige otra hora.`;
                warningDiv.style.display = 'block';
                warningDiv.style.backgroundColor = '#f8d7da';
            } else {
                warningDiv.style.display = 'none';
            }
        }
    } catch (err) { console.error(err); }
}

function setupReservationForm() {
    const form = document.getElementById('reservationForm');
    if (form) form.addEventListener('submit', handleFormSubmit);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const items = Object.values(selectedItems);
    if (items.length === 0) return alert('🥘 Selecciona al menos un plato.');

    const name = document.getElementById('name').value;
    let phone = document.getElementById('phone').value.trim();
    phone = phone.replace(/\D/g, ''); 
    if (!/^3\d{9}$/.test(phone)) {
        return alert('📱 El teléfono debe ser un celular válido (Ej: 3124322345).');
    }

    let total = items.reduce((sum, item) => sum + item.subtotal, 0);
    if (currentOrderType === 'domicilio') total += 1000;

    if (currentOrderType === 'domicilio') {
        const address = document.getElementById('address').value;
        if (!address) return alert('Por favor escribe la dirección de entrega.');
        const orderData = { name, phone, address, items, total, type: 'domicilio' };
        showWhatsAppModal(orderData);
        return;
    }

    const dateStr = document.getElementById('reservationDate').value;
    const timeSlot = document.getElementById('selectedTimeSlot').value;
    if (!dateStr || !timeSlot) return alert('📅 Completa fecha y hora.');

    const reservationData = {
        name, phone, date: dateStr, timeSlot,
        guests: parseInt(document.getElementById('guests').value),
        items, total
    };

    try {
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = 'Guardando...';

        const res = await fetch(API_URL + '/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reservationData)
        });

        if (res.ok) {
            reservationData.type = 'reserva';
            showWhatsAppModal(reservationData);
            document.getElementById('reservationForm').reset();
            selectedItems = {};
            updateReservationSummary();
        } else {
            alert('Error al guardar reserva.');
        }
    } catch (err) { alert('Error de conexión.'); }
    finally {
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = false; btn.textContent = 'Confirmar Reserva';
    }
}

function showWhatsAppModal(data) {
    const modal = document.getElementById('confirmationModal');
    const msg = document.getElementById('confirmationMessage');
    const title = document.getElementById('modalTitle');
    const subtitle = document.getElementById('modalSubtitle');

    let platosTexto = data.items.map(i => `- ${i.qty}x ${i.name}`).join('\n');
    let text = "";

    if (data.type === 'domicilio') {
        title.textContent = "¡Pedido Listo!";
        subtitle.textContent = "Envía tu pedido por WhatsApp para que lo preparemos.";
        text = `Hola Mana Restobar! 🛵 Quiero pedir un domicilio:

👤 Nombre: ${data.name}
📞 Tel: ${data.phone}
📍 Dirección: ${data.address}

🍽️ Pedido:
${platosTexto}
📦 Empaques: $1.000

💰 Total Aprox (sin envio): $${data.total.toLocaleString('es-CO')}

¿Cual seria el costo del domicilio?`;
    } else {
        title.textContent = "¡Reserva Guardada! ✅";
        subtitle.textContent = "Ahora confírmala enviando este mensaje.";
        text = `Hola Mana Restobar! Quiero confirmar mi reserva:

👤 Nombre: ${data.name}
📅 Fecha: ${data.date}
⏰ Hora: ${data.timeSlot}
👥 Personas: ${data.guests}

🍽️ Pedido:
${platosTexto}

💰 Total Aprox: $${data.total.toLocaleString('es-CO')}

Quedo atento a su confirmacion!`;
    }

    const whatsappLink = `https://api.whatsapp.com/send?phone=573150118386&text=${encodeURIComponent(text)}`;

    msg.innerHTML = `
        <div style="text-align:left; margin-top:1rem;">
            <div style="background:#f9f9f9; padding:10px; border-radius:8px; margin:10px 0; font-size:0.9rem; border-left: 4px solid var(--primary);">
                <strong>Resumen:</strong><br>
                ${data.type === 'domicilio' ? '🛵 Domicilio' : '📅 Reserva en Mesa'}<br>
                Total: $${data.total.toLocaleString('es-CO')}
            </div>
            <a href="${whatsappLink}" target="_blank" class="btn" style="background-color:#25D366; color:white; display:block; text-align:center; text-decoration:none; margin-top:15px; font-weight:bold; border:none; padding:12px; border-radius:8px;">
                <i class="fa-brands fa-whatsapp"></i> Enviar a WhatsApp
            </a>
        </div>
    `;
    modal.style.display = 'flex';
}

window.closeModal = function() {
    document.getElementById('confirmationModal').style.display = 'none';
    if (currentOrderType === 'reserva') {
        window.location.href = 'index.html';
    } else {
        selectedItems = {};
        updateReservationSummary();
        document.getElementById('reservationForm').reset();
    }
};

