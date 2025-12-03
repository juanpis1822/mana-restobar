const API_URL = '/api';
let selectedItems = {};
let allDishes = [];
let allTimeSlots = [];

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar componentes
    renderMenuForReservation();
    setupReservationForm();
    loadReservationConfig();
});

// =========================================================
// 1. CONFIGURACIÓN Y HORARIOS
// =========================================================
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
    } catch (err) {
        console.error('Error cargando configuración:', err);
    }
}

function showMinHoursWarning(minHours) {
    const now = new Date();
    const nextAvailable = new Date(now.getTime() + minHours * 60 * 60 * 1000);
    const warningDiv = document.getElementById('minHoursWarning');
    const warningText = document.getElementById('warningText');

    if (warningDiv && warningText) {
        warningText.innerHTML = `
            Debes reservar con ${minHours} horas de anticipación.<br>
            <strong>Hora actual:</strong> ${now.toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit'})}<br>
            <strong>Disponible desde:</strong> ${nextAvailable.toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit'})}
        `;
        warningDiv.style.display = 'block';
    }
}

function renderTimeSlotButtons() {
    const container = document.getElementById('timeSlotsContainer');
    if (!container) return;

    container.innerHTML = allTimeSlots.map(slot => `
        <button type="button" class="time-slot-btn" onclick="handleTimeSlotClick('${slot}', this)">
            🕐 ${slot}
        </button>
    `).join('');
}

// =========================================================
// 2. INTERACCIÓN CON HORARIOS
// =========================================================
window.handleTimeSlotClick = function(slot, btnElement) {
    const dateStr = document.getElementById('reservationDate').value;
    
    if (!dateStr) {
        alert('📅 Por favor selecciona una fecha en el calendario primero.');
        return;
    }

    // Estilos visuales (quitar selección anterior)
    document.querySelectorAll('.time-slot-btn').forEach(btn => btn.classList.remove('selected'));
    btnElement.classList.add('selected');

    // Guardar valor
    document.getElementById('selectedTimeSlot').value = slot;

    // Verificar cupo disponible en el servidor
    checkSlotCapacity(dateStr, slot);
};

async function checkSlotCapacity(dateStr, timeSlot) {
    try {
        const response = await fetch(API_URL + '/reservations');
        const reservations = await response.json();

        const maxCapacity = parseInt(localStorage.getItem('maxCapacity') || 30);
        
        // Filtrar reservas para ese día y hora exacta
        const slotReservations = reservations.filter(r => r.date === dateStr && r.timeSlot === timeSlot);
        const totalGuests = slotReservations.reduce((sum, r) => sum + r.guests, 0);
        const available = maxCapacity - totalGuests;

        const warningDiv = document.getElementById('capacityWarning');
        if (warningDiv) {
            warningDiv.style.backgroundColor = ''; // Reset color
            
            if (available < 5 && available > 0) {
                warningDiv.innerHTML = `⚠️ ¡Quedan pocos cupos! Solo ${available} lugares disponibles.`;
                warningDiv.style.display = 'block';
            } else if (available <= 0) {
                warningDiv.innerHTML = `⛔ Franja agotada. Por favor selecciona otra hora.`;
                warningDiv.style.display = 'block';
                warningDiv.style.backgroundColor = '#f8d7da';
            } else {
                warningDiv.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('Error verificando capacidad:', err);
    }
}

// =========================================================
// 3. MENÚ Y SELECCIÓN DE PLATOS (¡ACTUALIZADO!)
// =========================================================
async function renderMenuForReservation() {
    try {
        const response = await fetch(API_URL + '/dishes');
        allDishes = await response.json();
        const grid = document.getElementById('reservaMenuGrid');

        if (!grid) return;

        if (allDishes.length === 0) {
            grid.innerHTML = '<p style="text-align: center; color: #999; grid-column: 1/-1;">No hay platos disponibles para reservar.</p>';
            return;
        }

        // AQUÍ ESTÁ LA ACTUALIZACIÓN: Usamos las clases del CSS nuevo
        grid.innerHTML = allDishes.map(m => `
            <div class="reserva-menu-item">
                <div class="reserva-menu-item-icon">
                    ${m.image 
                        ? `<img src="${m.image}" alt="${m.name}">` 
                        : '🍽️'}
                </div>
                
                <h4>${m.name}</h4>
                <span class="price">$${m.price.toLocaleString('es-CO')}</span>
                
                <input type="number" min="0" value="0" placeholder="0" 
                       onchange="updateReservationItem(${m.id}, this.value, '${m.name}', ${m.price})">
            </div>
        `).join('');
    } catch (err) {
        console.error('Error cargando menú:', err);
    }
}

window.updateReservationItem = function(id, qty, name, price) {
    qty = parseInt(qty) || 0;
    if (qty > 0) {
        selectedItems[id] = { name, price, qty, subtotal: qty * price };
    } else {
        delete selectedItems[id];
    }
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
            return `
                <div class="summary-item">
                    <span>${item.name} <small>(x${item.qty})</small></span>
                    <strong>$${item.subtotal.toLocaleString('es-CO')}</strong>
                </div>`;
        }).join('');
        totalEl.textContent = `$${total.toLocaleString('es-CO')}`;
    } else {
        summaryDiv.innerHTML = '<p class="empty-msg" style="text-align: center; color: #999;">Ningún plato seleccionado</p>';
        totalEl.textContent = '$0';
    }
}

// =========================================================
// 4. ENVÍO DEL FORMULARIO Y VALIDACIONES
// =========================================================
function setupReservationForm() {
    const form = document.getElementById('reservationForm');
    if (form) form.addEventListener('submit', handleReservationSubmit);
}

async function handleReservationSubmit(e) {
    e.preventDefault();

    // Validaciones
    const items = Object.values(selectedItems);
    if (items.length === 0) return alert('🥘 Por favor selecciona al menos un plato o bebida.');

    const dateStr = document.getElementById('reservationDate').value;
    const timeSlot = document.getElementById('selectedTimeSlot').value;
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const guests = parseInt(document.getElementById('guests').value);

    if (!dateStr) return alert('📅 Por favor selecciona una fecha en el calendario.');
    if (!timeSlot) return alert('🕐 Por favor selecciona una franja horaria.');

    // Validación de Tiempo Mínimo (Lógica de servidor en cliente)
    const minHours = parseInt(localStorage.getItem('minReservationHours') || 8);
    const now = new Date();
    const [hours, minutes] = timeSlot.split('-')[0].split(':'); 
    const reservationDate = new Date(`${dateStr}T${hours}:${minutes}:00`);
    
    // Diferencia en horas
    const diffHours = (reservationDate - now) / (1000 * 60 * 60);

    if (diffHours < minHours) {
        return alert(`⏰ Lo sentimos. Para esa hora, debes reservar con al menos ${minHours} horas de anticipación.`);
    }

    // Datos Finales
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const reservationData = {
        name, phone, date: dateStr, timeSlot, guests, items, total
    };

    // Enviar
    try {
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Procesando...';

        const response = await fetch(API_URL + '/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reservationData)
        });

        const result = await response.json();

        if (response.ok) {
            showSuccessModal(reservationData);
            document.getElementById('reservationForm').reset();
            selectedItems = {};
            updateReservationSummary();
        } else {
            alert('❌ ' + (result.error || 'No se pudo crear la reserva.'));
        }
    } catch (err) {
        console.error(err);
        alert('Error de conexión al intentar reservar.');
    } finally {
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = false;
        btn.textContent = 'Confirmar Reserva';
    }
}

// =========================================================
// 5. MODAL DE CONFIRMACIÓN
// =========================================================
function showSuccessModal(res) {
    const modal = document.getElementById('confirmationModal');
    const msg = document.getElementById('confirmationMessage');
    
    msg.innerHTML = `
        <div style="text-align: left; margin-top: 1rem;">
            <p><strong>Titular:</strong> ${res.name}</p>
            <p><strong>Fecha:</strong> ${res.date}</p>
            <p><strong>Hora:</strong> ${res.timeSlot}</p>
            <p><strong>Mesa para:</strong> ${res.guests} personas</p>
            <p style="font-size: 1.2rem; color: var(--primary); margin-top: 10px;">
                <strong>Total estimado: $${res.total.toLocaleString('es-CO')}</strong>
            </p>
        </div>
    `;
    modal.style.display = 'flex';
}

window.closeModal = function() {
    document.getElementById('confirmationModal').style.display = 'none';
    window.location.href = 'index.html';
};