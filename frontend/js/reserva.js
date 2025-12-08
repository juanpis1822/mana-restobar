const API_URL = '/api';
let selectedItems = {};
let allDishes = [];
let allTimeSlots = [];
let currentOrderType = 'reserva'; // 'reserva' o 'domicilio'

document.addEventListener('DOMContentLoaded', () => {
    renderMenuForReservation();
    setupReservationForm();
    loadReservationConfig();
});

// =========================================================
// 0. CAMBIO DE MODO (RESERVA VS DOMICILIO)
// =========================================================
window.setOrderType = function(type) {
    currentOrderType = type;
    document.getElementById('orderType').value = type;

    // Actualizar botones visualmente
    document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
    if (type === 'reserva') {
        document.querySelector('.type-btn:first-child').classList.add('active');
    } else {
        document.querySelector('.type-btn:last-child').classList.add('active');
    }

    // Mostrar/Ocultar secciones
    const dateSection = document.getElementById('dateTimeSection');
    const warningReserva = document.getElementById('minHoursWarning');
    const warningDomicilio = document.getElementById('deliveryWarning');
    const addressGroup = document.getElementById('addressGroup');
    const guestsGroup = document.getElementById('guestsGroup');
    const packagingRow = document.getElementById('packagingCostRow');
    const submitBtn = document.getElementById('submitBtn');
    const stepNumber = document.getElementById('stepNumber');

    if (type === 'reserva') {
        dateSection.style.display = 'block';
        warningReserva.style.display = 'block';
        warningDomicilio.style.display = 'none';
        addressGroup.style.display = 'none';
        document.getElementById('address').required = false;
        guestsGroup.style.display = 'block';
        packagingRow.style.display = 'none';
        submitBtn.textContent = 'Confirmar Reserva';
        stepNumber.textContent = '4';
    } else {
        // Modo Domicilio
        dateSection.style.display = 'none';
        warningReserva.style.display = 'none';
        warningDomicilio.style.display = 'block';
        addressGroup.style.display = 'block';
        document.getElementById('address').required = true;
        guestsGroup.style.display = 'none';
        packagingRow.style.display = 'flex';
        submitBtn.textContent = 'Pedir por WhatsApp';
        stepNumber.textContent = '2'; // Saltamos pasos
    }

    // Recalcular total (por el costo de empaque)
    updateReservationSummary();
};

// =========================================================
// 1. CONFIGURACIÓN
// =========================================================
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

// =========================================================
// 2. HORARIOS (Solo Reserva)
// =========================================================
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
// 3. MENÚ
// =========================================================
async function renderMenuForReservation() {
    try {
        const response = await fetch(API_URL + '/dishes');
        allDishes = await response.json();
        const grid = document.getElementById('reservaMenuGrid');
        if (!grid) return;

        if (allDishes.length === 0) {
            grid.innerHTML = '<p style="text-align:center;color:#999;grid-column:1/-1;">No hay platos disponibles.</p>';
            return;
        }

        grid.innerHTML = allDishes.map(m => `
            <div class="reserva-menu-item">
                <div class="reserva-menu-item-icon">${m.image ? `<img src="${m.image}" alt="${m.name}">` : '🍽️'}</div>
                <h4>${m.name}</h4>
                <span class="price">$${m.price.toLocaleString('es-CO')}</span>
                <input type="number" min="0" value="0" placeholder="0" onchange="updateReservationItem(${m.id}, this.value, '${m.name}', ${m.price})">
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

window.updateReservationItem = function(id, qty, name, price) {
    qty = parseInt(qty) || 0;
    if (qty > 0) selectedItems[id] = { name, price, qty, subtotal: qty * price };
    else delete selectedItems[id];
    updateReservationSummary();
};

function updateReservationSummary() {
    const items = Object.values(selectedItems);
    const summaryDiv = document.getElementById('summaryItems');
    const totalEl = document.getElementById('totalPrice');

    if (items.length > 0) {
        let total = 0;
        summaryDiv.innerHTML = items.map(item => {
            total += item.subtotal;
            return `<div class="summary-item"><span>${item.name} <small>(x${item.qty})</small></span><strong>$${item.subtotal.toLocaleString('es-CO')}</strong></div>`;
        }).join('');

        // SI ES DOMICILIO, SUMAR 1000
        if (currentOrderType === 'domicilio') {
            total += 1000;
        }

        totalEl.textContent = `$${total.toLocaleString('es-CO')}`;
    } else {
        summaryDiv.innerHTML = '<p class="empty-msg" style="text-align:center;color:#999;">Ningún plato seleccionado</p>';
        totalEl.textContent = '$0';
    }
}

// =========================================================
// 4. ENVÍO Y VALIDACIÓN (LÓGICA PRINCIPAL)
// =========================================================
function setupReservationForm() {
    const form = document.getElementById('reservationForm');
    if (form) form.addEventListener('submit', handleFormSubmit);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const items = Object.values(selectedItems);
    if (items.length === 0) return alert('🥘 Selecciona al menos un plato.');

    const name = document.getElementById('name').value;
    
    // Validación Teléfono Colombia
    let phone = document.getElementById('phone').value.trim();
    phone = phone.replace(/\D/g, ''); 
    if (!/^3\d{9}$/.test(phone)) {
        return alert('📱 El teléfono debe ser un celular válido (Ej: 3124322345).');
    }

    // Calculamos total
    let total = items.reduce((sum, item) => sum + item.subtotal, 0);
    if (currentOrderType === 'domicilio') total += 1000; // Empaque

    // ---- RAMA 1: DOMICILIO (SOLO WHATSAPP) ----
    if (currentOrderType === 'domicilio') {
        const address = document.getElementById('address').value;
        if (!address) return alert('Por favor escribe la dirección de entrega.');

        const orderData = { name, phone, address, items, total, type: 'domicilio' };
        showWhatsAppModal(orderData); // Mostrar modal directo, sin guardar en BD
        return;
    }

    // ---- RAMA 2: RESERVA (BASE DE DATOS + WHATSAPP) ----
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

// =========================================================
// 5. MODAL Y WHATSAPP (ÚNICO PARA AMBOS)
// =========================================================
function showWhatsAppModal(data) {
    const modal = document.getElementById('confirmationModal');
    const msg = document.getElementById('confirmationMessage');
    const title = document.getElementById('modalTitle');
    const subtitle = document.getElementById('modalSubtitle');

    let platosTexto = data.items.map(i => `- ${i.qty}x ${i.name}`).join('\n');
    let text = "";

    if (data.type === 'domicilio') {
        // --- MENSAJE DOMICILIO ---
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
        // --- MENSAJE RESERVA ---
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

    // Link Seguro
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
        // En domicilio no redirigimos forzosamente para que puedan pedir más si quieren
        selectedItems = {};
        updateReservationSummary();
        document.getElementById('reservationForm').reset();
    }
};
