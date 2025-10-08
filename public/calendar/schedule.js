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
            if (result.success) {
                return result.travelTimeInMinutes;
            }
            return 0;
        } catch (error) {
            console.error("Failed to fetch travel time:", error);
            return 0;
        }
    }

    // --- 4. Lógica do Mini Calendário ---
    function renderMiniCalendar() {
        if (!miniCalendarContainer) return;

        const month = miniCalDate.getMonth();
        const year = miniCalDate.getFullYear();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const firstDayOfWeek = firstDayOfMonth.getDay();

        let datesHtml = '';
        for (let i = 0; i < firstDayOfWeek; i++) {
            datesHtml += `<div class="date-cell other-month"></div>`;
        }

        for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
            const currentDate = new Date(year, month, i);
            const isToday = currentDate.toDateString() === new Date().toDateString();
            const isSelected = currentDate >= currentWeekStart && currentDate < new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
            
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
                <div class="days-grid">
                    ${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => `<div class="day-name">${d}</div>`).join('')}
                </div>
                <div class="dates-grid">${datesHtml}</div>
            </div>
        `;

        document.getElementById('mini-cal-prev-month').addEventListener('click', () => {
            miniCalDate.setMonth(miniCalDate.getMonth() - 1);
            renderMiniCalendar();
        });
        document.getElementById('mini-cal-next-month').addEventListener('click', () => {
            miniCalDate.setMonth(miniCalDate.getMonth() + 1);
            renderMiniCalendar();
        });
        miniCalendarContainer.querySelectorAll('.date-cell[data-date]').forEach(cell => {
            cell.addEventListener('click', (e) => {
                currentWeekStart = getStartOfWeek(new Date(e.currentTarget.dataset.date));
                renderScheduler();
                renderMiniCalendar();
                document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } }));
            });
        });
    }

    // --- 5. Funções de Manipulação dos Modais ---
    function openEditModal(appt) {
        const { id, appointmentDate, verification, technician, pets, margin } = appt;
        
        document.getElementById('modal-appt-id').value = id;
        document.getElementById('modal-date').value = formatDateTimeForInput(appointmentDate);
        document.getElementById('modal-pets').value = pets || 1;
        document.getElementById('modal-margin').value = margin || 30;

        const techSelect = document.getElementById('modal-technician');
        techSelect.innerHTML = allTechnicians.map(t => `<option value="${t}" ${t === technician ? 'selected' : ''}>${t}</option>`).join('');

        const verificationSelect = document.getElementById('modal-verification');
        const statusOptions = ["Scheduled", "Confirmed", "Showed", "Canceled"];
        verificationSelect.innerHTML = statusOptions.map(opt =>
            `<option value="${opt}" ${verification === opt ? 'selected' : ''}>${opt}</option>`
        ).join('');
        
        editModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }
    
    function closeEditModal() {
        if (editModal) editModal.classList.add('hidden');
        if(modalSaveBtn) {
            modalSaveBtn.disabled = false;
            modalSaveBtn.textContent = 'Save Changes';
        }
        document.body.classList.remove('modal-open');
    }

    function openTimeBlockModal() { /* ...código existente... */ }
    function closeTimeBlockModal() { /* ...código existente... */ }
    function openEditTimeBlockModal(blockData) { /* ...código existente... */ }
    function closeEditTimeBlockModal() { /* ...código existente... */ }

    // --- 6. Funções de Manipulação de Dados (API Calls) ---
    
    async function handleSaveAppointment() {
        modalSaveBtn.disabled = true;
        modalSaveBtn.textContent = 'Saving...';

        const apptId = parseInt(document.getElementById('modal-appt-id').value, 10);
        const newDate = new Date(document.getElementById('modal-date').value);
        const newPets = parseInt(document.getElementById('modal-pets').value, 10);
        const newMargin = parseInt(document.getElementById('modal-margin').value, 10);
        const newTechnician = document.getElementById('modal-technician').value;
        const newVerification = document.getElementById('modal-verification').value;

        if (isNaN(newDate.getTime())) {
            alert("Invalid date/time selected.");
            closeEditModal();
            return;
        }

        const newDurationWithoutTravel = (newPets * 60) + newMargin; 
        const newEndTime = new Date(newDate.getTime() + newDurationWithoutTravel * 60000);

        const conflictingAppointment = allAppointments.find(a => {
            if (a.id === apptId || a.technician !== newTechnician) return false;
            const existingDate = parseSheetDate(a.appointmentDate);
            const existingEndTime = new Date(existingDate.getTime() + a.duration * 60000);
            return (newDate < existingEndTime && newEndTime > existingDate);
        });

        if (conflictingAppointment) {
            alert(`Error: This time slot conflicts with another appointment for ${newTechnician}.`);
            closeEditModal();
            return;
        }

        const appointmentsOnDay = allAppointments
            .filter(a => a.technician === newTechnician && parseSheetDate(a.appointmentDate).toDateString() === newDate.toDateString() && a.id !== apptId)
            .sort((a, b) => parseSheetDate(a.appointmentDate) - parseSheetDate(b.appointmentDate));

        let previousAppointmentZip = allTechCoverage.find(t => t.nome === newTechnician)?.zip_code || null;
        for (const appt of appointmentsOnDay) {
            if (parseSheetDate(appt.appointmentDate) < newDate) {
                previousAppointmentZip = appt.zipCode;
            }
        }
        
        const appointmentToUpdate = allAppointments.find(a => a.id === apptId);
        const newTravelTime = await getTravelTime(previousAppointmentZip, appointmentToUpdate.zipCode);

        const apiFormattedDate = `${String(newDate.getMonth() + 1).padStart(2, '0')}/${String(newDate.getDate()).padStart(2, '0')}/${newDate.getFullYear()} ${getTimeHHMM(newDate)}`;

        const dataToUpdate = {
            rowIndex: apptId,
            appointmentDate: apiFormattedDate,
            verification: newVerification,
            technician: newTechnician,
            pets: newPets,
            margin: newMargin,
            travelTime: newTravelTime,
        };

        try {
            const response = await fetch('/api/update-appointment-showed-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToUpdate),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            closeEditModal();
            await loadInitialData(true);

        } catch (error) {
            alert(`Error saving appointment: ${error.message}`);
            closeEditModal();
        }
    }

    async function handleSaveTimeBlock() { /* ...código existente... */ }
    async function handleUpdateTimeBlock() { /* ...código existente... */ }
    async function handleDeleteTimeBlock() { /* ...código existente... */ }
    async function fetchAvailabilityForSelectedTech() { /* ...código existente... */ }

    // --- 7. Funções de Renderização ---
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
            
            TIME_SLOTS.forEach((_, rowIndex) => {
                 const line = document.createElement('div');
                 line.className = 'absolute w-full border-t border-border/50';
                 line.style.height = '1px';
                 line.style.top = `${(rowIndex + 1) * SLOT_HEIGHT_PX}px`;
                 dayContainer.appendChild(line);
            });

            schedulerBody.appendChild(dayContainer);
        });

        renderAppointments();
        renderTimeBlocks();
        updateWeekDisplay();
        loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
    }
    
    function renderAppointments() { /* ...código existente... */ }
    function renderTimeBlocks() { /* ...código existente... */ }
    function updateWeekDisplay() { /* ...código existente... */ }

    // --- 8. Inicialização e Event Listeners ---
    async function loadInitialData(isReload = false) {
        // Usa Promise.all com .catch para evitar que uma falha bloqueie tudo
        const [techResult, apptResult, coverageResult] = await Promise.all([
            fetch('/api/get-dashboard-data').then(res => res.json()).catch(e => ({ error: e })),
            fetch('/api/get-technician-appointments').then(res => res.json()).catch(e => ({ error: e })),
            fetch('/api/get-tech-coverage').then(res => res.json()).catch(e => ({ error: e }))
        ]);

        // Processa técnicos e popula o dropdown
        if (techResult && !techResult.error) {
            allTechnicians = techResult.technicians || [];
        } else {
            console.error('Failed to load technician list:', techResult ? techResult.error : 'Unknown error');
            allTechnicians = [];
        }
        populateTechSelects();

        // Processa agendamentos
        if (apptResult && !apptResult.error) {
            allAppointments = (apptResult.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
        } else {
            console.error('Failed to load appointments:', apptResult ? apptResult.error : 'Unknown error');
            allAppointments = [];
        }

        // Processa dados de cobertura
        if (coverageResult && !coverageResult.error) {
            allTechCoverage = coverageResult || [];
        } else {
            console.error('Failed to load tech coverage:', coverageResult ? coverageResult.error : 'Unknown error');
            allTechCoverage = [];
        }

        // Renderiza a interface
        renderScheduler();
        if (!isReload) {
            renderMiniCalendar();
        }
    }

    function populateTechSelects() {
        if (!techSelectDropdown) return;

        if (allTechnicians && allTechnicians.length > 0) {
            const currentSelection = techSelectDropdown.value;
            techSelectDropdown.innerHTML = '<option value="">Select Technician...</option>';
            allTechnicians.forEach(tech => {
                const option = document.createElement('option');
                option.value = tech;
                option.textContent = tech;
                techSelectDropdown.appendChild(option);
            });
            // Mantém a seleção se o técnico ainda existir na lista
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
        } else {
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">No Technician Selected</p><p class="text-sm text-muted-foreground">Select a technician from the top bar to view their schedule.</p>`;
        }
        await fetchAvailabilityForSelectedTech();
        renderScheduler();
        document.dispatchEvent(new CustomEvent('technicianChanged', { detail: { technician: selectedTechnician, weekStart: currentWeekStart } }));
    }

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
        await loadInitialData(true);
    });

    loadInitialData();
});
