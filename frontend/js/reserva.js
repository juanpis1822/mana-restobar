const API_URL = '/api';
let selectedItems = {};
let allDishes = [];
let allTimeSlots = [];
let currentOrderType = 'reserva';

// LISTA DE INGREDIENTES PARA "ARMA TU PLATO"
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

let tempCustomPlate = []; // Para guardar temporalmente lo que se selecciona en el modal

document.addEventListener('DOMContentLoaded', () => {
    renderMenuForReservation();
    setupReservationForm();
    loadReservationConfig();
    renderIngredientsList(); // Renderizar lista en el modal
});

// ... (Funciones de Configuración y Horarios IGUAL QUE ANTES) ...
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

// =========================================================
// 3. MENÚ (MODIFICADO PARA INCLUIR TARJETA "ARMA TU PLATO")
// =========================================================
async function renderMenuForReservation() {
    try {
        const response = await fetch(API_URL + '/dishes');
        allDishes = await response.json();
        const grid = document.getElementById('reservaMenuGrid');
        if (!grid) return;

        // Tarjeta Especial de "Arma tu Plato"
        const customCard = `
            <div class="reserva-menu-item special-card" onclick="openCustomPlateModal()">
                <div class="reserva-menu-item-icon" style="background: #fdf2e9; color: var(--primary); display:flex; justify-content:center; align-items:center;">
                    <i class="fa-solid fa-utensils" style="font-size: 3rem;"></i>
                </div>
                <h4>🛠️ Arma tu Plato</h4>
                <span class="price">A tu gusto</span>
                <button type="button" class="btn btn-sm btn-primary" style="margin-top:5px; width:100%;">Empezar</button>
            </div>
        `;

        if (allDishes.length === 0) {
            grid.innerHTML = customCard + '<p style="text-align:center;color:#999;grid-column:1/-1;">No hay más platos disponibles.</p>';
            return;
        }

        const dishesHtml = allDishes.map(m => `
            <div class="reserva-menu-item">
                <div class="reserva-menu-item-icon">${m.image ? `<img src="${m.image}" alt="${m.name}">` : '🍽️'}</div>
                <h4>${m.name}</h4>
                <span class="price">$${m.price.toLocaleString('es-CO')}</span>
                <input type="number" min="0" value="0" placeholder="0" onchange="updateReservationItem(${m.id}, this.value, '${m.name}', ${m.price})">
            </div>
        `).join('');

        grid.innerHTML = customCard + dishesHtml;

    } catch (err) { console.error(err); }
}

// Actualizar ítems normales
window.updateReservationItem = function(id, qty, name, price) {
    qty = parseInt(qty) || 0;
    if (qty > 0) selectedItems[id] = { name, price, qty, subtotal: qty * price };
    else delete selectedItems[id];
    updateReservationSummary();
};

// =========================================================
// LÓGICA DE "ARMA TU PLATO"
// =========================================================
function renderIngredientsList() {
    const list = document.getElementById('ingredientsList');
    if(!list) return;
    list.innerHTML = INGREDIENTS.map((ing, index) => `
        <label class="ingredient-item">
            <input type="checkbox" onchange="toggleIngredient(${index}, this.checked)">
            <span>${ing.name}</span>
            <strong>$${ing.price.toLocaleString('es-CO')}</strong>
        </label>
    `).join('');
}

window.openCustomPlateModal = function() {
    tempCustomPlate = [];
    // Resetear checkboxes
    document.querySelectorAll('#ingredientsList input').forEach(i => i.checked = false);
    document.getElementById('customTotal').textContent = "$0";
    document.getElementById('customPlateModal').style.display = 'flex';
};

window.closeCustomPlateModal = function() {
    document.getElementById('customPlateModal').style.display = 'none';
};

window.toggleIngredient = function(index, isChecked) {
    const ingredient = INGREDIENTS[index];
    if(isChecked) {
        tempCustomPlate.push(ingredient);
    } else {
        tempCustomPlate = tempCustomPlate.filter(i => i.name !== ingredient.name);
    }
    // Calcular total temporal
    const total = tempCustomPlate.reduce((sum, i) => sum + i.price, 0);
    document.getElementById('customTotal').textContent = `$${total.toLocaleString('es-CO')}`;
};

window.addCustomPlateToOrder = function() {
    if(tempCustomPlate.length === 0) return alert("Selecciona al menos un ingrediente");

    const total = tempCustomPlate.reduce((sum, i) => sum + i.price, 0);
    const names = tempCustomPlate.map(i => i.name).join(', ');
    const customId = 'custom_' + Date.now(); // ID único

    // Agregar a selectedItems
    selectedItems[customId] = {
        name: `Armado: ${names}`,
        price: total,
        qty: 1,
        subtotal: total
    };

    updateReservationSummary();
    closeCustomPlateModal();
};

// Función para borrar ítems del resumen (útil para los personalizados)
window.removeItem = function(id) {
    delete selectedItems[id];
    // Si es un ítem de menú normal, resetear su input
    const input = document.querySelector(`input[onchange*="${id}"]`);
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
        
        // Convertir el objeto selectedItems en array para poder iterar con las llaves (IDs)
        for (const [id, item] of Object.entries(selectedItems)) {
            total += item.subtotal;
            html += `
                <div class="summary-item">
                    <div style="flex:1;">
                        <span style="display:block; font-weight:bold;">${item.name}</span>
                        <small>Cant: ${item.qty} | $${item.subtotal.toLocaleString('es-CO')}</small>
                    </div>
                    <button type="button" onclick="removeItem('${id}')" style="color:red; background:none; border:none; cursor:pointer; font-size:1.2rem;">&times;</button>
                </div>`;
        }
        summaryDiv.innerHTML = html;

        if (currentOrderType === 'domicilio') total += 1000;
        totalEl.textContent = `$${total.toLocaleString('es-CO')}`;
    } else {
        summaryDiv.innerHTML = '<p class="empty-msg" style="text-align:center;color:#999;">Ningún plato seleccionado</p>';
        totalEl.textContent = '$0';
    }
}

// ... (Resto del código de envío y WhatsApp igual) ...
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

    const whatsappLink = `https://api.whatsapp.com/send?phone=573143258525&text=${encodeURIComponent(text)}`;

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
