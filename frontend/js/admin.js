const API_URL = '/api';

// ==========================================
// 1. SISTEMA DE LOGIN Y SESIÓN
// ==========================================
async function checkPassword() {
    const passInput = document.getElementById('passInput');
    const password = passInput.value.trim();
    const btn = document.querySelector('.login-buttons .btn-primary');

    if (!password) return alert('Por favor ingresa la contraseña');

    btn.disabled = true;
    btn.textContent = 'Verificando...';

    try {
        const response = await fetch(API_URL + '/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('adminLogged', 'true');
            showDashboard();
        } else {
            alert('🚫 ' + (data.error || 'Contraseña incorrecta'));
            passInput.value = '';
            passInput.focus();
        }
    } catch (err) {
        alert('Error de conexión con el servidor');
    } finally {
        btn.disabled = false;
        btn.textContent = '🔓 Ingresar';
    }
}

function goToHome() { window.location.href = 'index.html'; }

function logout() {
    if (confirm('¿Seguro que deseas cerrar sesión?')) {
        localStorage.removeItem('adminLogged');
        location.reload();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('adminLogged')) {
        showDashboard();
    }
    const passInput = document.getElementById('passInput');
    if(passInput){
        passInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkPassword();
        });
    }
});

function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    loadMenuTable();
    loadReservationsTable();
    loadConfig();
}

function switchTab(tab) {
    ['menu', 'add', 'reservations', 'control'].forEach(t => {
        document.getElementById(t + 'Tab').style.display = 'none';
        document.getElementById(t + 'TabBtn').classList.remove('active');
    });
    document.getElementById(tab + 'Tab').style.display = 'block';
    document.getElementById(tab + 'TabBtn').classList.add('active');

    if (tab === 'menu') loadMenuTable();
    if (tab === 'reservations') loadReservationsTable();
    if (tab === 'control') loadConfig();
}

// ==========================================
// 2. GESTIÓN DEL MENÚ
// ==========================================
const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

async function loadMenuTable() {
    try {
        const response = await fetch(API_URL + '/dishes');
        const dishes = await response.json();
        const tbody = document.getElementById('menuTableBody');

        if (dishes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #666;">No hay platos registrados.</td></tr>';
            return;
        }

        tbody.innerHTML = dishes.map(d => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        ${d.image 
                            ? `<img src="${d.image}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;">` 
                            : '<div style="width: 50px; height: 50px; background: #eee; border-radius: 6px; display: flex; align-items: center; justify-content: center;">🍽️</div>'}
                        <span style="font-weight: 600;">${d.name}</span>
                    </div>
                </td>
                <td><span style="background: #FDF5E6; padding: 4px 8px; border-radius: 4px; color: #8B6F47; font-weight: 600; font-size: 0.85rem;">${d.category}</span></td>
                <td>$${d.price.toLocaleString('es-CO')}</td>
                <td>
                    <button onclick="deleteDish(${d.id})" class="btn btn-danger" style="font-size: 0.9rem;">🗑️</button>
                </td>
            </tr>
        `).join('');
    } catch (err) { console.error(err); }
}

async function submitAddDish(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Guardando...';

    try {
        const imageInput = document.getElementById('imageInput');
        let imageBase64 = null;
        if (imageInput.files.length > 0) {
            imageBase64 = await convertToBase64(imageInput.files[0]);
        }

        const data = {
            name: document.getElementById('nameInput').value,
            category: document.getElementById('categoryInput').value,
            price: parseInt(document.getElementById('priceInput').value),
            description: document.getElementById('descInput').value,
            image: imageBase64
        };

        const response = await fetch(API_URL + '/dishes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('✅ Plato agregado');
            document.getElementById('addDishForm').reset();
            switchTab('menu');
        } else {
            alert('Error al guardar');
        }
    } catch (err) { alert('Error: ' + err.message); }
    finally { btn.disabled = false; btn.textContent = '➕ Agregar Plato'; }
}

async function deleteDish(id) {
    if (confirm('¿Eliminar este plato?')) {
        await fetch(API_URL + '/dishes/' + id, { method: 'DELETE' });
        loadMenuTable();
    }
}

// ==========================================
// 3. GESTIÓN DE RESERVAS
// ==========================================
async function loadReservationsTable() {
    try {
        const response = await fetch(API_URL + '/reservations');
        const reservations = await response.json();
        const tbody = document.getElementById('reservationsTableBody');

        if (reservations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No hay reservas.</td></tr>';
            return;
        }

        tbody.innerHTML = reservations.map(r => `
            <tr>
                <td><strong>${r.name}</strong></td>
                <td>${r.phone}</td>
                <td>${r.date}</td>
                <td><span style="background: #e8f5e9; color: #2e7d32; padding: 2px 6px; border-radius: 4px;">${r.timeSlot}</span></td>
                <td>${r.guests}</td>
                <td>$${r.total.toLocaleString('es-CO')}</td>
                <td>
                    <button onclick="showReservaDetails(${r.id})" class="btn btn-info">👁️</button>
                    <button onclick="deleteReserva(${r.id})" class="btn btn-danger">🗑️</button>
                </td>
            </tr>
        `).join('');
    } catch (err) { console.error(err); }
}

async function showReservaDetails(id) {
    try {
        const response = await fetch(API_URL + '/reservations/' + id);
        const r = await response.json();
        const itemsHtml = r.items.map(i => `<li>${i.name} (x${i.qty}) - $${i.subtotal.toLocaleString('es-CO')}</li>`).join('');
        document.getElementById('reservaDetails').innerHTML = `
            <p><strong>${r.name}</strong> (${r.phone})</p>
            <p>${r.date} - ${r.timeSlot}</p>
            <hr><ul style="text-align:left">${itemsHtml}</ul>
            <p><strong>Total: $${r.total.toLocaleString('es-CO')}</strong></p>
        `;
        document.getElementById('reservaModal').classList.add('active');
    } catch(e) {}
}

function closeReservaModal() { document.getElementById('reservaModal').classList.remove('active'); }
async function deleteReserva(id) { if(confirm('¿Borrar?')) { await fetch(API_URL+'/reservations/'+id, {method:'DELETE'}); loadReservationsTable(); }}

// ==========================================
// 4. CONFIGURACIÓN Y SEGURIDAD
// ==========================================
async function loadConfig() {
    try {
        const res = await fetch(API_URL + '/config');
        const config = await res.json();
        document.getElementById('minHoursInput').value = config.minHours || 8;
        document.getElementById('maxCapacityInput').value = config.maxCapacity || 30;
        displayTimeSlots(config.timeSlots || []);
    } catch (err) {}
}

function displayTimeSlots(slots) {
    const container = document.getElementById('timeSlotsContainer');
    if(container) container.innerHTML = slots.map((slot, idx) => `
        <div class="time-slot-item">
            <span>🕐 ${slot}</span>
            <button type="button" onclick="removeTimeSlot(${idx})" style="background:none;border:none;cursor:pointer;">❌</button>
        </div>
    `).join('');
}

async function saveMinHours() {
    const val = document.getElementById('minHoursInput').value;
    await fetch(API_URL + '/config/minHours', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({value: parseInt(val)}) });
    alert('Guardado');
}

async function saveMaxCapacity() {
    const val = document.getElementById('maxCapacityInput').value;
    await fetch(API_URL + '/config/maxCapacity', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({value: parseInt(val)}) });
    alert('Guardado');
}

async function addTimeSlot() {
    const val = document.getElementById('newTimeSlotInput').value.trim();
    if(!val) return;
    const res = await fetch(API_URL + '/config');
    const conf = await res.json();
    const slots = conf.timeSlots || [];
    slots.push(val); slots.sort();
    await fetch(API_URL + '/config/timeSlots', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({value: slots}) });
    document.getElementById('newTimeSlotInput').value = '';
    loadConfig();
}

async function removeTimeSlot(idx) {
    if(!confirm('¿Borrar?')) return;
    const res = await fetch(API_URL + '/config');
    const conf = await res.json();
    const slots = conf.timeSlots || [];
    slots.splice(idx, 1);
    await fetch(API_URL + '/config/timeSlots', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({value: slots}) });
    loadConfig();
}

// --- CAMBIAR CONTRASEÑA CON VERIFICACIÓN ---
async function changeAdminPassword() {
    const currentPassInput = document.getElementById('currentAdminPassword');
    const newPassInput = document.getElementById('newAdminPassword');
    const currentPass = currentPassInput.value.trim();
    const newPass = newPassInput.value.trim();

    if (!currentPass) return alert('⚠️ Por favor ingresa tu contraseña actual.');
    if (!newPass) return alert('⚠️ Por favor ingresa la nueva contraseña.');
    if (newPass.length < 4) return alert('La contraseña es muy corta.');

    if (confirm('¿Cambiar contraseña?')) {
        try {
            const response = await fetch(API_URL + '/admin/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass })
            });

            const data = await response.json();

            if (response.ok) {
                alert('✅ Contraseña actualizada exitosamente. \nInicia sesión nuevamente.');
                logout();
            } else {
                alert('❌ ' + (data.error || 'Error al actualizar'));
                if(response.status === 401) { // Clave actual incorrecta
                    currentPassInput.value = '';
                    currentPassInput.focus();
                }
            }
        } catch (err) { alert('Error de conexión'); }
    }
}