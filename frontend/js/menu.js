<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Menú - Maná Restobar</title>
    <link rel="stylesheet" href="css/styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    
    <nav class="navbar">
        <div class="nav-container">
            <div class="logo" onclick="window.location.href='index.html'">
                <img src="images/logo-brown.jpeg" alt="Maná Restobar" class="logo-img">
            </div>
            <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
            <ul class="nav-menu" id="navMenu">
                <li><a href="index.html">Inicio</a></li>
                <li><a href="nosotros.html">Nosotros</a></li>
                <li><a href="menu.html" class="active">Menú</a></li>
                <li><a href="menu-dia.html">Menú del Día</a></li> <li><a href="reserva.html">Reservas</a></li>
                <li><a href="admin.html">Admin</a></li>
            </ul>
        </div>
    </nav>

    <main class="menu-page">
        <div class="container">
            <h1 class="section-title">Nuestro Menú</h1>
            <p class="menu-subtitle">Descubre nuestras deliciosas opciones</p>

            <section class="menu-filters">
                <button class="filter-btn active" onclick="filterMenu('all')">Todos</button>
                <button class="filter-btn" onclick="filterMenu('Comida Rápida')">Comida Rápida</button>
                <button class="filter-btn" onclick="filterMenu('Cafetería')">Cafetería</button>
            </section>

            <section class="menu-grid" id="menuGrid">
                <p style="text-align: center; width: 100%; color: #999;">Cargando menú...</p>
            </section>

            <section class="menu-cta">
                <h2>¿Listo para ordenar?</h2>
                <p>Haz tu reserva y disfruta con nosotros</p>
                <a href="reserva.html" class="btn btn-primary">Hacer Reserva</a>
            </section>
        </div>
    </main>

    <footer class="footer">
        <div class="footer-content">
            <h2 class="footer-main-title">CONTÁCTANOS</h2>
            <div class="footer-grid">
                <div class="footer-column">
                    <h4>Dirección</h4>
                    <p>Cra 9 calle 5 esquina, local 2<br>Ursua, Pamplona<br>Norte de Santander</p>
                    <div class="footer-map-small">
                        <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3956.8148024271486!2d-72.6471175889428!3d7.374643212655943!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e688153a8bf1953%3A0xb67c44d64f68830c!2sMana%20coffee!5e0!3m2!1ses!2sco!4v1764978558013!5m2!1ses!2sco" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
                    </div>
                </div>
                <div class="footer-column">
                    <h4>Horarios</h4>
                    <ul><li>Lun - Vie: 4PM - 10PM</li><li>Sáb - Dom: 8AM - 10PM</li></ul>
                </div>
                <div class="footer-column">
                    <h4>Teléfono</h4>
                    <p>314 325 8525</p>
                </div>
                <div class="footer-column">
                    <h4>Redes Sociales</h4>
                    <div class="footer-social-icons">
                        <a href="https://www.instagram.com/mana_coffee_pam" target="_blank"><i class="fa-brands fa-instagram"></i></a>
                        <a href="https://www.facebook.com/profile.php?id=61572704497545" target="_blank"><i class="fa-brands fa-facebook-f"></i></a>
                        <a href="https://wa.me/573143258525" target="_blank"><i class="fa-brands fa-whatsapp"></i></a>
                    </div>
                </div>
            </div>
        </div>
        <div class="footer-bottom"><p>© 2025 Maná Restobar. Todos los derechos reservados.</p></div>
    </footer>

    <script src="js/main.js"></script>
    <script src="js/menu.js"></script>
</body>
</html>
