// public/calendar/schedule.js (Controlador Principal)

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. Seletores de Elementos ---
    const techSelectDropdown = document.getElementById('tech-select-dropdown');
    const selectedTechDisplay = document.getElementById('selected-tech-display');
    const loadingOverlay = document.getElementById('loading-overlay');
    const schedulerHeader = document.getElementById('scheduler-header');
    const schedulerBody = document.getElementById('scheduler-body');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const todayBtn = document.getElementById('today-btn');
    const addTimeBlockBtn = document.getElementById('add-time-block-btn');
    const miniCalendarContainer = document.getElementById('mini-calendar-container');

    // Modais e seus botões
    const editModal = document.getElementById('edit-appointment-modal');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalCloseXBtn = document.getElementById('modal-close-x-btn');
    const timeBlockModal = document.getElementById('time-block-modal');
    const blockSaveBtn = document.getElementById('block-save-btn');
    const blockCancelBtn = document.getElementById('block-cancel-btn');
    const editTimeBlockModal = document.getElementById('edit-time-block-modal');
    // ... (demais seletores de modal)

    // --- 2. Variáveis Globais ---
    let allAppointments = [];
    let allTechnicians = [];
    let allTechCoverage = [];
    let techAvailabilityBlocks = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());
    let miniCalDate = new Date();

    // --- 3. Constantes ---
    const SLOT_HEIGHT_PX = 60;
    const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MIN_HOUR = 7;
    const MAX_HOUR = 21;

    // --- 4. Funções Auxiliares ---
    function getStartOfWeek(date) { /* ...código da versão anterior... */ }
    function formatDateToYYYYMMDD(date) { /* ...código da versão anterior... */ }
    function parseSheetDate(dateStr) { /* ...código da versão anterior... */ }
    function getTimeHHMM(date) { /* ...código da versão anterior... */ }
    function formatDateTimeForInput(dateTimeStr) { /* ...código da versão anterior... */ }
    async function getTravelTime(originZip, destinationZip) { /* ...código da versão anterior... */ }
    
    // --- 5. Lógica do Mini Calendário ---
    function renderMiniCalendar() { /* ...código da versão anterior... */ }

    // --- 6. Funções de Manipulação dos Modais ---
    function openEditModal(appt) { /* ...código da versão anterior... */ }
    function closeEditModal() { /* ...código da versão anterior... */ }
    // ... (demais funções de modal)

    // --- 7. Funções de Manipulação de Dados (API Calls) ---
    async function handleSaveAppointment() { /* ...código da versão anterior... */ }
    async function handleSaveTimeBlock() { /* ...código da versão anterior... */ }
    async function fetchAvailabilityForSelectedTech() { /* ...código da versão anterior... */ }

    // --- 8. Funções de Renderização ---
    function renderScheduler() {
        if (!schedulerHeader || !schedulerBody) return;
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        schedulerBody.innerHTML = '';
        loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
        updateWeekDisplay();

        if (!selectedTechnician) return;

        TIME_SLOTS.forEach((time, rowIndex) => { /* ...código da versão anterior... */ });
        DAY_NAMES.forEach((dayName, dayIndex) => {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + dayIndex);
            /* ...resto do código de renderização da grade... */
        });

        renderAppointments();
        renderTimeBlocks();
    }

    function renderAppointments() {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const appointmentsToRender = allAppointments.filter(appt => appt.technician.trim() === selectedTechnician.trim());
    
        appointmentsToRender.forEach(appt => {
             const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate || apptDate < currentWeekStart || apptDate >= weekEnd) return;
            // ... (resto do código para renderizar agendamentos)
        });
    }
    
    function renderTimeBlocks() { /* ...código da versão anterior... */ }
    function updateWeekDisplay() { /* ...código da versão anterior... */ }

    // --- 9. Inicialização e Event Listeners ---
    async function loadInitialData(isReload = false) {
        loadingOverlay.classList.remove('hidden');

        const [techResult, apptResult, coverageResult] = await Promise.all([
            fetch('/api/get-dashboard-data').then(res => res.json()).catch(e => ({ error: e })),
            fetch('/api/get-technician-appointments').then(res => res.json()).catch(e => ({ error: e })),
            fetch('/api/get-tech-coverage').then(res => res.json()).catch(e => ({ error: e }))
        ]);

        if (techResult && !techResult.error) {
            allTechnicians = (techResult.technicians || []).map(t => t.trim()).filter(Boolean);
        } else {
            console.error('Failed to load technician list:', techResult ? techResult.error : 'Unknown error');
        }
        populateTechSelects();

        if (apptResult && !apptResult.error) {
            allAppointments = (apptResult.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
        }
        if (coverageResult && !coverageResult.error) {
            allTechCoverage = coverageResult || [];
        }

        renderScheduler();
        if (!isReload) renderMiniCalendar();

        // Dispara um evento para notificar os outros scripts que os dados estão prontos
        document.dispatchEvent(new CustomEvent('dataLoaded', { 
            detail: { allAppointments, allTechCoverage, selectedTechnician, currentWeekStart }
        }));
    }

    function populateTechSelects() {
        if (!techSelectDropdown) return;
        const currentSelection = techSelectDropdown.value;
        techSelectDropdown.innerHTML = '<option value="">Select Technician...</option>';
        if (allTechnicians.length > 0) {
            allTechnicians.forEach(tech => {
                const option = new Option(tech, tech);
                techSelectDropdown.add(option);
            });
            if (allTechnicians.includes(currentSelection)) {
                techSelectDropdown.value = currentSelection;
            }
        } else {
            techSelectDropdown.innerHTML = '<option value="">No technicians found</option>';
        }
    }

    async function handleTechSelectionChange(event) {
        selectedTechnician = event.target.value;
        if (selectedTechnician) {
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">${selectedTechnician}</p> <p class="text-sm text-muted-foreground">Schedule and details below.</p>`;
            await fetchAvailabilityForSelectedTech();
        } else {
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">No Technician Selected</p><p class="text-sm text-muted-foreground">...</p>`;
        }
        renderScheduler();
        
        // Dispara eventos para os outros scripts
        const eventDetail = { detail: { technician: selectedTechnician, weekStart: currentWeekStart, allAppointments, allTechCoverage } };
        document.dispatchEvent(new CustomEvent('technicianChanged', eventDetail));
    }

    // --- BINDING DOS EVENTOS ---
    techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    // ... (resto dos event listeners da versão anterior)

    document.addEventListener('appointmentUpdated', () => loadInitialData(true));

    loadInitialData();
});
