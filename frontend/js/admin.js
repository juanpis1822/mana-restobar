const API_URL = '/api';

// --- AUTH HELPERS ---
// Función para incluir el token en las cabeceras automáticamente
function getHeaders() {
    const token = sessionStorage.getItem('adminToken');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// ==========================================
// 1. SISTEMA DE LOGIN Y SESIÓN
// ==========================================
async function checkPassword() {
    const passInput = document.getElementById('passInput');
    const password = passInput.value.trim();
    const btn = document.querySelector('.login-buttons .btn-primary');

    if (!password) return alert('Por favor ingresa la contraseña');

    btn.disabled = true; btn.textContent = 'Verificando...';

    try {
        const response = await fetch(API_URL + '/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: password })
        });

        const data = await response.json();

        if (response.ok) {
            // Guardamos el token temporalmente (se borra al cerrar navegador)
            sessionStorage.setItem('adminToken', data.token);
            showDashboard();
        } else {
            alert('🚫 ' + (data.error || 'Acceso denegado'));
            passInput.value = '';
            passInput.focus();
        }
    } catch (err) { 
        alert('Error de conexión con el servidor'); 
    } finally { 
        btn.disabled = false; btn.textContent = '🔓 Ingresar'; 
    }
}

function goToHome() {
    window.location.href = 'index.html';
}

function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    // Cargar datos iniciales
    loadMenuTable();
    loadReservationsTable();
    loadConfig();
}

async function logout() {
    if (confirm('¿Cerrar sesión?')) {
        try { await fetch(API_URL + '/admin/logout', { method: 'POST' }); } catch(e) {}
        sessionStorage.removeItem('adminToken');
        location.reload();
    }
}

// Verificar sesión al inicio y configurar Auto-Logout
document.addEventListener('DOMContentLoaded', () => {
    // Si hay token guardado, mostramos el panel directo
    if (sessionStorage.getItem('adminToken')) {
        showDashboard();
    } else {
        // Si no, aseguramos que el input de contraseña escuche el Enter
        const passInput = document.getElementById('passInput');
        if(passInput){
            passInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') checkPassword();
            });
        }
    }
    
    // Auto-logout por inactividad (10 mins)
    let timeout;
    function resetTimer() {
        clearTimeout(timeout);
        // 10 minutos * 60 seg * 1000 ms
        timeout = setTimeout(() => {
            if(sessionStorage.getItem('adminToken')) {
                alert('Sesión expirada por inactividad (10 min)');
                logout();
            }
        }, 10 * 60 * 1000); 
    }
    
    // Cualquier movimiento reinicia el contador
    document.onmousemove = resetTimer;
    document.onkeypress = resetTimer;
    resetTimer(); 
});

// ==========================================
// 2. NAVEGACIÓN (TABS)
// ==========================================
function switchTab(tab) {
    ['menu', 'add', 'reservations', 'control'].forEach(t => {
        document.getElementById(t + 'Tab').style.display = 'none';
        document.getElementById(t + 'TabBtn').classList.remove('active');
    });
    document.getElementById(tab + 'Tab').style.display = 'block';
    document.getElementById(tab + 'TabBtn').classList.add('active');

    // Recargar datos frescos al cambiar de pestaña
    if(tab === 'menu') loadMenuTable();
    if(tab === 'reservations') loadReservationsTable();
    if(tab === 'control') loadConfig();
}

// ==========================================
// 3. GESTIÓN DEL MENÚ (PLATOS)
// ==========================================
const convertToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

async function loadMenuTable() {
    try {
        const res = await fetch(API_URL + '/dishes');
        const data = await res.json();
        const tbody = document.getElementById('menuTableBody');
        
        if(!data.length) { 
            tbody.innerHTML='<tr><td colspan="4" style="text-align:center;padding:2rem;color:#666;">No hay platos registrados.</td></tr>'; 
            return; 
        }
        
        tbody.innerHTML = data.map(d => `
            <tr>
                <td>
                    <div style="display:flex;align-items:center;gap:10px">
                        ${d.image 
                            ? `<img src="${d.image}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;box-shadow:0 2px 4px rgba(0,0,0,0.1);">` 
                            : '<div style="width:40px;height:40px;background:#eee;border-radius:4px;display:flex;align-items:center;justify-content:center;">🍽️</div>'}
                        <b style="color:var(--primary);">${d.name}</b>
                    </div>
                </td>
                <td><span style="background:#FDF5E6;padding:4px 8px;border-radius:4px;font-size:0.85rem;font-weight:600;color:var(--secondary);">${d.category}</span></td>
                <td>$${d.price.toLocaleString('es-CO')}</td>
                <td><button onclick="deleteDish(${d.id})" class="btn btn-danger" style="font-size:0.8rem;padding:0.3rem 0.6rem;">🗑️</button></td>
            </tr>
        `).join('');
    } catch(err) { console.error(err); }
}

async function submitAddDish(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Guardando...';
    
    try {
        const file = document.getElementById('imageInput').files[0];
        const img = file ? await convertToBase64(file) : null;
        
        const res = await fetch(API_URL + '/dishes', {
            method: 'POST',
            headers: getHeaders(), // Enviamos Token
            body: JSON.stringify({
                name: document.getElementById('nameInput').value,
                category: document.getElementById('categoryInput').value,
                price: parseInt(document.getElementById('priceInput').value),
                description: document.getElementById('descInput').value,
                image: img
            })
        });
        
        if(res.ok) {
            alert('✅ Plato guardado correctamente');
            e.target.reset();
            switchTab('menu');
        } else {
            if(res.status === 403) { alert('⚠️ Sesión expirada'); logout(); }
            else alert('❌ Error al guardar el plato');
        }
    } catch(err) { alert('Error de conexión'); }
    
    btn.disabled = false; btn.textContent = '➕ Agregar Plato';
}

async function deleteDish(id) {
    if(!confirm('¿Estás seguro de eliminar este plato?')) return;
    
    try {
        const res = await fetch(API_URL + '/dishes/' + id, { method: 'DELETE', headers: getHeaders() });
        if(res.ok) loadMenuTable();
        else {
            if(res.status === 403) { alert('Sesión expirada'); logout(); }
            else alert('No se pudo eliminar');
        }
    } catch(e) { alert('Error de conexión'); }
}

// ==========================================
// 4. GESTIÓN DE RESERVAS
// ==========================================
async function loadReservationsTable() {
    try {
        const res = await fetch(API_URL + '/reservations', { headers: getHeaders() });
        if(res.status === 403) { logout(); return; }
        
        const data = await res.json();
        const tbody = document.getElementById('reservationsTableBody');
        
        if(!data.length) { 
            tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:2rem;color:#666;">No hay reservas pendientes.</td></tr>'; 
            return; 
        }
        
        tbody.innerHTML = data.map(r => `
            <tr>
                <td><strong>${r.name}</strong></td>
                <td>${r.phone}</td>
                <td>${r.date}</td>
                <td><span style="background:#e8f5e9;color:#2e7d32;padding:2px 6px;border-radius:4px;font-size:0.9rem;">${r.timeSlot}</span></td>
                <td>${r.guests}</td>
                <td>$${r.total.toLocaleString('es-CO')}</td>
                <td style="display:flex;gap:5px;">
                    <button onclick="showReservaDetails(${r.id})" class="btn btn-info" style="font-size:0.8rem;padding:0.3rem 0.6rem;">👁️</button>
                    <button onclick="deleteReserva(${r.id})" class="btn btn-danger" style="font-size:0.8rem;padding:0.3rem 0.6rem;">🗑️</button>
                </td>
            </tr>
        `).join('');
    } catch(err) { console.error(err); }
}

async function showReservaDetails(id) {
    try {
        const response = await fetch(API_URL + '/reservations/' + id, { headers: getHeaders() });
        const r = await response.json();
        
        const itemsHtml = r.items.map(i => `
            <li style="margin-bottom:5px;display:flex;justify-content:space-between;border-bottom:1px dashed #eee;padding-bottom:5px;">
                <span>${i.name} <small style="color:#666;">(x${i.qty})</small></span>
                <strong>$${i.subtotal.toLocaleString('es-CO')}</strong>
            </li>
        `).join('');
        
        document.getElementById('reservaDetails').innerHTML = `
            <div style="text-align:left;background:#f9f9f9;padding:1rem;border-radius:8px;">
                <p><strong>👤 Cliente:</strong> ${r.name}</p>
                <p><strong>📞 Teléfono:</strong> ${r.phone}</p>
                <p><strong>📅 Fecha:</strong> ${r.date} - ${r.timeSlot}</p>
                <p><strong>👥 Personas:</strong> ${r.guests}</p>
                <hr style="margin:1rem 0;border:0;border-top:1px solid #ddd;">
                <p style="margin-bottom:0.5rem;"><strong>🍽️ Pedido:</strong></p>
                <ul style="padding-left:0;list-style:none;margin:0;">${itemsHtml}</ul>
                <div style="margin-top:1rem;text-align:right;font-size:1.2rem;color:var(--primary);">
                    <strong>TOTAL: $${r.total.toLocaleString('es-CO')}</strong>
                </div>
            </div>
        `;
        document.getElementById('reservaModal').classList.add('active');
    } catch(e) { alert('Error cargando detalles'); }
}

function closeReservaModal() { document.getElementById('reservaModal').classList.remove('active'); }

async function deleteReserva(id) {
    if(!confirm('¿Eliminar esta reserva permanentemente?')) return;
    try {
        const res = await fetch(API_URL + '/reservations/' + id, { method: 'DELETE', headers: getHeaders() });
        if(res.ok) loadReservationsTable();
        else alert('Error al eliminar');
    } catch(e) { alert('Error de conexión'); }
}

// ==========================================
// 5. CONFIGURACIÓN Y SEGURIDAD
// ==========================================
async function loadConfig() {
    try {
        // La lectura de config es pública para que el frontend sepa los horarios
        const res = await fetch(API_URL + '/config');
        const data = await res.json();
        
        const minH = document.getElementById('minHoursInput');
        const maxC = document.getElementById('maxCapacityInput');
        
        if(minH) minH.value = data.minHours || 8;
        if(maxC) maxC.value = data.maxCapacity || 30;
        
        displayTimeSlots(data.timeSlots || []);
    } catch(err) { console.error(err); }
}

function displayTimeSlots(slots) {
    const container = document.getElementById('timeSlotsContainer');
    if(container) {
        container.innerHTML = slots.map((slot, idx) => `
            <div class="time-slot-item">
                <span>🕐 ${slot}</span>
                <button type="button" onclick="removeTimeSlot(${idx})" style="background:none;border:none;cursor:pointer;color:var(--danger);font-weight:bold;">❌</button>
            </div>
        `).join('');
    }
}

async function saveConfigValue(key, val) {
    try {
        const res = await fetch(API_URL + '/config/' + key, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ value: parseInt(val) })
        });
        if(res.ok) alert('✅ Configuración guardada');
        else alert('Error al guardar');
    } catch(e) { alert('Error de conexión'); }
}

function saveMinHours() { saveConfigValue('minHours', document.getElementById('minHoursInput').value); }
function saveMaxCapacity() { saveConfigValue('maxCapacity', document.getElementById('maxCapacityInput').value); }

async function addTimeSlot() {
    const input = document.getElementById('newTimeSlotInput');
    const val = input.value.trim();
    if(!val || !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(val)) return alert('⚠️ Formato inválido. Usa HH:MM-HH:MM');
    
    // Obtener actual, modificar y guardar
    const res = await fetch(API_URL + '/config');
    const conf = await res.json();
    const slots = conf.timeSlots || [];
    
    if(slots.includes(val)) return alert('Esa franja ya existe');
    slots.push(val); 
    slots.sort();
    
    await fetch(API_URL + '/config/timeSlots', { 
        method: 'PUT', 
        headers: getHeaders(), 
        body: JSON.stringify({value: slots}) 
    });
    
    input.value = '';
    loadConfig();
}

async function removeTimeSlot(idx) {
    if(!confirm('¿Borrar esta franja horaria?')) return;
    
    const res = await fetch(API_URL + '/config');
    const conf = await res.json();
    const slots = conf.timeSlots || [];
    slots.splice(idx, 1);
    
    await fetch(API_URL + '/config/timeSlots', { 
        method: 'PUT', 
        headers: getHeaders(), 
        body: JSON.stringify({value: slots}) 
    });
    
    loadConfig();
}

// --- CAMBIAR CONTRASEÑA ---
async function changeAdminPassword() {
    const cur = document.getElementById('currentAdminPassword').value.trim();
    const newP = document.getElementById('newAdminPassword').value.trim();
    
    if(!cur) return alert('⚠️ Ingresa tu contraseña actual para confirmar.');
    if(!newP || newP.length < 4) return alert('⚠️ La nueva contraseña debe tener al menos 4 caracteres.');
    
    if(confirm('¿Seguro que quieres cambiar la contraseña?')) {
        try {
            const res = await fetch(API_URL + '/admin/password', {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ currentPassword: cur, newPassword: newP })
            });
            
            const data = await res.json();
            
            if(res.ok) {
                alert('✅ Contraseña actualizada exitosamente.\nPor favor inicia sesión de nuevo.');
                logout();
            } else {
                alert('❌ ' + (data.error || 'Error al actualizar'));
                if(res.status === 401) { // Clave actual mal
                    document.getElementById('currentAdminPassword').value = '';
                    document.getElementById('currentAdminPassword').focus();
                }
            }
        } catch(e) { alert('Error de conexión'); }
    }
}
