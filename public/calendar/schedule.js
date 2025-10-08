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
                renderMiniCalendar();
            });
        });
    }

    // --- 6. Funções de Manipulação dos Modais ---
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
        verificationSelect.innerHTML = statusOptions.map(opt => `<option value="${opt}" ${verification === opt ? 'selected' : ''}>${opt}</option>`).join('');
        editModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    function closeEditModal() {
        if (editModal) editModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }

    function openTimeBlockModal() {
        if (!selectedTechnician) {
            alert('Please select a technician first.');
            return;
        }
        document.getElementById('time-block-form').reset();
        timeBlockModal.classList.remove('hidden');
    }

    function closeTimeBlockModal() {
        timeBlockModal.classList.add('hidden');
    }

    function openEditTimeBlockModal(blockData) {
        editBlockRowNumberInput.value = blockData.rowNumber;
        const [month, day, year] = blockData.date.split('/');
        editBlockDateInput.value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        editBlockStartInput.value = blockData.startHour;
        editBlockEndInput.value = blockData.endHour;
        editBlockNotesInput.value = blockData.notes;
        editTimeBlockModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    function closeEditTimeBlockModal() {
        if (editTimeBlockModal) editTimeBlockModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }

    // --- 7. Funções de Manipulação de Dados (API Calls) ---
    async function handleSaveAppointment() {
        modalSaveBtn.disabled = true;
        modalSaveBtn.textContent = 'Saving...';

        try {
            const apptId = parseInt(document.getElementById('modal-appt-id').value, 10);
            const newDate = new Date(document.getElementById('modal-date').value);
            const newPets = parseInt(document.getElementById('modal-pets').value, 10);
            const newMargin = parseInt(document.getElementById('modal-margin').value, 10);
            const newTechnician = document.getElementById('modal-technician').value;
            const newVerification = document.getElementById('modal-verification').value;

            if (isNaN(newDate.getTime())) throw new Error("Invalid date/time selected.");

            const newDurationWithoutTravel = (newPets * 60) + newMargin; 
            const newEndTime = new Date(newDate.getTime() + newDurationWithoutTravel * 60000);

            const conflictingAppointment = allAppointments.find(a => {
                if (a.id === apptId || a.technician !== newTechnician) return false;
                const existingDate = parseSheetDate(a.appointmentDate);
                const existingEndTime = new Date(existingDate.getTime() + (parseInt(a.duration, 10) * 60000));
                return (newDate < existingEndTime && newEndTime > existingDate);
            });

            if (conflictingAppointment) throw new Error(`Error: This time slot conflicts with another appointment for ${newTechnician}.`);

            const appointmentsOnDay = allAppointments
                .filter(a => a.technician === newTechnician && parseSheetDate(a.appointmentDate).toDateString() === newDate.toDateString() && a.id !== apptId)
                .sort((a, b) => parseSheetDate(a.appointmentDate) - parseSheetDate(b.appointmentDate));

            let previousAppointmentZip = (allTechCoverage.find(t => t.nome === newTechnician) || {}).zip_code || null;
            for (const appt of appointmentsOnDay) {
                if (parseSheetDate(appt.appointmentDate) < newDate) {
                    previousAppointmentZip = appt.zipCode;
                }
            }
            
            const appointmentToUpdate = allAppointments.find(a => a.id === apptId);
            const newTravelTime = await getTravelTime(previousAppointmentZip, appointmentToUpdate.zipCode);

            const apiFormattedDate = `${String(newDate.getMonth() + 1).padStart(2, '0')}/${String(newDate.getDate()).padStart(2, '0')}/${newDate.getFullYear()} ${getTimeHHMM(newDate)}`;

            const dataToUpdate = {
                rowIndex: apptId, appointmentDate: apiFormattedDate, verification: newVerification,
                technician: newTechnician, pets: newPets, margin: newMargin, travelTime: newTravelTime,
            };

            const response = await fetch('/api/update-appointment-showed-data', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToUpdate),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            document.dispatchEvent(new CustomEvent('appointmentUpdated'));

        } catch (error) {
            alert(`Error saving appointment: ${error.message}`);
        } finally {
            modalSaveBtn.disabled = false;
            modalSaveBtn.textContent = 'Save Changes';
            closeEditModal();
        }
    }
    
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

        TIME_SLOTS.forEach((time, rowIndex) => {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'time-slot timeline-header p-2 text-xs font-medium border-t border-border flex items-center justify-center';
            timeDiv.textContent = time;
            timeDiv.style.gridRow = `${rowIndex + 1} / span 1`;
            schedulerBody.appendChild(timeDiv);
        });
        
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

        if (selectedTechnician) {
            renderAppointments();
            renderTimeBlocks();
        }
    }

    function renderAppointments() {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const appointmentsToRender = allAppointments.filter(appt => appt.technician.trim() === selectedTechnician.trim());
        
        appointmentsToRender.forEach(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate || apptDate < currentWeekStart || apptDate >= weekEnd) return;
            const dayContainer = schedulerBody.querySelector(`[data-date-key="${formatDateToYYYYMMDD(apptDate)}"]`);
            if (!dayContainer) return;
            const startHour = apptDate.getHours();
            if (startHour < MIN_HOUR || startHour >= MAX_HOUR) return;
            const topOffset = (startHour - MIN_HOUR) * SLOT_HEIGHT_PX + (apptDate.getMinutes() / 60 * SLOT_HEIGHT_PX);
            const totalDuration = parseInt(appt.duration, 10) || 120;
            const blockHeight = (totalDuration / 60) * SLOT_HEIGHT_PX;
            const block = document.createElement('div');
            let appointmentBgColor = 'bg-custom-primary';
            if (appt.verification === 'Canceled') appointmentBgColor = 'bg-cherry-red';
            else if (appt.verification === 'Showed') appointmentBgColor = 'bg-green-600';
            else if (appt.verification === 'Confirmed') { appointmentBgColor = 'bg-yellow-confirmed'; }
            block.className = `appointment-block rounded-md shadow-soft cursor-pointer transition-colors hover:shadow-lg`;
            block.dataset.id = appt.id;
            block.style.top = `${topOffset}px`;
            block.style.height = `${blockHeight}px`;
            const endTime = new Date(apptDate.getTime() + totalDuration * 60 * 1000);
            block.innerHTML = `...`; // Otimizado para não colar código muito longo aqui
            block.addEventListener('click', () => openEditModal(appt));
            dayContainer.appendChild(block);
        });
    }

    function renderTimeBlocks() { /* ...código da versão anterior... */ }
    function updateWeekDisplay() { /* ...código da versão anterior... */ }

    // --- 9. Inicialização e Lógica de Controle ---
    async function loadInitialData(isReload = false) {
        if (!isReload) loadingOverlay.classList.remove('hidden');

        try {
            const [techResult, apptResult, coverageResult] = await Promise.all([
                fetch('/api/get-dashboard-data').then(res => res.json()),
                fetch('/api/get-technician-appointments').then(res => res.json()),
                fetch('/api/get-tech-coverage').then(res => res.json())
            ]);
            allTechnicians = (techResult.technicians || []).map(t => t.trim()).filter(Boolean);
            allAppointments = (apptResult.appointments || []).filter(a => a.appointmentDate && parseSheetDate(a.appointmentDate));
            allTechCoverage = coverageResult || [];
        } catch (error) {
            console.error('A critical error occurred during data loading:', error);
        } finally {
            if (!isReload) populateTechSelects();
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
        if (allTechnicians.includes(currentSelection)) techSelectDropdown.value = currentSelection;
    }

    async function handleTechSelectionChange(event) {
        selectedTechnician = event.target.value;
        if (selectedTechnician) {
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">${selectedTechnician}</p> <p class="text-sm text-muted-foreground">Schedule and details below.</p>`;
            await fetchAvailabilityForSelectedTech();
        } else {
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">No Technician Selected</p><p class="text-sm text-muted-foreground">Select a technician from the top bar.</p>`;
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
    prevWeekBtn.addEventListener('click', () => { currentWeekStart.setDate(currentWeekStart.getDate() - 7); updateAllComponents(); renderMiniCalendar(); });
    nextWeekBtn.addEventListener('click', () => { currentWeekStart.setDate(currentWeekStart.getDate() + 7); updateAllComponents(); renderMiniCalendar(); });
    todayBtn.addEventListener('click', () => { currentWeekStart = getStartOfWeek(new Date()); miniCalDate = new Date(); updateAllComponents(); renderMiniCalendar(); });
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
