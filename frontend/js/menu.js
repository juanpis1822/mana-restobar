const API_URL = '/api';
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    renderMenuItems();
    setupFilters();
});

async function renderMenuItems() {
    try {
        const response = await fetch(`${API_URL}/dishes`);
        const menu = await response.json();
        const grid = document.getElementById('menuGrid');

        if (!grid) return;

        // Filtrar platos
        let filtered = menu;
        if (currentFilter !== 'all') {
            filtered = menu.filter(m => m.category === currentFilter);
        }

        // Mensaje si no hay platos en la categoría
        if (filtered.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 1.1rem;">No hay platos disponibles en esta categoría por el momento.</p>';
            return;
        }

        // Generar HTML de las tarjetas
        grid.innerHTML = filtered.map(m => `
            <div class="menu-card">
                <div class="menu-card-img">
                    ${m.image 
                        ? `<img src="${m.image}" alt="${m.name}">` 
                        : '<span style="font-size: 3rem;">🍽️</span>'}
                </div>
                <div class="menu-card-content">
                    <h3>${m.name}</h3>
                    <p class="menu-card-category">${m.category}</p>
                    <p class="menu-card-price">$${m.price.toLocaleString('es-CO')}</p>
                    <p class="menu-card-description">${m.description || ''}</p>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Error cargando menú:', err);
        const grid = document.getElementById('menuGrid');
        if(grid) grid.innerHTML = '<p style="text-align: center; color: var(--danger);">Hubo un error al cargar el menú.</p>';
    }
}

function setupFilters() {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remover clase activa de todos
            buttons.forEach(b => b.classList.remove('active'));
            // Activar el clickeado
            e.target.classList.add('active');
            
            // Obtener la categoría del texto del botón (o podrías usar un data-attribute)
            // Nota: En tu HTML usas onclick="filterMenu", pero aquí lo hacemos más moderno
            // Si prefieres mantener el onclick del HTML, la función filterMenu de abajo servirá.
        });
    });
}

// Función global para que funcione el onclick del HTML antiguo si se desea mantener
window.filterMenu = function(cat) {
    currentFilter = cat;
    renderMenuItems();
    
    // Actualizar visualmente los botones (para el onclick inline)
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.trim() === cat || (cat === 'all' && btn.textContent.trim() === 'Todos')) {
            btn.classList.add('active');
        }
        // Fallback simple si el texto no coincide exacto
        if (event && event.target === btn) btn.classList.add('active');
    });
};