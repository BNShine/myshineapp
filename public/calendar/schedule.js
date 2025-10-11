// public/calendar/schedule.js (Controlador Principal Refatorado e Otimizado)

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. Seletores de Elementos Principais ---
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
    const dragDropToggle = document.getElementById('drag-drop-toggle');

    // --- 2. Variáveis Globais de Estado ---
    let allAppointments = [];
    let allTechnicians = [];
    let allTechCoverage = [];
    let techAvailabilityBlocks = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());
    let miniCalDate = new Date();
    let isDragDropEnabled = false;

    // --- 3. Constantes ---
    const SLOT_HEIGHT_PX = 60;
    const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MIN_HOUR = 7;
    const MAX_HOUR = 21;
    
    // --- 4. Lógica do Mini Calendário ---
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
        const monthName = miniCalDate.toLocaleString('en-US', { month: 'long' });
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

    // --- 5. Funções de Manipulação de Dados (API Calls) ---
    async function handleSaveAppointment() {
        const modalSaveBtn = document.getElementById('modal-save-btn');
        modalSaveBtn.disabled = true;
        modalSaveBtn.textContent = 'Saving...';

        try {
            const apptId = parseInt(document.getElementById('modal-appt-id').value, 10);
            const proposedStartDate = new Date(document.getElementById('modal-date').value);
            const newPets = parseInt(document.getElementById('modal-pets').value, 10);
            const newMargin = parseInt(document.getElementById('modal-margin').value, 10);
            const newTechnician = document.getElementById('modal-technician').value;
            const newVerification = document.getElementById('modal-verification').value;

            if (isNaN(proposedStartDate.getTime())) throw new Error("Invalid date/time selected.");

            const appointmentToUpdate = allAppointments.find(a => a.id === apptId);
            if (!appointmentToUpdate) throw new Error("Appointment not found.");
            
            const appointmentsOnDay = allAppointments
                .filter(a => a.id !== apptId && a.technician === newTechnician && parseSheetDate(a.appointmentDate).toDateString() === proposedStartDate.toDateString())
                .sort((a, b) => parseSheetDate(a.appointmentDate) - parseSheetDate(b.appointmentDate));

            const previousAppointment = appointmentsOnDay.filter(a => parseSheetDate(a.appointmentDate) < proposedStartDate).pop();
            const nextAppointment = appointmentsOnDay.find(a => parseSheetDate(a.appointmentDate) > proposedStartDate);

            const previousAppZip = previousAppointment ? previousAppointment.zipCode : (allTechCoverage.find(t => t.nome === newTechnician) || {}).zip_code;
            const newTravelTime = await getTravelTime(previousAppZip, appointmentToUpdate.zipCode);
            
            const serviceDuration = newPets * 60;
            const totalAppointmentDuration = newTravelTime + serviceDuration + newMargin;
            
            let finalStartDate = new Date(proposedStartDate);

            const previousEndTime = previousAppointment ? new Date(parseSheetDate(previousAppointment.appointmentDate).getTime() + (parseInt(previousAppointment.duration, 10) * 60000)) : null;
            const nextStartTime = nextAppointment ? parseSheetDate(nextAppointment.appointmentDate) : null;

            const proposedTravelStart = new Date(finalStartDate.getTime() - newTravelTime * 60000);
            const proposedMarginEnd = new Date(finalStartDate.getTime() + (serviceDuration + newMargin) * 60000);

            if (previousEndTime && nextStartTime && proposedTravelStart < previousEndTime && proposedMarginEnd > nextStartTime) {
                throw new Error("No available space. The new time conflicts with both the preceding and succeeding appointments.");
            }

            if (previousEndTime && proposedTravelStart < previousEndTime) {
                finalStartDate = new Date(previousEndTime.getTime() + newTravelTime * 60000);
            }
            
            const adjustedMarginEnd = new Date(finalStartDate.getTime() + (serviceDuration + newMargin) * 60000);
            if (nextStartTime && adjustedMarginEnd > nextStartTime) {
                finalStartDate = new Date(nextStartTime.getTime() - (serviceDuration + newMargin) * 60000);
            }

            if (previousEndTime && new Date(finalStartDate.getTime() - newTravelTime * 60000) < previousEndTime) {
                 throw new Error("Automatic adjustment failed. The available slot is smaller than the total duration of the appointment.");
            }

            const apiFormattedDate = `${String(finalStartDate.getMonth() + 1).padStart(2, '0')}/${String(finalStartDate.getDate()).padStart(2, '0')}/${finalStartDate.getFullYear()} ${getTimeHHMM(finalStartDate)}`;

            const dataToUpdate = {
                rowIndex: apptId, 
                appointmentDate: apiFormattedDate, 
                verification: newVerification,
                technician: newTechnician, 
                pets: newPets, 
                margin: newMargin, 
                travelTime: newTravelTime,
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
            window.closeEditModal();
        }
    }
    
    async function handleSaveTimeBlock() {
        if (!selectedTechnician) {
            alert("No technician selected.");
            return;
        }

        const dateInput = document.getElementById('block-date');
        const startHourInput = document.getElementById('block-start-hour');
        const endHourInput = document.getElementById('block-end-hour');
        const notesInput = document.getElementById('block-notes');
        const blockSaveBtn = document.getElementById('block-save-btn');

        if (!dateInput.value || !startHourInput.value || !endHourInput.value) {
            alert("Date, Start Time, and End Time are required.");
            return;
        }
        
        const [year, month, day] = dateInput.value.split('-');
        const formattedDate = `${month}/${day}/${year}`;

        const dataToSend = {
            technicianName: selectedTechnician,
            date: formattedDate,
            startHour: startHourInput.value,
            endHour: endHourInput.value,
            notes: notesInput.value || '',
        };

        blockSaveBtn.disabled = true;
        blockSaveBtn.textContent = "Saving...";

        try {
            const response = await fetch('/api/manage-technician-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            await fetchAvailabilityForSelectedTech();
            updateAllComponents();
            window.closeTimeBlockModal();
            alert("Time block saved successfully!");

        } catch (error) {
            console.error("Error saving time block:", error);
            alert(`Failed to save time block: ${error.message}`);
        } finally {
            blockSaveBtn.disabled = false;
            blockSaveBtn.textContent = "Save Block";
        }
    }

    async function handleUpdateTimeBlock() {
        const editBlockRowNumberInput = document.getElementById('edit-block-row-number');
        const editBlockDateInput = document.getElementById('edit-block-date');
        const editBlockStartInput = document.getElementById('edit-block-start-hour');
        const editBlockEndInput = document.getElementById('edit-block-end-hour');
        const editBlockNotesInput = document.getElementById('edit-block-notes');
        const editBlockSaveBtn = document.getElementById('edit-block-save-btn');
        
        const rowNumber = parseInt(editBlockRowNumberInput.value, 10);
        const dateValue = editBlockDateInput.value;
        const startHour = editBlockStartInput.value;
        const endHour = editBlockEndInput.value;
        const notes = editBlockNotesInput.value;

        if (!rowNumber || !dateValue || !startHour || !endHour) {
            alert("All fields are required to update.");
            return;
        }
        
        const [year, month, day] = dateValue.split('-');
        const formattedDate = `${month}/${day}/${year}`;

        const dataToUpdate = {
            rowNumber,
            date: formattedDate,
            startHour,
            endHour,
            notes
        };

        editBlockSaveBtn.disabled = true;
        editBlockSaveBtn.textContent = "Saving...";

        try {
            const response = await fetch('/api/manage-technician-availability', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToUpdate),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            await fetchAvailabilityForSelectedTech();
            updateAllComponents();
            window.closeEditTimeBlockModal();
            alert("Time block updated successfully!");
        } catch (error) {
            console.error("Error updating time block:", error);
            alert(`Failed to update time block: ${error.message}`);
        } finally {
            editBlockSaveBtn.disabled = false;
            editBlockSaveBtn.textContent = "Save Changes";
        }
    }

    async function handleDeleteTimeBlock() {
        const editBlockRowNumberInput = document.getElementById('edit-block-row-number');
        const editBlockDeleteBtn = document.getElementById('edit-block-delete-btn');
        
        const rowNumber = parseInt(editBlockRowNumberInput.value, 10);
        if (!rowNumber) {
            alert("Could not find the time block to delete.");
            return;
        }

        if (!confirm("Are you sure you want to delete this time block?")) {
            return;
        }

        editBlockDeleteBtn.disabled = true;
        editBlockDeleteBtn.textContent = "Deleting...";

        try {
            const response = await fetch('/api/manage-technician-availability', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowNumber }),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            await fetchAvailabilityForSelectedTech();
            updateAllComponents();
            window.closeEditTimeBlockModal();
            alert("Time block deleted successfully!");
        } catch (error) {
            console.error("Error deleting time block:", error);
            alert(`Failed to delete time block: ${error.message}`);
        } finally {
            editBlockDeleteBtn.disabled = false;
            editBlockDeleteBtn.textContent = "Delete";
        }
    }

    async function fetchAvailabilityForSelectedTech() {
        if (!selectedTechnician) {
            techAvailabilityBlocks = [];
            return;
        }
        try {
            const response = await fetch(`/api/manage-technician-availability?technicianName=${encodeURIComponent(selectedTechnician)}`);
            if (!response.ok) throw new Error('Could not fetch availability.');
            const data = await response.json();
            techAvailabilityBlocks = data.availability || [];
        } catch (error) {
            console.error('Error fetching availability:', error);
            techAvailabilityBlocks = [];
        }
    }
    
    // --- 6. Funções de Renderização e Drag & Drop ---
    function setupSchedulerGrid() {
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
            const column = dayIndex + 2;
            const header = document.createElement('div');
            header.className = 'day-column-header p-2 font-semibold border-l border-border';
            header.style.gridColumn = column;
            header.id = `header-day-${dayIndex}`; 
            schedulerHeader.appendChild(header);

            const dayContainer = document.createElement('div');
            dayContainer.className = 'relative border-r border-border';
            dayContainer.style.gridColumn = column;
            dayContainer.style.gridRow = `1 / span ${TIME_SLOTS.length}`;
            dayContainer.id = `day-container-${dayIndex}`;
            
            TIME_SLOTS.forEach((_, rowIndex) => {
                 const line = document.createElement('div');
                 line.className = 'absolute w-full border-t border-border/50';
                 line.style.height = '1px';
                 line.style.top = `${(rowIndex + 1) * SLOT_HEIGHT_PX}px`;
                 line.style.zIndex = '1';
                 dayContainer.appendChild(line);
            });
            
            dayContainer.addEventListener('dragover', (e) => {
                if(isDragDropEnabled) e.preventDefault();
            });

            dayContainer.addEventListener('drop', (e) => {
                if(!isDragDropEnabled) return;
                e.preventDefault();
                
                const apptId = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const appointment = allAppointments.find(a => a.id === apptId);
                if (!appointment) return;

                const bounds = dayContainer.getBoundingClientRect();
                const y = e.clientY - bounds.top;
                const totalMinutes = Math.round((y / SLOT_HEIGHT_PX) * 60);
                const hours = MIN_HOUR + Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                
                const [year, month, day] = dayContainer.dataset.dateKey.split('-').map(Number);
                const newDate = new Date(year, month - 1, day, hours, minutes);

                window.openEditModal(appointment, allTechnicians);
                document.getElementById('modal-date').value = formatDateTimeForInput(newDate.toISOString());
            });

            schedulerBody.appendChild(dayContainer);
        });
    }

    function renderEvents() {
        // Limpa apenas os eventos, não a estrutura do grid
        schedulerBody.querySelectorAll('.appointment-block').forEach(el => el.remove());
        
        updateDayHeaders();
        loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
        
        if (selectedTechnician) {
            renderAppointments();
            renderTimeBlocks();
        }
    }

    function updateDayHeaders() {
        DAY_NAMES.forEach((dayName, dayIndex) => {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + dayIndex);
            
            const header = document.getElementById(`header-day-${dayIndex}`);
            if(header) header.textContent = `${dayName} ${date.getDate()}`;
            
            const dayContainer = document.getElementById(`day-container-${dayIndex}`);
            if(dayContainer) dayContainer.dataset.dateKey = formatDateToYYYYMMDD(date).replace(/\//g, '-');
        });
        updateWeekDisplay();
    }


    function renderAppointments() {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const appointmentsToRender = allAppointments.filter(appt => appt.technician.trim() === selectedTechnician.trim());
        
        appointmentsToRender.forEach(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate || apptDate < currentWeekStart || apptDate >= weekEnd) return;
            const dayContainer = schedulerBody.querySelector(`[data-date-key="${formatDateToYYYYMMDD(apptDate).replace(/\//g, '-')}"]`);
            if (!dayContainer) return;

            const startHour = apptDate.getHours();
            if (startHour < MIN_HOUR || startHour >= MAX_HOUR) return;
            const topOffset = (startHour - MIN_HOUR) * SLOT_HEIGHT_PX + (apptDate.getMinutes() / 60 * SLOT_HEIGHT_PX);
            
            let appointmentBgColor = 'bg-custom-primary';
            let marginBgColor = 'bg-margin-primary';
            let travelBgColor = 'bg-travel-primary';
            let appointmentTextColor = 'text-foreground';
            let marginTextColor = 'text-foreground';

            if (appt.verification === 'Canceled') {
                appointmentBgColor = 'bg-cherry-red'; marginBgColor = 'bg-margin-red'; travelBgColor = 'bg-travel-red';
                appointmentTextColor = 'text-white'; marginTextColor = 'text-white';
            } else if (appt.verification === 'Showed') {
                appointmentBgColor = 'bg-green-600'; marginBgColor = 'bg-margin-green'; travelBgColor = 'bg-travel-green';
                appointmentTextColor = 'text-white'; marginTextColor = 'text-white';
            } else if (appt.verification === 'Confirmed') {
                appointmentBgColor = 'bg-yellow-confirmed'; marginBgColor = 'bg-margin-yellow'; travelBgColor = 'bg-travel-yellow';
                appointmentTextColor = 'text-black'; marginTextColor = 'text-black';
            } else if (appt.verification === 'Missing Data') {
                appointmentBgColor = 'bg-blue-missing-data'; marginBgColor = 'bg-margin-blue-missing-data'; travelBgColor = 'bg-travel-blue-missing-data';
                appointmentTextColor = 'text-black'; marginTextColor = 'text-black';
            }

            const totalDuration = parseInt(appt.duration, 10) || 120;
            const travelTime = parseInt(appt.travelTime, 10) || 0;
            const marginTime = parseInt(appt.margin, 10) || 0;
            const appointmentTime = Math.max(0, totalDuration - travelTime - marginTime);
            const travelPercent = totalDuration > 0 ? (travelTime / totalDuration) * 100 : 0;
            const appointmentPercent = totalDuration > 0 ? (appointmentTime / totalDuration) * 100 : 0;
            const marginPercent = totalDuration > 0 ? (marginTime / totalDuration) * 100 : 0;
            const blockHeight = (totalDuration / 60) * SLOT_HEIGHT_PX;
            const block = document.createElement('div');
            
            block.className = `appointment-block rounded-md shadow-soft transition-colors hover:shadow-lg`;
            if(isDragDropEnabled) {
                block.draggable = true;
                block.style.cursor = 'grab';
            } else {
                block.draggable = false;
                block.style.cursor = 'pointer';
            }

            block.dataset.id = appt.id;
            block.style.top = `${topOffset}px`;
            block.style.height = `${blockHeight}px`;
            const endTime = new Date(apptDate.getTime() + totalDuration * 60 * 1000);
            
            block.innerHTML = `
                ${travelTime > 0 ? `<div class="${travelBgColor} text-white" style="height: ${travelPercent}%; display: flex; align-items: center; justify-content: center; overflow: hidden;"><span class="text-xs font-semibold transform -rotate-90 origin-center whitespace-nowrap">Travel</span></div>` : ''}
                <div class="${appointmentBgColor} ${appointmentTextColor}" style="height: ${appointmentPercent}%; padding: 4px 8px; display: flex; justify-content: space-between; flex-grow: 1;">
                    <div class="flex-grow overflow-hidden">
                        <p class="text-xs font-semibold">${getTimeHHMM(apptDate)} - ${getTimeHHMM(endTime)}</p>
                        <p class="text-sm font-bold truncate">${appt.customers}</p>
                        <p class="text-xs font-medium opacity-80">${appt.verification}</p>
                        <p class="text-xs font-medium opacity-80">Pets: ${appt.pets || 'N/A'}</p>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: center;"><span class="text-xs font-semibold transform -rotate-90 origin-center whitespace-nowrap">Appointment</span></div>
                </div>
                ${marginTime > 0 ? `<div class="${marginBgColor} ${marginTextColor}" style="height: ${marginPercent}%; display: flex; align-items: center; justify-content: center; overflow: hidden;"><span class="text-xs font-semibold transform -rotate-90 origin-center whitespace-nowrap">Margin</span></div>` : ''}`;
            
            block.addEventListener('click', () => window.openEditModal(appt, allTechnicians));

            block.addEventListener('dragstart', (e) => {
                if(!isDragDropEnabled) {
                    e.preventDefault();
                    return;
                }
                e.dataTransfer.setData('text/plain', appt.id);
                e.dataTransfer.effectAllowed = 'move';
            });

            dayContainer.appendChild(block);
        });
    }

    function renderTimeBlocks() {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        techAvailabilityBlocks.forEach(block => {
            if (!block || typeof block.date !== 'string' || block.date.trim() === '') return;
            const parts = block.date.split('/');
            if (parts.length !== 3) return;
            const [M, D, Y] = parts;
            const blockDate = new Date(`${Y}-${M.padStart(2, '0')}-${D.padStart(2, '0')}T00:00:00`);

            if (isNaN(blockDate.getTime()) || blockDate < currentWeekStart || blockDate >= weekEnd) return;
            
            const dayContainer = schedulerBody.querySelector(`[data-date-key="${formatDateToYYYYMMDD(blockDate).replace(/\//g, '-')}"]`);
            if (!dayContainer) return;

            const [startH, startM] = block.startHour.split(':').map(Number);
            const [endH, endM] = block.endHour.split(':').map(Number);
            const topOffset = ((startH - MIN_HOUR) * SLOT_HEIGHT_PX) + (startM / 60 * SLOT_HEIGHT_PX);
            const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
            const height = (durationMinutes / 60) * SLOT_HEIGHT_PX;
            
            const blockEl = document.createElement('div');
            blockEl.className = 'appointment-block rounded-md';
            blockEl.style.height = `${height}px`;
            blockEl.style.backgroundColor = 'rgba(107, 114, 128, 0.7)';
            blockEl.style.zIndex = '5';
            blockEl.style.padding = '4px 8px';
            blockEl.style.top = `${topOffset}px`;
            
            if(isDragDropEnabled) {
                blockEl.draggable = true;
                blockEl.style.cursor = 'grab';
            } else {
                blockEl.draggable = false;
                blockEl.style.cursor = 'pointer';
            }

            blockEl.innerHTML = `<p class="text-xs font-semibold text-white truncate">${block.notes || 'Blocked'}</p><p class="text-xs text-white/80">${block.startHour} - ${block.endHour}</p>`;
            
            blockEl.addEventListener('click', () => window.openEditTimeBlockModal(block));
            
            blockEl.addEventListener('dragstart', (e) => {
                if(!isDragDropEnabled) {
                    e.preventDefault();
                    return;
                }
                e.dataTransfer.setData('text/plain', `block_${block.rowNumber}`);
                e.dataTransfer.effectAllowed = 'move';
            });
            
            dayContainer.appendChild(blockEl);
        });
    }

    function updateWeekDisplay() {
        if (!currentWeekDisplay || !(currentWeekStart instanceof Date)) return;
        const endOfWeek = new Date(currentWeekStart);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        currentWeekDisplay.textContent = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
    }

    // --- 7. Inicialização e Lógica de Controle ---
    async function loadInitialData(isReload = false) {
        if (!isReload) {
            loadingOverlay.classList.remove('hidden');
            setupSchedulerGrid(); // Executa a criação do grid apenas uma vez
        }
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
            if (!isReload) {
                populateTechSelects();
                renderMiniCalendar();
            }
            updateAllComponents();
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
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">No Technician Selected</p><p class="text-sm text-muted-foreground">Select a technician from the top bar to view their schedule.</p>`;
            techAvailabilityBlocks = [];
        }
        updateAllComponents();
    }

    function updateAllComponents() {
        renderEvents(); // Agora chama a função otimizada
        const eventDetail = { detail: { technician: selectedTechnician, weekStart: currentWeekStart, allAppointments, allTechCoverage } };
        document.dispatchEvent(new CustomEvent('stateUpdated', eventDetail));
    }

    // --- BINDING DOS EVENTOS ---
    if(dragDropToggle) {
        dragDropToggle.addEventListener('change', (e) => {
            isDragDropEnabled = e.target.checked;
            renderEvents(); // Re-renderiza os eventos para atualizar o estado draggable
        });
    }

    techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    
    prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        updateAllComponents();
        renderMiniCalendar();
    });
    
    nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        updateAllComponents();
        renderMiniCalendar();
    });

    todayBtn.addEventListener('click', () => {
        currentWeekStart = getStartOfWeek(new Date());
        miniCalDate = new Date();
        updateAllComponents();
        renderMiniCalendar();
    });
    
    // Listeners dos botões dos modais
    document.getElementById('modal-save-btn')?.addEventListener('click', handleSaveAppointment);
    addTimeBlockBtn?.addEventListener('click', () => window.openTimeBlockModal(selectedTechnician));
    document.getElementById('block-save-btn')?.addEventListener('click', handleSaveTimeBlock);
    document.getElementById('block-cancel-btn')?.addEventListener('click', window.closeTimeBlockModal);
    document.getElementById('edit-block-save-btn')?.addEventListener('click', handleUpdateTimeBlock);
    document.getElementById('edit-block-delete-btn')?.addEventListener('click', handleDeleteTimeBlock);
    document.getElementById('edit-block-cancel-btn')?.addEventListener('click', window.closeEditTimeBlockModal);

    document.addEventListener('appointmentUpdated', () => loadInitialData(true));

    loadInitialData();
});
