const API_URL = '/api';
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    renderMenuItems();
    setupFilters();
    setupAccordions();
});


function getCategoryEmoji(category) {
    const emojis = {
        'Clásicos Café': '☕', 'Nevados': '🍧', 'Frappés': '🥤', 
        'Malteadas': '🍦', 'Bebidas Calientes': '🍵', 'Repostería': '🍰', 
        'Postres': '🍮', 'Antojos': '🥐', 'Adicionales Dulces': '🍬',
        'Desayunos': '🍳', 'Huevos': '🥚', 'Adicionales Sal': '🧀', 
        'Carnes': '🥩', 'Aves': '🍗', 'Mariscos': '🍤', 
        'Ceviches': '🍋', 'Ensaladas': '🥗', 'Adicionales Almuerzo': '🍚',
        'Hamburguesas': '🍔', 'Perros Calientes': '🌭', 'Desgranados': '🌽', 
        'Picadas': '🍖', 'Sandwiches': '🥪', 'Patacones': '🍌', 
        'Salchipapas': '🍟', 'Wraps': '🌯', 'Vegetariano': '🥦', 'Infantil': '🧒',
        'Jugos Agua': '🧃', 'Jugos Leche': '🥛', 'Limonadas': '🍋', 
        'Sodas': '🫧', 'Mocktails': '🍹', 'Micheladas': '🍻', 
        'Cócteles': '🍸', 'Cervezas': '🍺', 'Vinos': '🍷', 'Otras Bebidas': '🥤'
    };
    return emojis[category] || '🍽️'; 
}

async function renderMenuItems() {
    try {
        const response = await fetch(`${API_URL}/dishes`);
        const menu = await response.json();
        const grid = document.getElementById('menuGrid');

        if (!grid) return;

        let filtered = menu;
        if (currentFilter !== 'all') {
            filtered = menu.filter(m => m.category === currentFilter);
        }

        if (filtered.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666; font-size: 1.1rem; padding: 2rem;">No hay platos disponibles en esta categoría por el momento.</p>';
            return;
        }

        grid.innerHTML = filtered.map(m => `
            <div class="menu-card">
                <div class="menu-card-img" style="${!m.image ? 'background:#f4f4f4;' : ''}">
                    ${m.image 
                        ? `<img src="${m.image}" alt="${m.name}">` 
                        : `<span style="font-size: 4rem;">${getCategoryEmoji(m.category)}</span>`}
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
            buttons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
}

function setupAccordions() {
    const acc = document.getElementsByClassName("accordion-header");
    for (let i = 0; i < acc.length; i++) {
        acc[i].addEventListener("click", function() {
            this.classList.toggle("active");
            const panel = this.nextElementSibling;
            if (panel.style.maxHeight) {
                panel.style.maxHeight = null;
            } else {
                closeAllAccordions();
                this.classList.add("active");
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

window.filterMenu = function(cat) {
    currentFilter = cat;
    renderMenuItems();
    if(window.innerWidth < 768) {
        document.getElementById('menuGrid').scrollIntoView({ behavior: 'smooth' });
    }
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.trim() === cat || (cat === 'all' && btn.innerText.trim() === 'Todos')) {
            btn.classList.add('active');
        }
    });
};

