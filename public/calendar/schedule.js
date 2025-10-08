// public/calendar/schedule.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- Seletores de Elementos ---
    const techSelectDropdown = document.getElementById('tech-select-dropdown');
    const selectedTechDisplay = document.getElementById('selected-tech-display');
    const loadingOverlay = document.getElementById('loading-overlay');
    const schedulerHeader = document.getElementById('scheduler-header');
    const schedulerBody = document.getElementById('scheduler-body');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const todayBtn = document.getElementById('today-btn');
    
    // --- Variáveis Globais ---
    let allAppointments = [];
    let allTechnicians = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());

    const SLOT_HEIGHT_PX = 60;
    const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MIN_HOUR = 7;

    // --- Funções Auxiliares de Data ---
    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        return d;
    }

    function formatDateToYYYYMMDD(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}/${month}/${day}`;
    }
    
    function parseSheetDate(dateStr) {
        if (!dateStr) return null;
        const [datePart, timePart] = dateStr.split(' ');
        if (!datePart || !timePart) return null;
        const [month, day, year] = datePart.split('/').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        if ([year, month, day, hour, minute].some(isNaN)) return null;
        return new Date(year, month - 1, day, hour, minute);
    }

    // --- LÓGICA PRINCIPAL ---

    function renderScheduler() {
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        schedulerBody.innerHTML = ''; 

        TIME_SLOTS.forEach((time, rowIndex) => {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'time-slot timeline-header p-2 text-xs font-medium border-t border-border flex items-center justify-center';
            timeDiv.textContent = time;
            timeDiv.style.gridRow = `${rowIndex + 1} / span 1`;
            schedulerBody.appendChild(timeDiv);
        });
        
        DAY_NAMES.forEach((dayName, dayIndex) => {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + dayIndex);
            const dateKey = formatDateToYYYYMMDD(date);
            const column = dayIndex + 2;

            const header = document.createElement('div');
            header.className = 'day-column-header p-2 font-semibold border-l border-border';
            header.style.gridColumn = column;
            header.textContent = `${dayName} ${date.getDate()}`;
            schedulerHeader.appendChild(header);

            const dayContainer = document.createElement('div');
            dayContainer.className = 'relative border-r border-border';
            dayContainer.style.gridColumn = column;
            dayContainer.style.gridRow = `1 / span ${TIME_SLOTS.length}`;
            dayContainer.dataset.dateKey = dateKey;
            
            schedulerBody.appendChild(dayContainer);
        });

        renderAppointments();
        updateWeekDisplay();
        loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
    }

    function renderAppointments() {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);

        const appointmentsToRender = allAppointments.filter(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            return appt.technician === selectedTechnician && apptDate >= currentWeekStart && apptDate < weekEnd;
        });

        appointmentsToRender.forEach(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate) return;

            const dateKey = formatDateToYYYYMMDD(apptDate);
            const dayContainer = schedulerBody.querySelector(`[data-date-key="${dateKey}"]`);
            if (!dayContainer) return;

            const topOffset = (apptDate.getHours() - MIN_HOUR) * SLOT_HEIGHT_PX + (apptDate.getMinutes() / 60 * SLOT_HEIGHT_PX);
            const totalDuration = parseInt(appt.duration, 10) || 120;
            const travelTime = parseInt(appt.travelTime, 10) || 0;
            const marginTime = parseInt(appt.margin, 10) || 0;
            
            const container = document.createElement('div');
            container.className = 'appointment-block rounded-md shadow-soft cursor-pointer overflow-hidden';
            container.dataset.id = appt.id;
            container.style.top = `${topOffset}px`;
            container.style.height = `${totalDuration}px`;

            // 1. Bloco de Travel
            if (travelTime > 0) {
                const travelBlock = document.createElement('div');
                travelBlock.className = 'flex items-center justify-end pr-2';
                travelBlock.style.height = `${travelTime}px`;
                travelBlock.style.backgroundColor = '#fecde6'; // Rosa claro
                travelBlock.title = 'Travel time';
                travelBlock.innerHTML = `<span class="text-xs font-bold -rotate-90 text-[#c4427c]">Travel</span>`;
                container.appendChild(travelBlock);
            }

            // 2. Bloco Principal do Agendamento
            const mainBlock = document.createElement('div');
            mainBlock.className = 'flex-grow p-2 text-white';
            mainBlock.style.backgroundColor = '#ff5a96'; // Cor principal
            mainBlock.title = 'Appointment';
            mainBlock.innerHTML = `
                <p class="text-xs font-bold truncate">${appt.customers}</p>
                <p class="text-xs opacity-90">${appt.verification}</p>
                <p class="text-xs opacity-90">Pets: ${appt.pets}</p>
            `;
            container.appendChild(mainBlock);

            // 3. Bloco de Margem
            if (marginTime > 0) {
                const marginBlock = document.createElement('div');
                marginBlock.className = 'flex items-center justify-end pr-2';
                marginBlock.style.height = `${marginTime}px`;
                marginBlock.style.backgroundColor = '#c7336f'; // Rosa escuro
                marginBlock.title = 'Scheduling margin';
                marginBlock.innerHTML = `<span class="text-xs font-bold -rotate-90 text-white">Margin</span>`;
                container.appendChild(marginBlock);
            }
            
            dayContainer.appendChild(container);
        });
    }

    function updateWeekDisplay() {
        const endOfWeek = new Date(currentWeekStart);
        endOfWeek.setDate(currentWeekStart.getDate() + 6);
        currentWeekDisplay.textContent = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
    }
    
    async function loadInitialData() {
        try {
            const [techDataResponse, appointmentsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-technician-appointments')
            ]);
            if (!techDataResponse.ok || !appointmentsResponse.ok) throw new Error('Failed to load initial data.');
            
            const techData = await techDataResponse.json();
            const apptsData = await appointmentsResponse.json();
            
            allTechnicians = techData.technicians || [];
            allAppointments = (apptsData.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));

            populateTechSelects();
            renderScheduler(); 
        } catch (error) {
            console.error('CRITICAL ERROR during loadInitialData:', error);
        }
    }
    
    function populateTechSelects() {
        techSelectDropdown.innerHTML = '<option value="">Select Technician...</option>';
        allTechnicians.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech;
            option.textContent = tech;
            techSelectDropdown.appendChild(option);
        });
    }

    // --- Event Listeners ---
    techSelectDropdown.addEventListener('change', (e) => {
        selectedTechnician = e.target.value;
        if(selectedTechnician) {
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">${selectedTechnician}</p><p class="text-sm text-muted-foreground">Schedule and details below.</p>`;
        } else {
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">No Technician Selected</p><p class="text-sm text-muted-foreground">Select a technician to view their schedule.</p>`;
        }
        renderScheduler();
        // Dispara um evento para que outros scripts (itinerary.js) saibam da mudança
        document.dispatchEvent(new CustomEvent('technicianChanged', { detail: { technician: selectedTechnician, weekStart: currentWeekStart } }));
    });
    
    const navigateWeek = (direction) => {
        currentWeekStart.setDate(currentWeekStart.getDate() + (7 * direction));
        currentWeekStart = new Date(currentWeekStart); // Recria o objeto para garantir reatividade
        renderScheduler();
        // Dispara um evento para que outros scripts (itinerary.js) saibam da mudança
        document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } }));
    };

    prevWeekBtn.addEventListener('click', () => navigateWeek(-1));
    nextWeekBtn.addEventListener('click', () => navigateWeek(1));
    todayBtn.addEventListener('click', () => {
        currentWeekStart = getStartOfWeek(new Date());
        renderScheduler();
        document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } }));
    });
    
    loadInitialData();
});
