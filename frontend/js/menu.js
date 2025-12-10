const API_URL = '/api';
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    renderMenuItems();
    setupFilters();
    setupAccordions(); // Nueva función para los acordeones
});

async function renderMenuItems() {
    try {
        const response = await fetch(`${API_URL}/dishes`);
        const menu = await response.json();
        const grid = document.getElementById('menuGrid');

        if (!grid) return;

        // Filtrar platos según la categoría seleccionada
        let filtered = menu;
        if (currentFilter !== 'all') {
            filtered = menu.filter(m => m.category === currentFilter);
        }

        // Mensaje si no hay platos en la categoría
        if (filtered.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666; font-size: 1.1rem; padding: 2rem;">No hay platos disponibles en esta categoría por el momento.</p>';
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
        if(grid) grid.innerHTML = '<p style="text-align: center; color: #e74c3c;">Hubo un error al cargar el menú.</p>';
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
        });
    });
}

// LÓGICA DE LOS ACORDEONES
function setupAccordions() {
    const acc = document.getElementsByClassName("accordion-header");
    
    for (let i = 0; i < acc.length; i++) {
        acc[i].addEventListener("click", function() {
            // Alternar clase activa para girar la flecha
            this.classList.toggle("active");
            
            // Abrir o cerrar el panel
            const panel = this.nextElementSibling;
            if (panel.style.maxHeight) {
                panel.style.maxHeight = null;
            } else {
                // Cerrar otros paneles abiertos (opcional, para efecto acordeón único)
                closeAllAccordions();
                this.classList.add("active"); // Re-activar el actual
                panel.style.maxHeight = panel.scrollHeight + "px";
            }
        });
    }
}

function closeAllAccordions() {
    const acc = document.getElementsByClassName("accordion-header");
    for (let i = 0; i < acc.length; i++) {
        acc[i].classList.remove("active");
        acc[i].nextElementSibling.style.maxHeight = null;
    }
}

// Función global llamada desde el HTML
window.filterMenu = function(cat) {
    currentFilter = cat;
    renderMenuItems();
    
    // Scroll suave hacia los resultados si es móvil
    if(window.innerWidth < 768) {
        document.getElementById('menuGrid').scrollIntoView({ behavior: 'smooth' });
    }
    
    // Actualizar botones activos
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.trim() === cat || (cat === 'all' && btn.innerText.trim() === 'Ver Todo el Menú')) {
            btn.classList.add('active');
        }
    });
};
