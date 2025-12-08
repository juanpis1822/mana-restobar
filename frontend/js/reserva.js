const API_URL = '/api';
let selectedItems = {};
let allDishes = [];
let allTimeSlots = [];

document.addEventListener('DOMContentLoaded', () => {
    renderMenuForReservation();
    setupReservationForm();
    loadReservationConfig();
});

// --- 1. CONFIGURACIÓN ---
async function loadReservationConfig() {
    try {
        const response = await fetch(API_URL + '/config');
        const config = await response.json();
        const minHours = config.minHours || 8;
        const maxCapacity = config.maxCapacity || 30;
        allTimeSlots = config.timeSlots || ["12:00-13:00", "13:00-14:00", "18:00-19:00", "19:00-20:00"];

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
        document.getElementById('minHoursWarning').style.display = 'block';
    }
}

function renderTimeSlotButtons() {
    const container = document.getElementById('timeSlotsContainer');
    if (!container) return;
    container.innerHTML = allTimeSlots.map(slot => `
        <button type="button" class="time-slot-btn" onclick="handleTimeSlotClick('${slot}', this)">🕐 ${slot}</button>
    `).join('');
}

// --- 2. HORARIOS ---
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

// --- 3. MENÚ ---
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
        totalEl.textContent = `$${total.toLocaleString('es-CO')}`;
    } else {
        summaryDiv.innerHTML = '<p class="empty-msg" style="text-align:center;color:#999;">Ningún plato seleccionado</p>';
        totalEl.textContent = '$0';
    }
}

// --- 4. ENVÍO ---
function setupReservationForm() {
    const form = document.getElementById('reservationForm');
    if (form) form.addEventListener('submit', handleReservationSubmit);
}

async function handleReservationSubmit(e) {
    e.preventDefault();
    const items = Object.values(selectedItems);
    if (items.length === 0) return alert('🥘 Selecciona al menos un plato.');

    const dateStr = document.getElementById('reservationDate').value;
    const timeSlot = document.getElementById('selectedTimeSlot').value;
    if (!dateStr || !timeSlot) return alert('📅 Completa fecha y hora.');

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const data = {
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        date: dateStr, timeSlot,
        guests: parseInt(document.getElementById('guests').value),
        items, total
    };

    try {
        const res = await fetch(API_URL + '/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showSuccessModal(data);
            document.getElementById('reservationForm').reset();
            selectedItems = {};
            updateReservationSummary();
        } else {
            alert('Error al crear reserva en el sistema.');
        }
    } catch (err) { alert('Error de conexión.'); }
}

// --- 5. WHATSAPP SEGURO ---
function showSuccessModal(res) {
    const modal = document.getElementById('confirmationModal');
    const msg = document.getElementById('confirmationMessage');
    
    // Lista de platos limpia
    let platosTexto = res.items.map(i => `- ${i.qty}x ${i.name}`).join('\n');

    // Mensaje de texto plano para evitar errores de codificación
    const text = `Hola Mana Restobar! Quiero confirmar mi reserva:

👤 Nombre: ${res.name}
📅 Fecha: ${res.date}
⏰ Hora: ${res.timeSlot}
👥 Personas: ${res.guests}

🍽️ Pedido:
${platosTexto}

💰 Total Aprox: $${res.total.toLocaleString('es-CO')}

Quedo atento a su confirmacion!`;

    // Codificación segura para URL
    const whatsappLink = `https://api.whatsapp.com/send?phone=573143258525&text=${encodeURIComponent(text)}`;

    msg.innerHTML = `
        <div style="text-align:left;margin-top:1rem;">
            <p><strong>¡Reserva Guardada! ✅</strong></p>
            <p>Envía los detalles por WhatsApp para confirmar.</p>
            <div style="background:#f9f9f9;padding:10px;border-radius:8px;margin:10px 0;font-size:0.9rem;">
                ${res.date} - ${res.timeSlot}<br>
                ${res.guests} personas • $${res.total.toLocaleString('es-CO')}
            </div>
            <a href="${whatsappLink}" target="_blank" class="btn" style="background-color:#25D366;color:white;display:block;text-align:center;text-decoration:none;margin-top:15px;font-weight:bold;border:none;">
                <i class="fa-brands fa-whatsapp"></i> Enviar a WhatsApp
            </a>
        </div>
    `;
    modal.style.display = 'flex';
}

window.closeModal = function() {
    document.getElementById('confirmationModal').style.display = 'none';
    window.location.href = 'index.html';
};
