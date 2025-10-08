// public/calendar/itinerary.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- Seletores e Variáveis ---
    const dayFilter = document.getElementById('day-filter');
    const dayItineraryTableBody = document.getElementById('day-itinerary-table-body');
    const optimizeItineraryBtn = document.getElementById('optimize-itinerary-btn');
    const itineraryReverserBtn = document.getElementById('itinerary-reverser-btn');
    const itineraryResultsList = document.getElementById('itinerary-results-list');
    const schedulingControls = document.getElementById('scheduling-controls');
    const firstScheduleSelect = document.getElementById('first-schedule-select');
    const applyRouteBtn = document.getElementById('apply-route-btn');

    let allAppointments = [];
    let dayAppointments = [];
    let techAvailabilityBlocks = [];
    let allTechCoverage = [];
    let orderedClientStops = [];
    let currentWeekStart = getStartOfWeek(new Date());
    let selectedTechnician = '';

    const MIN_HOUR = 7;
    const MAX_HOUR = 21;

    // --- Funções Auxiliares (incluindo getTravelTime) ---
    function getStartOfWeek(date) { /* ...código existente... */ }
    function formatDateToYYYYMMDD(date) { /* ...código existente... */ }
    function parseSheetDate(dateStr) { /* ...código existente... */ }
    function getTimeHHMM(date) { /* ...código existente... */ }
    function getDayOfWeekDate(startOfWeekDate, dayOfWeek) { /* ...código existente... */ }
    async function getLatLon(zipCode) { /* ...código existente... */ }
    function calculateDistance(lat1, lon1, lat2, lon2) { /* ...código existente... */ }
    async function getTravelTime(originZip, destinationZip) { /* ...código existente... */ }
    
    // --- Lógica da Aplicação da Rota ---
    function populateTimeSlotsDropdown() { /* ...código existente... */ }
    
    async function handleApplyRoute() {
        const selectedStartTime = firstScheduleSelect.value;
        const selectedDay = dayFilter.value;
        
        if (!selectedStartTime || selectedDay === '' || orderedClientStops.length === 0) {
            alert("Please optimize a route and select a start time first.");
            return;
        }

        applyRouteBtn.disabled = true;
        applyRouteBtn.textContent = "Applying...";
        
        const targetDate = getDayOfWeekDate(currentWeekStart, parseInt(selectedDay, 10));
        
        let techOriginZip = allTechCoverage.find(t => t.nome === selectedTechnician)?.zip_code;
        if (!techOriginZip) {
            alert('Technician origin zip code not found. Cannot calculate route.');
            applyRouteBtn.disabled = false;
            applyRouteBtn.textContent = "Apply Route";
            return;
        }

        const updatePromises = [];
        let lastEventEndTime = new Date(targetDate);
        const [startHour, startMinute] = selectedStartTime.split(':').map(Number);
        lastEventEndTime.setHours(startHour, startMinute, 0, 0);
        
        let lastZipCode = techOriginZip;

        for (const stop of orderedClientStops) {
            const appointmentToUpdate = allAppointments.find(a => a.id === stop.id);
            if (appointmentToUpdate) {
                
                const travelTime = await getTravelTime(lastZipCode, appointmentToUpdate.zipCode);
                const newStartTime = new Date(lastEventEndTime.getTime()); 
                
                const pets = parseInt(appointmentToUpdate.pets, 10) || 1;
                const margin = parseInt(appointmentToUpdate.margin, 10) || 30;
                const serviceDuration = pets * 60;
                
                const totalBlockDuration = travelTime + serviceDuration + margin;
                const newEndTime = new Date(newStartTime.getTime() + totalBlockDuration * 60000);
                
                const apiDateTime = `${String(newStartTime.getMonth() + 1).padStart(2, '0')}/${String(newStartTime.getDate()).padStart(2, '0')}/${newStartTime.getFullYear()} ${getTimeHHMM(newStartTime)}`;

                const dataToUpdate = {
                    rowIndex: appointmentToUpdate.id,
                    appointmentDate: apiDateTime,
                    technician: appointmentToUpdate.technician,
                    pets: pets,
                    margin: margin,
                    travelTime: travelTime,
                    verification: appointmentToUpdate.verification,
                };
                        
                const promise = fetch('/api/update-appointment-showed-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToUpdate),
                }).then(res => res.json());

                updatePromises.push(promise);
                
                lastEventEndTime = newEndTime;
                lastZipCode = appointmentToUpdate.zipCode;
            }
        }

        try {
            const results = await Promise.all(updatePromises);
            const allSuccess = results.every(res => res.success);

            if (allSuccess) {
                alert("Route applied and all appointments updated successfully!");
                document.dispatchEvent(new CustomEvent('appointmentUpdated', { detail: { shouldReload: true } }));
            } else {
                throw new Error("Some appointments could not be updated.");
            }
        } catch (error) {
            console.error("Error applying route:", error);
            alert(`An error occurred: ${error.message}`);
        } finally {
            applyRouteBtn.disabled = false;
            applyRouteBtn.textContent = "Apply Route";
        }
    }

    // --- Renderização e Otimização ---
    function renderDayItineraryTable() { /* ...código existente... */ }
    async function runItineraryOptimization(isReversed = false) { /* ...código existente... */ }

    // --- Inicialização e Event Listeners ---
    async function loadItineraryData() {
        try {
            const [appointmentsResponse, techCoverageResponse] = await Promise.all([
                fetch('/api/get-technician-appointments').catch(e => ({ error: e })),
                fetch('/api/get-tech-coverage').catch(e => ({ error: e }))
            ]);

            if (appointmentsResponse && appointmentsResponse.ok) {
                const data = await appointmentsResponse.json();
                allAppointments = (data.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            } else {
                console.error('Itinerary: Failed to load appointments.');
                allAppointments = [];
            }
            
            if (techCoverageResponse && techCoverageResponse.ok) {
                allTechCoverage = await techCoverageResponse.json();
            } else {
                console.error('Itinerary: Failed to load tech coverage.');
                allTechCoverage = [];
            }
        } catch (error) {
            console.error('Error loading initial data for itinerary:', error);
            allAppointments = [];
            allTechCoverage = [];
        } finally {
            renderDayItineraryTable();
        }
    }
    
    async function fetchAvailabilityForSelectedTech(technicianName) {
        if (!technicianName) {
            techAvailabilityBlocks = [];
            return;
        }
        try {
            const response = await fetch(`/api/manage-technician-availability?technicianName=${encodeURIComponent(technicianName)}`);
            if (!response.ok) throw new Error('Could not fetch availability.');
            const data = await response.json();
            techAvailabilityBlocks = data.availability || [];
        } catch (error) {
            console.error('Error fetching availability:', error);
            techAvailabilityBlocks = [];
        }
    }
    
    document.addEventListener('technicianChanged', async (e) => {
        selectedTechnician = e.detail.technician;
        currentWeekStart = e.detail.weekStart;
        await fetchAvailabilityForSelectedTech(selectedTechnician);
        await loadItineraryData(); 
    });

    document.addEventListener('weekChanged', (e) => {
        currentWeekStart = e.detail.weekStart;
        renderDayItineraryTable();
    });
    
    document.addEventListener('appointmentUpdated', async () => { await loadItineraryData(); });

    if (dayFilter) dayFilter.addEventListener('change', renderDayItineraryTable);
    if (optimizeItineraryBtn) optimizeItineraryBtn.addEventListener('click', () => runItineraryOptimization(false));
    if (itineraryReverserBtn) itineraryReverserBtn.addEventListener('click', () => runItineraryOptimization(true));
    if (applyRouteBtn) applyRouteBtn.addEventListener('click', handleApplyRoute);
    
    loadItineraryData();
    populateTimeSlotsDropdown();
});
