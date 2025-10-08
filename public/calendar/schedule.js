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

    // --- Modais e seus botões ---
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

    // --- 2. Variáveis Globais de Estado ---
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
        const dateParts = datePart.split('/');
        if (dateParts.length !== 3) return null;
        const [month, day, year] = dateParts.map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null;
        return new Date(year, month - 1, day, hour, minute);
    }

    function getTimeHHMM(date) {
        if (!date) return '';
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        const date = parseSheetDate(dateTimeStr);
        if (!date) return '';
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hour}:${minute}`;
    }

    async function getTravelTime(originZip, destinationZip) {
        if (!originZip || !destinationZip || originZip === destinationZip) {
            return 0;
        }
        try {
            const response = await fetch('/api/get-travel-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originZip, destinationZip }),
            });
            const result = await response.json();
            return result.success ? result.travelTimeInMinutes : 0;
        } catch (error) {
            console.error("Failed to fetch travel time:", error);
            return 0;
        }
    }
    
    // --- 5. Lógica do Mini Calendário ---
    function renderMiniCalendar() {
        if (!miniCalendarContainer) return;
        const month = miniCalDate.getMonth();
        const year = miniCalDate.getFullYear();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const firstDayOfWeek = firstDayOfMonth.getDay();
        let datesHtml = Array(firstDayOfWeek).fill('<div class="date-cell other-month"></div>').join('');
        for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
            const currentDate = new Date(year, month, i);
            const isToday = currentDate.toDateString() === new Date().toDateString();
            const weekEnd = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
            const isSelected = currentDate >= currentWeekStart && currentDate < weekEnd;
            let cellClass = 'date-cell';
            if (isToday) cellClass += ' today';
            if (isSelected) cellClass += ' selected';
            datesHtml += `<div class="${cellClass}" data-date="${currentDate.toISOString()}">${i}</div>`;
        }
        const monthName = miniCalDate.toLocaleString('default', { month: 'long' });
        miniCalendarContainer.innerHTML = `
            <div id="mini-calendar">
                <div class="header">
                    <button class="nav-btn" id="mini-cal-prev-month"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
                    <span class="font-semibold">${monthName} ${year}</span>
                    <button class="nav-btn" id="mini-cal-next-month"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
                </div>
                <div class="days-grid">${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => `<div class="day-name">${d}</div>`).join('')}</div>
                <div class="dates-grid">${datesHtml}</div>
            </div>`;
        document.getElementById('mini-cal-prev-month').addEventListener('click', () => { miniCalDate.setMonth(miniCalDate.getMonth() - 1); renderMiniCalendar(); });
        document.getElementById('mini-cal-next-month').addEventListener('click', () => { miniCalDate.setMonth(miniCalDate.getMonth() + 1); renderMiniCalendar(); });
        miniCalendarContainer.querySelectorAll('.date-cell[data-date]').forEach(cell => {
            cell.addEventListener('click', (e) => {
                currentWeekStart = getStartOfWeek(new Date(e.currentTarget.dataset.date));
                updateAllComponents();
            });
        });
    }

    // --- 6. Funções de Manipulação dos Modais ---
    function openEditModal(appt) { /* ...código da versão anterior... */ }
    function closeEditModal() { /* ...código da versão anterior... */ }
    function openTimeBlockModal() { /* ...código da versão anterior... */ }
    function closeTimeBlockModal() { /* ...código da versão anterior... */ }
    function openEditTimeBlockModal(blockData) { /* ...código da versão anterior... */ }
    function closeEditTimeBlockModal() { /* ...código da versão anterior... */ }

    // --- 7. Funções de Manipulação de Dados (API Calls) ---
    async function handleSaveAppointment() { /* ...código da versão anterior... */ }
    async function handleSaveTimeBlock() { /* ...código da versão anterior... */ }
    async function handleUpdateTimeBlock() { /* ...código da versão anterior... */ }
    async function handleDeleteTimeBlock() { /* ...código da versão anterior... */ }
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
                 line.style.zIndex = '1';
                 dayContainer.appendChild(line);
            });

            schedulerBody.appendChild(dayContainer);
        });
        renderAppointments();
        renderTimeBlocks();
    }

    function renderAppointments() { /* ...código da versão anterior... */ }
    function renderTimeBlocks() { /* ...código da versão anterior... */ }
    function updateWeekDisplay() { /* ...código da versão anterior... */ }

    // --- 9. Inicialização e Lógica de Controle ---
    async function loadInitialData(isReload = false) {
        if (!isReload) {
            loadingOverlay.classList.remove('hidden');
        }

        try {
            const [techResult, apptResult, coverageResult] = await Promise.all([
                fetch('/api/get-dashboard-data').then(res => res.json()).catch(e => ({ error: e })),
                fetch('/api/get-technician-appointments').then(res => res.json()).catch(e => ({ error: e })),
                fetch('/api/get-tech-coverage').then(res => res.json()).catch(e => ({ error: e }))
            ]);

            if (techResult && !techResult.error) {
                allTechnicians = (techResult.technicians || []).map(t => t.trim()).filter(Boolean);
            }
            if (!isReload) populateTechSelects();

            if (apptResult && !apptResult.error) {
                allAppointments = (apptResult.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            }

            if (coverageResult && !coverageResult.error) {
                allTechCoverage = coverageResult || [];
            }
        } catch (error) {
            console.error('A critical error occurred during data loading:', error);
        } finally {
            updateAllComponents();
            if (!isReload) renderMiniCalendar();
        }
    }

    function populateTechSelects() {
        if (!techSelectDropdown) return;
        const currentSelection = techSelectDropdown.value;
        techSelectDropdown.innerHTML = '<option value="">Select Technician...</option>';
        allTechnicians.forEach(tech => {
            const option = new Option(tech, tech);
            techSelectDropdown.add(option);
        });
        if (allTechnicians.includes(currentSelection)) {
            techSelectDropdown.value = currentSelection;
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
        updateAllComponents();
    }

    function updateAllComponents() {
        renderScheduler();
        const eventDetail = { detail: { technician: selectedTechnician, weekStart: currentWeekStart, allAppointments, allTechCoverage } };
        document.dispatchEvent(new CustomEvent('stateUpdated', eventDetail));
    }

    // --- BINDING DOS EVENTOS ---
    techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    
    prevWeekBtn.addEventListener('click', () => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() - 7);
        currentWeekStart = newDate;
        updateAllComponents();
        renderMiniCalendar();
    });
    
    nextWeekBtn.addEventListener('click', () => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + 7);
        currentWeekStart = newDate;
        updateAllComponents();
        renderMiniCalendar();
    });

    todayBtn.addEventListener('click', () => {
        currentWeekStart = getStartOfWeek(new Date());
        miniCalDate = new Date();
        updateAllComponents();
        renderMiniCalendar();
    });
    
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    modalCancelBtn.addEventListener('click', closeEditModal);
    modalCloseXBtn.addEventListener('click', closeEditModal);
    addTimeBlockBtn.addEventListener('click', openTimeBlockModal);
    blockSaveBtn.addEventListener('click', handleSaveTimeBlock);
    blockCancelBtn.addEventListener('click', closeTimeBlockModal);
    editBlockSaveBtn.addEventListener('click', handleUpdateTimeBlock);
    editBlockDeleteBtn.addEventListener('click', handleDeleteTimeBlock);
    editBlockCancelBtn.addEventListener('click', closeEditTimeBlockModal);

    document.addEventListener('appointmentUpdated', () => loadInitialData(true));

    loadInitialData();
});
