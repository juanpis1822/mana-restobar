/* ==========================================================================
   MAIN.JS - Lógica Global de Maná Restobar
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    setupHamburgerMenu();
    highlightCurrentPage();
    startCarousel();       // Inicia el carrusel de fotos
    initScrollAnimations(); // Inicia las animaciones al bajar
});

// --------------------------------------------------------------------------
// 1. MENÚ HAMBURGUESA (MÓVIL)
// --------------------------------------------------------------------------
function setupHamburgerMenu() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');

    if (hamburger && navMenu) {
        // Abrir/Cerrar menú al tocar el icono
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active'); 
        });

        // Cerrar menú al tocar cualquier enlace
        document.querySelectorAll('.nav-menu a').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });

        // Cerrar menú al tocar fuera (opcional, mejora usabilidad)
        document.addEventListener('click', (e) => {
            if (!hamburger.contains(e.target) && !navMenu.contains(e.target) && navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            }
        });
    }
}

// --------------------------------------------------------------------------
// 2. RESALTAR PÁGINA ACTUAL EN EL MENÚ
// --------------------------------------------------------------------------
function highlightCurrentPage() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-menu a');

    navLinks.forEach(link => {

        link.classList.remove('active');

        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
}

// --------------------------------------------------------------------------
// 3. CARRUSEL DE IMÁGENES (HERO SLIDER)
// --------------------------------------------------------------------------
function startCarousel() {
    const slides = document.querySelectorAll('.slide');
    
    // Solo iniciamos si existen diapositivas en la página (ej: solo en index.html)
    if (slides.length === 0) return;

    let currentSlide = 0;
    const intervalTime = 5000; // Tiempo entre cambios: 5000ms = 5 segundos

    // Función para cambiar slide
    const nextSlide = () => {
        // Quitar clase active de la actual
        slides[currentSlide].classList.remove('active');
        
        // Calcular siguiente índice (ciclo infinito)
        currentSlide = (currentSlide + 1) % slides.length;
        
        // Poner clase active a la siguiente
        slides[currentSlide].classList.add('active');
    };

    // Iniciar intervalo automático
    const slideInterval = setInterval(nextSlide, intervalTime);


}

// --------------------------------------------------------------------------
// 4. ANIMACIONES AL HACER SCROLL (REVEAL)
// --------------------------------------------------------------------------
function initScrollAnimations() {
    const reveals = document.querySelectorAll('.reveal');

    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        const elementVisible = 100; // Píxeles antes de que aparezca

        reveals.forEach((reveal) => {
            const elementTop = reveal.getBoundingClientRect().top;
            
            // Si el elemento entra en la ventana visible
            if (elementTop < windowHeight - elementVisible) {
                reveal.classList.add('active');
            }
        });
    };

    // Escuchar el evento de scroll
    window.addEventListener('scroll', revealOnScroll);
    
    // Disparar una vez al inicio para mostrar elementos que ya son visibles
    revealOnScroll();
}
