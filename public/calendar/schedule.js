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
    function renderMiniCalendar() { /* ...código existente... */ }

    // --- 5. Funções de Manipulação dos Modais ---
    function openEditModal(appt) { /* ...código existente... */ }
    function closeEditModal() { /* ...código existente... */ }
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

        // Validação básica
        if (isNaN(newDate.getTime())) {
            alert("Invalid date/time selected.");
            modalSaveBtn.disabled = false;
            modalSaveBtn.textContent = 'Save Changes';
            return;
        }

        // Lógica de verificação de conflito
        const newDuration = (newPets * 60) + newMargin; // Duração sem viagem
        const newEndTime = new Date(newDate.getTime() + newDuration * 60000);

        const conflictingAppointment = allAppointments.find(a => {
            if (a.id === apptId || a.technician !== newTechnician) return false;
            const existingDate = parseSheetDate(a.appointmentDate);
            const existingEndTime = new Date(existingDate.getTime() + a.duration * 60000);
            return (newDate < existingEndTime && newEndTime > existingDate);
        });

        if (conflictingAppointment) {
            alert(`Error: This time slot conflicts with another appointment for ${newTechnician}.`);
            modalSaveBtn.disabled = false;
            modalSaveBtn.textContent = 'Save Changes';
            return;
        }

        // Recalcular Travel Time
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

        const finalDuration = newTravelTime + newDuration;
        const apiFormattedDate = `${String(newDate.getMonth() + 1).padStart(2, '0')}/${String(newDate.getDate()).padStart(2, '0')}/${newDate.getFullYear()} ${getTimeHHMM(newDate)}`;

        const dataToUpdate = {
            rowIndex: apptId,
            appointmentDate: apiFormattedDate,
            verification: newVerification,
            technician: newTechnician,
            pets: newPets,
            margin: newMargin,
            travelTime: newTravelTime,
            // Outros campos não editáveis são enviados para a API se necessário
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
            // Recarrega todos os dados para refletir as mudanças, incluindo o recálculo da agenda
            await loadInitialData();

        } catch (error) {
            alert(`Error saving appointment: ${error.message}`);
        } finally {
            modalSaveBtn.disabled = false;
            modalSaveBtn.textContent = 'Save Changes';
        }
    }

    async function handleSaveTimeBlock() { /* ...código existente... */ }
    async function handleUpdateTimeBlock() { /* ...código existente... */ }
    async function handleDeleteTimeBlock() { /* ...código existente... */ }
    async function fetchAvailabilityForSelectedTech() { /* ...código existente... */ }

    // --- 7. Funções de Renderização ---
    function renderScheduler() { /* ...código existente... */ }
    function renderAppointments() { /* ...código existente... */ }
    function renderTimeBlocks() { /* ...código existente... */ }
    function updateWeekDisplay() { /* ...código existente... */ }

    // --- 8. Inicialização e Event Listeners ---
    async function loadInitialData() {
        try {
            const [techDataResponse, appointmentsResponse, techCoverageResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-technician-appointments'),
                fetch('/api/get-tech-coverage')
            ]);
            
            if (!techDataResponse.ok) throw new Error('Failed to load technician data.');
            
            const techData = await techDataResponse.json();
            allTechnicians = techData.technicians || [];
            
            if (appointmentsResponse.ok) {
                const apptsData = await appointmentsResponse.json();
                allAppointments = (apptsData.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            }

            if(techCoverageResponse.ok) {
                allTechCoverage = await techCoverageResponse.json();
            }
            
            populateTechSelects();
            renderScheduler();
            renderMiniCalendar();

        } catch (error) {
            console.error('[FRONTEND CRITICAL ERROR] during `loadInitialData`:', error);
        }
    }

    function populateTechSelects() { /* ...código existente... */ }
    async function handleTechSelectionChange(event) { /* ...código existente... */ }

    techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    prevWeekBtn.addEventListener('click', () => { /* ...código existente... */ });
    nextWeekBtn.addEventListener('click', () => { /* ...código existente... */ });
    todayBtn.addEventListener('click', () => { /* ...código existente... */ });
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    modalCancelBtn.addEventListener('click', closeEditModal);
    addTimeBlockBtn.addEventListener('click', openTimeBlockModal);
    blockSaveBtn.addEventListener('click', handleSaveTimeBlock);
    blockCancelBtn.addEventListener('click', closeTimeBlockModal);
    editBlockSaveBtn.addEventListener('click', handleUpdateTimeBlock);
    editBlockDeleteBtn.addEventListener('click', handleDeleteTimeBlock);
    editBlockCancelBtn.addEventListener('click', closeEditTimeBlockModal);

    document.addEventListener('appointmentUpdated', async () => {
        await loadInitialData();
        renderScheduler();
    });

    loadInitialData();
});
