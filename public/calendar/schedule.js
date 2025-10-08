// public/calendar/schedule.js

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
    const editBlockSaveBtn = document.getElementById('edit-block-save-btn');
    const editBlockCancelBtn = document.getElementById('edit-block-cancel-btn');
    const editBlockDeleteBtn = document.getElementById('edit-block-delete-btn');
    const editBlockRowNumberInput = document.getElementById('edit-block-row-number');
    const editBlockDateInput = document.getElementById('edit-block-date');
    const editBlockStartInput = document.getElementById('edit-block-start-hour');
    const editBlockEndInput = document.getElementById('edit-block-end-hour');
    const editBlockNotesInput = document.getElementById('edit-block-notes');

    // --- 2. Variáveis Globais e Constantes ---
    let allAppointments = [];
    let allTechnicians = [];
    let allTechCoverage = [];
    let techAvailabilityBlocks = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());
    let miniCalDate = new Date();

    const SLOT_HEIGHT_PX = 60;
    const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MIN_HOUR = 7;
    const MAX_HOUR = 21;

    // --- 3. Funções Auxiliares ---
    function getStartOfWeek(date) { /* ...código existente... */ }
    function formatDateToYYYYMMDD(date) { /* ...código existente... */ }
    function parseSheetDate(dateStr) { /* ...código existente... */ }
    function getTimeHHMM(date) { /* ...código existente... */ }
    function formatDateTimeForInput(dateTimeStr) { /* ...código existente... */ }
    async function getTravelTime(originZip, destinationZip) { /* ...código existente... */ }

    // --- 4. Lógica do Mini Calendário ---
    function renderMiniCalendar() { /* ...código existente... */ }

    // --- 5. Funções de Manipulação dos Modais ---
    function openEditModal(appt) { /* ...código existente... */ }
    function closeEditModal() { /* ...código existente... */ }
    function openTimeBlockModal() { /* ...código existente... */ }
    function closeTimeBlockModal() { /* ...código existente... */ }
    function openEditTimeBlockModal(blockData) { /* ...código existente... */ }
    function closeEditTimeBlockModal() { /* ...código existente... */ }

    // --- 6. Funções de Manipulação de Dados (API Calls) ---
    async function handleSaveAppointment() { /* ...código existente... */ }
    async function handleSaveTimeBlock() { /* ...código existente... */ }
    async function handleUpdateTimeBlock() { /* ...código existente... */ }
    async function handleDeleteTimeBlock() { /* ...código existente... */ }
    async function fetchAvailabilityForSelectedTech() { /* ...código existente... */ }

    // --- 7. Funções de Renderização ---
    function renderScheduler() {
        if (!schedulerHeader || !schedulerBody) return;
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
            
            TIME_SLOTS.forEach((_, rowIndex) => {
                 const line = document.createElement('div');
                 line.className = 'absolute w-full border-t border-border/50';
                 line.style.height = '1px';
                 line.style.top = `${(rowIndex + 1) * SLOT_HEIGHT_PX}px`;
                 dayContainer.appendChild(line);
            });

            schedulerBody.appendChild(dayContainer);
        });

        if (selectedTechnician) {
            renderAppointments();
            renderTimeBlocks();
        }
        
        updateWeekDisplay();
        loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
    }
    
    function renderAppointments() { /* ...código existente... */ }
    function renderTimeBlocks() { /* ...código existente... */ }
    function updateWeekDisplay() { /* ...código existente... */ }

    // --- 8. Inicialização e Event Listeners ---
    async function loadInitialData() {
        // Mostra o overlay de "select technician" desde o início
        loadingOverlay.classList.remove('hidden');

        // Etapa 1: Carregar técnicos e popular o dropdown. Esta é a prioridade.
        try {
            const techDataResponse = await fetch('/api/get-dashboard-data');
            if (!techDataResponse.ok) throw new Error(`Failed to load technician list. Status: ${techDataResponse.status}`);
            
            const techData = await techDataResponse.json();
            allTechnicians = techData.technicians || [];
        } catch (error) {
            console.error('CRITICAL ERROR fetching technicians:', error);
            allTechnicians = [];
        } finally {
            populateTechSelects();
        }

        // Etapa 2: Carregar os outros dados em paralelo, de forma segura.
        try {
            const [appointmentsResponse, techCoverageResponse] = await Promise.all([
                fetch('/api/get-technician-appointments'),
                fetch('/api/get-tech-coverage')
            ]);

            if (appointmentsResponse.ok) {
                const apptsData = await appointmentsResponse.json();
                allAppointments = (apptsData.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            } else {
                console.warn('Could not load appointments.');
            }

            if (techCoverageResponse.ok) {
                allTechCoverage = await techCoverageResponse.json();
            } else {
                console.warn('Could not load tech coverage data.');
            }
        } catch (error) {
            console.error('Error fetching additional data (appointments/coverage):', error);
        }

        // Etapa 3: Renderização inicial
        renderScheduler();
        renderMiniCalendar();
    }

    function populateTechSelects() {
        if (!techSelectDropdown) return;

        if (allTechnicians && allTechnicians.length > 0) {
            techSelectDropdown.innerHTML = '<option value="">Select Technician...</option>';
            allTechnicians.forEach(tech => {
                const option = document.createElement('option');
                option.value = tech.trim(); // Garante que não haja espaços extras
                option.textContent = tech.trim();
                techSelectDropdown.appendChild(option);
            });
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
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">No Technician Selected</p><p class="text-sm text-muted-foreground">Select a technician from the top bar to view their schedule.</p>`;
        }
        
        // Ação mais importante: redesenha a agenda com o técnico selecionado (ou sem nenhum)
        renderScheduler();
        
        document.dispatchEvent(new CustomEvent('technicianChanged', { detail: { technician: selectedTechnician, weekStart: currentWeekStart } }));
    }

    // --- BINDING DOS EVENTOS ---
    techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    prevWeekBtn.addEventListener('click', () => { /* ...código existente... */ });
    nextWeekBtn.addEventListener('click', () => { /* ...código existente... */ });
    todayBtn.addEventListener('click', () => { /* ...código existente... */ });
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    modalCancelBtn.addEventListener('click', closeEditModal);
    modalCloseXBtn.addEventListener('click', closeEditModal);
    addTimeBlockBtn.addEventListener('click', openTimeBlockModal);
    blockSaveBtn.addEventListener('click', handleSaveTimeBlock);
    blockCancelBtn.addEventListener('click', closeTimeBlockModal);
    editBlockSaveBtn.addEventListener('click', handleUpdateTimeBlock);
    editBlockDeleteBtn.addEventListener('click', handleDeleteTimeBlock);
    editBlockCancelBtn.addEventListener('click', closeEditTimeBlockModal);

    document.addEventListener('appointmentUpdated', async () => {
        // Simplificado para recarregar apenas os agendamentos, que é o que muda.
        try {
            const appointmentsResponse = await fetch('/api/get-technician-appointments');
            if (appointmentsResponse.ok) {
                const apptsData = await appointmentsResponse.json();
                allAppointments = (apptsData.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            }
        } catch (error) {
            console.error('Failed to reload appointments after update:', error);
        } finally {
            renderScheduler(); // Redesenha a agenda com os novos dados
        }
    });

    // Inicia o carregamento da página
    loadInitialData();
});
