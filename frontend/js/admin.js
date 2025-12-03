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
// 1. SISTEMA DE LOGIN
// ==========================================
async function checkPassword() {
    const passInput = document.getElementById('passInput');
    const password = passInput.value.trim();
    const btn = document.querySelector('.login-buttons .btn-primary');

    if (!password) return alert('Ingresa la contraseña');

    btn.disabled = true; btn.textContent = 'Verificando...';

    try {
        const response = await fetch(API_URL + '/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: password })
        });

        const data = await response.json();

        if (response.ok) {
            // GUARDA EL TOKEN EN SESSIONSTORAGE (Se borra al cerrar navegador)
            sessionStorage.setItem('adminToken', data.token);
            showDashboard();
        } else {
            alert('🚫 ' + (data.error || 'Acceso denegado'));
            passInput.value = '';
        }
    } catch (err) { alert('Error de conexión'); }
    finally { btn.disabled = false; btn.textContent = '🔓 Ingresar'; }
}

function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    loadMenuTable();
    loadReservationsTable();
    loadConfig();
}

async function logout() {
    if (confirm('¿Cerrar sesión?')) {
        try {
            await fetch(API_URL + '/admin/logout', { method: 'POST' });
        } catch(e) {}
        
        sessionStorage.removeItem('adminToken'); // BORRAR TOKEN
        location.reload();
    }
}

// Verificar sesión al inicio
document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('adminToken')) {
        showDashboard();
    }
    
    // Auto-logout por inactividad (10 mins)
    let timeout;
    function resetTimer() {
        clearTimeout(timeout);
        // 10 minutos * 60 segundos * 1000 milisegundos
        timeout = setTimeout(() => {
            if(sessionStorage.getItem('adminToken')) {
                alert('Sesión expirada por inactividad (10 min)');
                logout();
            }
        }, 10 * 60 * 1000); 
    }
    
    // Reiniciar contador si el usuario mueve el mouse o escribe
    document.onmousemove = resetTimer;
    document.onkeypress = resetTimer;
    resetTimer(); // Iniciar al cargar
});

// ==========================================
// 2. FUNCIONES PROTEGIDAS (USAN TOKEN)
// ==========================================

// ... (Tabs y Helpers de Imagen) ...
function switchTab(tab) {
    ['menu', 'add', 'reservations', 'control'].forEach(t => {
        document.getElementById(t + 'Tab').style.display = 'none';
        document.getElementById(t + 'TabBtn').classList.remove('active');
    });
    document.getElementById(tab + 'Tab').style.display = 'block';
    document.getElementById(tab + 'TabBtn').classList.add('active');
    if(tab==='menu') loadMenuTable();
    if(tab==='reservations') loadReservationsTable();
    if(tab==='control') loadConfig();
}

const convertToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// MENÚ
async function loadMenuTable() {
    // Menú es público, no necesita token para leerse
    const res = await fetch(API_URL + '/dishes');
    const data = await res.json();
    const tbody = document.getElementById('menuTableBody');
    if(!data.length) { tbody.innerHTML='<tr><td colspan="4" style="text-align:center;padding:2rem;">Vacío</td></tr>'; return; }
    tbody.innerHTML = data.map(d => `
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    ${d.image ? `<img src="${d.image}" style="width:40px;height:40px;border-radius:4px;object-fit:cover">` : '🍽️'}
                    <b>${d.name}</b>
                </div>
            </td>
            <td>${d.category}</td>
            <td>$${d.price}</td>
            <td><button onclick="deleteDish(${d.id})" class="btn btn-danger btn-sm">🗑️</button></td>
        </tr>
    `).join('');
}

async function submitAddDish(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled=true;
    
    try {
        const file = document.getElementById('imageInput').files[0];
        const img = file ? await convertToBase64(file) : null;
        
        const res = await fetch(API_URL + '/dishes', {
            method: 'POST',
            headers: getHeaders(), // ENVÍA EL TOKEN
            body: JSON.stringify({
                name: document.getElementById('nameInput').value,
                category: document.getElementById('categoryInput').value,
                price: document.getElementById('priceInput').value,
                description: document.getElementById('descInput').value,
                image: img
            })
        });
        
        if(res.ok) {
            alert('✅ Plato guardado');
            e.target.reset();
            switchTab('menu');
        } else {
            if(res.status === 403) { alert('Sesión expirada'); logout(); }
            else alert('Error al guardar');
        }
    } catch(err) { alert('Error'); }
    btn.disabled=false;
}

async function deleteDish(id) {
    if(!confirm('¿Borrar?')) return;
    const res = await fetch(API_URL + '/dishes/' + id, { method: 'DELETE', headers: getHeaders() });
    if(res.ok) loadMenuTable();
    else alert('Error o no autorizado');
}

// RESERVAS
async function loadReservationsTable() {
    const res = await fetch(API_URL + '/reservations', { headers: getHeaders() }); // Privado
    if(res.status === 403) { logout(); return; }
    const data = await res.json();
    const tbody = document.getElementById('reservationsTableBody');
    
    if(!data.length) { tbody.innerHTML='<tr><td colspan="7" style="text-align:center">Sin reservas</td></tr>'; return; }
    
    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${r.name}</td>
            <td>${r.phone}</td>
            <td>${r.date}</td>
            <td>${r.timeSlot}</td>
            <td>${r.guests}</td>
            <td>$${r.total}</td>
            <td>
                <button onclick="deleteReserva(${r.id})" class="btn btn-danger btn-sm">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function deleteReserva(id) {
    if(!confirm('¿Borrar reserva?')) return;
    await fetch(API_URL + '/reservations/' + id, { method: 'DELETE', headers: getHeaders() });
    loadReservationsTable();
}

// CONFIGURACIÓN
async function saveConfigValue(key, val) {
    await fetch(API_URL + '/config/' + key, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ value: val })
    });
    alert('Guardado');
}

function saveMinHours() { saveConfigValue('minHours', document.getElementById('minHoursInput').value); }
function saveMaxCapacity() { saveConfigValue('maxCapacity', document.getElementById('maxCapacityInput').value); }

async function changeAdminPassword() {
    const cur = document.getElementById('currentAdminPassword').value;
    const newP = document.getElementById('newAdminPassword').value;
    if(!cur || !newP) return alert('Completa los campos');
    
    const res = await fetch(API_URL + '/admin/password', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ currentPassword: cur, newPassword: newP })
    });
    
    const data = await res.json();
    if(res.ok) { alert('✅ Clave cambiada. Inicia sesión.'); logout(); }
    else alert('❌ ' + data.error);
}

// Carga inicial de config
async function loadConfig() {
    const res = await fetch(API_URL + '/config'); // Config lectura es publica
    const data = await res.json();
    if(document.getElementById('minHoursInput')) {
        document.getElementById('minHoursInput').value = data.minHours || 8;
        document.getElementById('maxCapacityInput').value = data.maxCapacity || 30;
    }
}
