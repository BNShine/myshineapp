// public/calendar/itinerary.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos ---
    const dayFilter = document.getElementById('day-filter');
    const dayItineraryTableBody = document.getElementById('day-itinerary-table-body');
    const optimizeItineraryBtn = document.getElementById('optimize-itinerary-btn');
    const itineraryReverserBtn = document.getElementById('itinerary-reverser-btn');
    const itineraryResultsList = document.getElementById('itinerary-results-list');
    const schedulingControls = document.getElementById('scheduling-controls');
    const firstScheduleSelect = document.getElementById('first-schedule-select');
    const applyRouteBtn = document.getElementById('apply-route-btn');

    // --- Variáveis de Estado Locais ---
    let localAppointments = [];
    let localTechCoverage = [];
    let dayAppointments = [];
    let orderedClientStops = [];
    let localCurrentWeekStart = new Date();
    let localSelectedTechnician = '';

    // --- Funções Auxiliares ---
    function getStartOfWeek(date) { /* ...código da versão anterior... */ }
    function getDayOfWeekDate(startOfWeekDate, dayOfWeek) { /* ...código da versão anterior... */ }
    function formatDateToYYYYMMDD(date) { /* ...código da versão anterior... */ }
    function parseSheetDate(dateStr) { /* ...código da versão anterior... */ }
    function getTimeHHMM(date) { /* ...código da versão anterior... */ }
    async function getLatLon(zipCode) { /* ...código da versão anterior... */ }
    function calculateDistance(lat1, lon1, lat2, lon2) { /* ...código da versão anterior... */ }
    async function getTravelTime(originZip, destinationZip) { /* ...código da versão anterior... */ }

    // --- Lógica Principal ---
    function renderDayItineraryTable() {
        if (!dayItineraryTableBody) return;
        dayItineraryTableBody.innerHTML = '';
        itineraryResultsList.innerHTML = 'No route calculated.';
        schedulingControls.classList.add('hidden');
        
        const selectedDayOfWeek = dayFilter.value;
        optimizeItineraryBtn.disabled = true;
        itineraryReverserBtn.disabled = true;

        if (!localSelectedTechnician || selectedDayOfWeek === '') {
            dayItineraryTableBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-muted-foreground">Select a day and a technician to view appointments.</td></tr>';
            return;
        }

        const targetDate = getDayOfWeekDate(localCurrentWeekStart, parseInt(selectedDayOfWeek, 10));
        dayAppointments = (localAppointments || []).filter(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            return appt.technician === localSelectedTechnician && apptDate && apptDate.toDateString() === targetDate.toDateString();
        }).sort((a, b) => (parseSheetDate(a.appointmentDate)?.getTime() || 0) - (parseSheetDate(b.appointmentDate)?.getTime() || 0));

        if (dayAppointments.length === 0) {
            dayItineraryTableBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-muted-foreground">No appointments found for the selected day.</td></tr>';
            return;
        }
        
        dayAppointments.forEach(appt => {
            const row = document.createElement('tr');
            row.className = 'border-b border-border hover:bg-muted/50';
            const apptDate = parseSheetDate(appt.appointmentDate);
            row.innerHTML = `
                <td class="p-4 font-bold">${getTimeHHMM(apptDate)}</td>
                <td class="p-4">${appt.customers}</td>
                <td class="p-4">${appt.phone || ''}</td>
                <td class="p-4">${appt.zipCode || 'N/A'}</td>
                <td class="p-4">${appt.code || ''}</td>
                <td class="p-4">${appt.verification || ''}</td>
                <td class="p-4">${appt.technician || ''}</td>
            `;
            dayItineraryTableBody.appendChild(row);
        });

        if (dayAppointments.some(appt => appt.zipCode && appt.verification !== 'Confirmed')) {
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
        }
    }

    async function runItineraryOptimization(isReversed = false) { /* ...código da versão anterior... */ }
    async function handleApplyRoute() { /* ...código da versão anterior... */ }
    function populateTimeSlotsDropdown() { /* ...código da versão anterior... */ }

    // --- OUVINTES DE EVENTOS GLOBAIS ---
    document.addEventListener('stateUpdated', (e) => {
        localAppointments = e.detail.allAppointments;
        localTechCoverage = e.detail.allTechCoverage;
        localSelectedTechnician = e.detail.technician;
        localCurrentWeekStart = e.detail.weekStart;
        renderDayItineraryTable();
    });
    
    // Bind dos botões locais
    if (dayFilter) dayFilter.addEventListener('change', renderDayItineraryTable);
    if (optimizeItineraryBtn) optimizeItineraryBtn.addEventListener('click', () => runItineraryOptimization(false));
    if (itineraryReverserBtn) itineraryReverserBtn.addEventListener('click', () => runItineraryOptimization(true));
    if (applyRouteBtn) applyRouteBtn.addEventListener('click', handleApplyRoute);
    
    populateTimeSlotsDropdown();
});
