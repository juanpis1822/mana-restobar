let currentDate = new Date();
const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

document.addEventListener('DOMContentLoaded', () => {
    renderCalendar();
    
    // Asignar eventos a los botones si existen en el HTML
    // (Esto permite que funcionen aunque no tengan onclick="..." en el HTML)
    const prevBtn = document.querySelector('button[onclick="prevMonth()"]');
    const nextBtn = document.querySelector('button[onclick="nextMonth()"]');
    
    if(prevBtn) prevBtn.onclick = prevMonth;
    if(nextBtn) nextBtn.onclick = nextMonth;
});

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Actualizar título del mes
    const elem = document.getElementById('currentMonth');
    if (elem) elem.textContent = `${monthNames[month]} ${year}`;

    // Cálculos de días
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarDays = document.getElementById('calendarDays');
    if (!calendarDays) return;
    
    calendarDays.innerHTML = '';

    // Días vacíos previos (relleno)
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        calendarDays.appendChild(empty);
    }

    // Días reales
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElem = document.createElement('div');
        dayElem.className = 'calendar-day';
        dayElem.textContent = day;
        
        // Verificar si es el día de hoy para marcarlo (opcional)
        const today = new Date();
        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dayElem.style.border = '2px solid var(--primary)';
        }

        dayElem.addEventListener('click', () => selectDate(day, month, year, dayElem));
        calendarDays.appendChild(dayElem);
    }
}

function selectDate(day, month, year, element) {
    // Limpiar selección previa
    document.querySelectorAll('.calendar-day.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Marcar nuevo día
    element.classList.add('selected');

    // Formatear fecha manualmente para evitar errores de zona horaria (UTC)
    // Formato: YYYY-MM-DD
    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Guardar en el input oculto
    const input = document.getElementById('reservationDate');
    if (input) {
        input.value = formattedDate;
        console.log('Fecha seleccionada:', formattedDate);
    }
}

function prevMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
}

// Hacer funciones globales para que funcionen con el onclick del HTML
window.prevMonth = prevMonth;
window.nextMonth = nextMonth;