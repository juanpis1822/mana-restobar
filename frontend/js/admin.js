const API_URL = '/api';

function getHeaders() {
    const token = sessionStorage.getItem('adminToken');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

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
            sessionStorage.setItem('adminToken', data.token);
            showDashboard();
        } else {
            alert('🚫 ' + (data.error || 'Acceso denegado'));
            passInput.value = '';
            passInput.focus();
        }
    } catch (err) { alert('Error de conexión'); } 
    finally { btn.disabled = false; btn.textContent = '🔓 Ingresar'; }
}

function goToHome() { window.location.href = 'index.html'; }

function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
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

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('adminToken')) showDashboard();
    else {
        const passInput = document.getElementById('passInput');
        if(passInput) passInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') checkPassword(); });
    }
    
    let timeout;
    function resetTimer() {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            if(sessionStorage.getItem('adminToken')) {
                alert('Sesión expirada');
                logout();
            }
        }, 600000); 
    }
    document.onmousemove = resetTimer;
    document.onkeypress = resetTimer;
    resetTimer(); 
});

function switchTab(tab) {
    ['menu', 'add', 'reservations', 'control'].forEach(t => {
        document.getElementById(t + 'Tab').style.display = 'none';
        document.getElementById(t + 'TabBtn').classList.remove('active');
    });
    document.getElementById(tab + 'Tab').style.display = 'block';
    document.getElementById(tab + 'TabBtn').classList.add('active');

    if(tab === 'menu') loadMenuTable();
    if(tab !== 'add') cancelEdit();
}

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
            tbody.innerHTML='<tr><td colspan="4" style="text-align:center;padding:2rem;">No hay platos.</td></tr>'; 
            return; 
        }
        
        tbody.innerHTML = data.map(d => `
            <tr>
                <td>
                    <div style="display:flex;align-items:center;gap:10px">
                        ${d.image 
                            ? `<img src="${d.image}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;">` 
                            : '<div style="width:40px;height:40px;background:#eee;border-radius:4px;display:flex;align-items:center;justify-content:center;">🍽️</div>'}
                        <b>${d.name}</b>
                    </div>
                </td>
                <td><span style="background:#FDF5E6;padding:4px;border-radius:4px;font-size:0.8rem;color:var(--secondary);">${d.category}</span></td>
                <td>$${d.price.toLocaleString('es-CO')}</td>
                <td>
                    <button onclick="editDish(${d.id})" class="btn btn-info" style="font-size:0.8rem;padding:0.3rem 0.6rem;">✏️</button>
                    <button onclick="deleteDish(${d.id})" class="btn btn-danger" style="font-size:0.8rem;padding:0.3rem 0.6rem;">🗑️</button>
                </td>
            </tr>
        `).join('');
    } catch(err) { console.error(err); }
}

async function editDish(id) {
    try {
        const res = await fetch(API_URL + '/dishes/' + id);
        const dish = await res.json();

        document.getElementById('editDishId').value = dish.id;
        document.getElementById('nameInput').value = dish.name;
        document.getElementById('categoryInput').value = dish.category;
        document.getElementById('priceInput').value = dish.price;
        document.getElementById('descInput').value = dish.description;

        document.getElementById('submitBtn').textContent = '🔄 Actualizar Plato';
        document.getElementById('imageHint').style.display = 'block';
        document.getElementById('cancelEditBtn').style.display = 'inline-block';

        switchTab('add');
    } catch(err) { alert('Error al cargar plato'); }
}

function cancelEdit() {
    document.getElementById('addDishForm').reset();
    document.getElementById('editDishId').value = '';
    document.getElementById('submitBtn').textContent = '💾 Guardar Plato';
    document.getElementById('imageHint').style.display = 'none';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

async function submitAddDish(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.textContent = 'Procesando...';
    
    try {
        const id = document.getElementById('editDishId').value;
        const file = document.getElementById('imageInput').files[0];
        const img = file ? await convertToBase64(file) : null;
        
        const payload = {
            name: document.getElementById('nameInput').value,
            category: document.getElementById('categoryInput').value,
            price: parseInt(document.getElementById('priceInput').value),
            description: document.getElementById('descInput').value,
            image: img
        };

        let response;
        if (id) {
            response = await fetch(API_URL + '/dishes/' + id, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch(API_URL + '/dishes', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
        }
        
        if(response.ok) {
            alert(id ? '✅ Plato actualizado' : '✅ Plato creado');
            cancelEdit();
            switchTab('menu');
        } else {
            alert('❌ Error al guardar');
        }
    } catch(err) { alert('Error de conexión'); }
    
    btn.disabled = false;
    btn.textContent = document.getElementById('editDishId').value ? '🔄 Actualizar Plato' : '💾 Guardar Plato';
}

async function deleteDish(id) {
    if(!confirm('¿Eliminar este plato?')) return;
    try {
        const res = await fetch(API_URL + '/dishes/' + id, { method: 'DELETE', headers: getHeaders() });
        if(res.ok) loadMenuTable();
        else alert('No se pudo eliminar');
    } catch(e) { alert('Error de conexión'); }
}

async function loadReservationsTable() {
    try {
        const res = await fetch(API_URL + '/reservations', { headers: getHeaders() });
        if(res.status === 403) { logout(); return; }
        const data = await res.json();
        const tbody = document.getElementById('reservationsTableBody');
        
        if(!data.length) { 
            tbody.innerHTML='<tr><td colspan="7" style="text-align:center;">Sin reservas.</td></tr>'; 
            return; 
        }
        
        tbody.innerHTML = data.map(r => `
            <tr>
                <td>${r.name}</td>
                <td>${r.phone}</td>
                <td>${r.date}</td>
                <td><span style="background:#e8f5e9;color:#2e7d32;padding:2px 6px;border-radius:4px;">${r.timeSlot}</span></td>
                <td>${r.guests}</td>
                <td>$${r.total.toLocaleString('es-CO')}</td>
                <td>
                    <button onclick="showReservaDetails(${r.id})" class="btn btn-info" style="font-size:0.8rem;">👁️</button>
                    <button onclick="deleteReserva(${r.id})" class="btn btn-danger" style="font-size:0.8rem;">🗑️</button>
                </td>
            </tr>
        `).join('');
    } catch(err) { console.error(err); }
}

async function showReservaDetails(id) {
    try {
        const response = await fetch(API_URL + '/reservations/' + id, { headers: getHeaders() });
        const r = await response.json();
        const itemsHtml = r.items.map(i => `<li>${i.name} (x${i.qty}) - $${i.subtotal.toLocaleString('es-CO')}</li>`).join('');
        document.getElementById('reservaDetails').innerHTML = `
            <p><strong>${r.name}</strong> (${r.phone})</p>
            <p>${r.date} - ${r.timeSlot} (${r.guests} pers.)</p>
            <p style="background: #f0f0f0; padding: 5px;">${r.address || 'Mesa en restaurante'}</p>
            <hr><ul>${itemsHtml}</ul>
            <p style="text-align:right"><strong>Total: $${r.total.toLocaleString('es-CO')}</strong></p>
        `;
        document.getElementById('reservaModal').classList.add('active');
    } catch(e) {}
}

function closeReservaModal() { document.getElementById('reservaModal').classList.remove('active'); }

async function deleteReserva(id) {
    if(!confirm('¿Eliminar reserva?')) return;
    await fetch(API_URL + '/reservations/' + id, { method: 'DELETE', headers: getHeaders() });
    loadReservationsTable();
}

async function loadConfig() {
    try {
        const res = await fetch(API_URL + '/config');
        const data = await res.json();
        if(document.getElementById('minHoursInput')) {
            document.getElementById('minHoursInput').value = data.minHours || 8;
            document.getElementById('maxCapacityInput').value = data.maxCapacity || 30;
        }
        
        // --- MOSTRAR IMAGEN DEL DÍA SI EXISTE ---
        if (data.dailyMenuImage && document.getElementById('currentDailyImage')) {
            const img = document.getElementById('currentDailyImage');
            img.src = data.dailyMenuImage;
            img.style.display = 'block';
        }

        displayTimeSlots(data.timeSlots || []);
    } catch(err) {}
}

// --- NUEVA FUNCIÓN: GUARDAR IMAGEN DEL DÍA ---
async function saveDailyMenuImage() {
    const fileInput = document.getElementById('dailyMenuInput');
    if (!fileInput.files || !fileInput.files[0]) return alert('Selecciona una imagen primero');

    const btn = document.querySelector('button[onclick="saveDailyMenuImage()"]');
    btn.disabled = true; btn.textContent = 'Subiendo...';

    try {
        const imgBase64 = await convertToBase64(fileInput.files[0]);
        // Usamos una ruta especial en config para esto
        const res = await fetch(API_URL + '/config/dailyMenuImage', {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ value: imgBase64 })
        });

        if (res.ok) {
            alert('✅ Imagen del día actualizada');
            loadConfig(); 
        } else {
            alert('Error al guardar');
        }
    } catch(e) { alert('Error de conexión'); }
    
    btn.disabled = false; btn.textContent = '💾 Actualizar Imagen del Día';
}

function displayTimeSlots(slots) {
    const container = document.getElementById('timeSlotsContainer');
    if(container) container.innerHTML = slots.map((slot, idx) => `
        <div class="time-slot-item"><span>🕐 ${slot}</span><button onclick="removeTimeSlot(${idx})" style="color:red;border:none;background:none;cursor:pointer;">❌</button></div>
    `).join('');
}

async function saveConfigValue(key, val) {
    await fetch(API_URL + '/config/' + key, {
        method: 'PUT', headers: getHeaders(),
        body: JSON.stringify({ value: parseInt(val) })
    });
    alert('Guardado');
}

function saveMinHours() { saveConfigValue('minHours', document.getElementById('minHoursInput').value); }
function saveMaxCapacity() { saveConfigValue('maxCapacity', document.getElementById('maxCapacityInput').value); }

async function addTimeSlot() {
    const val = document.getElementById('newTimeSlotInput').value.trim();
    if(!val) return;
    const res = await fetch(API_URL + '/config');
    const conf = await res.json();
    const slots = conf.timeSlots || [];
    slots.push(val); slots.sort();
    await fetch(API_URL + '/config/timeSlots', { method: 'PUT', headers: getHeaders(), body: JSON.stringify({value: slots}) });
    document.getElementById('newTimeSlotInput').value = '';
    loadConfig();
}

async function removeTimeSlot(idx) {
    if(!confirm('¿Borrar?')) return;
    const res = await fetch(API_URL + '/config');
    const conf = await res.json();
    const slots = conf.timeSlots || [];
    slots.splice(idx, 1);
    await fetch(API_URL + '/config/timeSlots', { method: 'PUT', headers: getHeaders(), body: JSON.stringify({value: slots}) });
    loadConfig();
}

async function changeAdminPassword() {
    const cur = document.getElementById('currentAdminPassword').value;
    const newP = document.getElementById('newAdminPassword').value;
    if(!cur || !newP) return alert('Completa los campos');
    const res = await fetch(API_URL + '/admin/password', {
        method: 'PUT', headers: getHeaders(),
        body: JSON.stringify({ currentPassword: cur, newPassword: newP })
    });
    const data = await res.json();
    if(res.ok) { alert('✅ Cambiada. Inicia sesión.'); logout(); }
    else alert('❌ ' + data.error);
}
