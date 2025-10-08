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
    
    const editModal = document.getElementById('edit-appointment-modal');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalApptId = document.getElementById('modal-appt-id');
    const modalDate = document.getElementById('modal-date');
    const modalVerificationSelect = document.getElementById('modal-verification');

    // --- Variáveis Globais ---
    let allAppointments = [];
    let allTechnicians = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());

    const SLOT_HEIGHT_PX = 60;
    const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MIN_HOUR = 7;

    // --- LÓGICA PRINCIPAL ---

    function renderScheduler() {
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        schedulerBody.innerHTML = ''; 

        TIME_SLOTS.forEach((time, rowIndex) => {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'time-slot timeline-header p-2 text-xs font-medium border-t border-border flex items-center justify-center';
            timeDiv.textContent = time;
            schedulerBody.appendChild(timeDiv);

            DAY_NAMES.forEach((_, dayIndex) => {
                const line = document.createElement('div');
                line.className = 'border-t border-border/50';
                line.style.gridRow = `${rowIndex + 1} / span 1`;
                line.style.gridColumn = `${dayIndex + 2} / span 1`;
                schedulerBody.appendChild(line);
            });
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
            return appt.technician === selectedTechnician && apptDate && apptDate >= currentWeekStart && apptDate < weekEnd;
        });

        appointmentsToRender.forEach(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate) return;

            const dateKey = formatDateToYYYYMMDD(apptDate);
            const dayContainer = schedulerBody.querySelector(`[data-date-key="${dateKey}"]`);
            if (!dayContainer) return;

            const topOffset = (apptDate.getHours() - MIN_HOUR) * SLOT_HEIGHT_PX + apptDate.getMinutes();
            const totalDuration = parseInt(appt.duration, 10) || 120;
            const travelTime = parseInt(appt.travelTime, 10) || 0;
            const marginTime = parseInt(appt.margin, 10) || 0;
            const appointmentTime = Math.max(0, totalDuration - travelTime - marginTime);

            const container = document.createElement('div');
            container.className = 'appointment-block rounded-md shadow-soft cursor-pointer overflow-hidden';
            container.dataset.id = appt.id;
            container.style.top = `${topOffset}px`;
            container.style.height = `${totalDuration}px`;
            
            container.addEventListener('click', () => openEditModal(appt));

            if (travelTime > 0) {
                const travelBlock = document.createElement('div');
                travelBlock.style.height = `${travelTime}px`;
                travelBlock.style.backgroundColor = '#fecde6';
                travelBlock.title = 'Travel time';
                container.appendChild(travelBlock);
            }

            if (appointmentTime > 0) {
                const mainBlock = document.createElement('div');
                mainBlock.className = 'flex-grow p-2 text-white';
                mainBlock.style.backgroundColor = '#ff5a96';
                mainBlock.title = 'Appointment';
                mainBlock.innerHTML = `
                    <p class="text-xs font-bold truncate">${appt.customers}</p>
                    <p class="text-xs opacity-90">${appt.verification}</p>
                    <p class="text-xs opacity-90">Pets: ${appt.pets}</p>
                `;
                container.appendChild(mainBlock);
            }

            if (marginTime > 0) {
                const marginBlock = document.createElement('div');
                marginBlock.style.height = `${marginTime}px`;
                marginBlock.style.backgroundColor = '#c7336f';
                marginBlock.title = 'Scheduling margin';
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
            allAppointments = apptsData.appointments || [];

            populateTechSelects();
            renderScheduler(); 
            document.dispatchEvent(new Event('initialDataLoaded'));
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

    function openEditModal(appt) {
        modalApptId.value = appt.id;
        modalDate.value = formatDateTimeForInput(appt.appointmentDate);
        
        modalVerificationSelect.innerHTML = '';
        const options = ["Scheduled", "Confirmed", "Showed", "Canceled"];
        options.forEach(opt => {
            const optionEl = document.createElement('option');
            optionEl.value = opt;
            optionEl.textContent = opt;
            if (appt.verification === opt) {
                optionEl.selected = true;
            }
            modalVerificationSelect.appendChild(optionEl);
        });

        editModal.classList.remove('hidden');
    }

    function closeEditModal() {
        editModal.classList.add('hidden');
    }

    async function handleSaveAppointment() {
        const id = modalApptId.value;
        const appointmentToUpdate = allAppointments.find(a => a.id.toString() === id);
        
        const newDate = modalDate.value.replace('T', ' ');
        const [datePart] = newDate.split(' ');
        const [year, month, day] = datePart.split('-');
        const apiFormattedDate = `${month}/${day}/${year} ${newDate.split(' ')[1] || ''}`.trim();

        const dataToUpdate = {
            rowIndex: parseInt(id),
            appointmentDate: apiFormattedDate,
            verification: modalVerificationSelect.value,
            technician: appointmentToUpdate.technician,
            petShowed: appointmentToUpdate.petShowed,
            serviceShowed: appointmentToUpdate.serviceShowed,
            tips: appointmentToUpdate.tips,
            percentage: appointmentToUpdate.percentage,
            paymentMethod: appointmentToUpdate.paymentMethod,
        };
        
        try {
            modalSaveBtn.disabled = true;
            const response = await fetch('/api/update-appointment-showed-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToUpdate),
            });
            if(!response.ok) throw new Error('Failed to save.');
            
            // Recarrega todos os dados para garantir consistência
            await loadInitialData();
        } catch(error) { 
            alert('Error saving appointment.');
            console.error(error);
        } finally {
            modalSaveBtn.disabled = false;
            closeEditModal();
        }
    }

    techSelectDropdown.addEventListener('change', (e) => {
        selectedTechnician = e.target.value;
        if(selectedTechnician) {
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">${selectedTechnician}</p><p class="text-sm text-muted-foreground">Schedule loaded.</p>`;
        } else {
            selectedTechDisplay.innerHTML = `<p class="font-bold">No Technician</p><p class="text-sm text-muted-foreground">Select a technician.</p>`;
        }
        renderScheduler();
        document.dispatchEvent(new CustomEvent('technicianChanged', { detail: { technician: selectedTechnician, allAppointments, currentWeekStart } }));
    });
    
    const navigateWeek = (direction) => {
        currentWeekStart.setDate(currentWeekStart.getDate() + (7 * direction));
        currentWeekStart = new Date(currentWeekStart);
        renderScheduler();
        document.dispatchEvent(new CustomEvent('weekChanged', { detail: { currentWeekStart, allAppointments, selectedTechnician } }));
    };

    prevWeekBtn.addEventListener('click', () => navigateWeek(-1));
    nextWeekBtn.addEventListener('click', () => navigateWeek(1));
    todayBtn.addEventListener('click', () => {
        currentWeekStart = getStartOfWeek(new Date());
        renderScheduler();
        document.dispatchEvent(new CustomEvent('weekChanged', { detail: { currentWeekStart, allAppointments, selectedTechnician } }));
    });
    
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    modalCancelBtn.addEventListener('click', closeEditModal);

    loadInitialData();
});
