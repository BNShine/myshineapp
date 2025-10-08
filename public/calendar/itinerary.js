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
    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        return d;
    }

    function getDayOfWeekDate(startOfWeekDate, dayOfWeek) {
        const date = new Date(startOfWeekDate);
        date.setDate(date.getDate() + parseInt(dayOfWeek, 10));
        return date;
    }

    function formatDateToYYYYMMDD(date) {
        if (!(date instanceof Date) || isNaN(date)) return '';
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

    async function getLatLon(zipCode) {
        if (!zipCode) return [null, null];
        try {
            const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
            if (!response.ok) return [null, null];
            const data = await response.json();
            const place = data.places[0];
            return [parseFloat(place.latitude), parseFloat(place.longitude)];
        } catch (error) {
            console.error('Erro ao buscar dados de zip code:', error);
            return [null, null];
        }
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2));
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

    // --- Lógica Principal ---
    function renderDayItineraryTable() {
        if (!dayItineraryTableBody) return;
        dayItineraryTableBody.innerHTML = '';
        itineraryResultsList.innerHTML = 'No route calculated.';
        if (schedulingControls) schedulingControls.classList.add('hidden');
        
        const selectedDayOfWeek = dayFilter.value;
        optimizeItineraryBtn.disabled = true;
        itineraryReverserBtn.disabled = true;

        if (!localSelectedTechnician || selectedDayOfWeek === '') {
            dayItineraryTableBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-muted-foreground">Select a day and a technician to view appointments.</td></tr>';
            return;
        }

        const targetDate = getDayOfWeekDate(localCurrentWeekStart, selectedDayOfWeek);
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

    async function runItineraryOptimization(isReversed = false) {
        if (!itineraryResultsList) return;
        itineraryResultsList.innerHTML = 'Calculating route...';
        optimizeItineraryBtn.disabled = true;
        itineraryReverserBtn.disabled = true;
        
        const selectedTechObj = localTechCoverage.find(t => t.nome === localSelectedTechnician);
        const originZip = selectedTechObj?.zip_code;

        if (!originZip) {
            itineraryResultsList.innerHTML = '<p class="text-red-600 font-bold">Technician origin Zip Code not found.</p>';
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
            return;
        }

        const validAppointments = [];
        for (const appt of dayAppointments) {
            if (appt.zipCode && appt.verification !== 'Confirmed') {
                const [lat, lon] = await getLatLon(appt.zipCode);
                if (lat !== null) validAppointments.push({ ...appt, lat, lon });
            }
        }

        if (validAppointments.length < 1) {
            itineraryResultsList.innerHTML = '<p class="text-red-600">No optimizable appointments found for this day.</p>';
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
            return;
        }
        
        const [originLat, originLon] = await getLatLon(originZip);
        if (originLat === null) {
            itineraryResultsList.innerHTML = '<p class="text-red-600">Could not get coordinates for technician origin Zip Code.</p>';
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
            return;
        }

        let orderedPath = [];
        let unvisited = [...validAppointments];
        let currentLat = originLat, currentLon = originLon;

        while (unvisited.length > 0) {
            let nextStop = unvisited.reduce((closest, current) => {
                const dist = calculateDistance(currentLat, currentLon, current.lat, current.lon);
                if (dist < closest.minDistance) return { minDistance: dist, client: current };
                return closest;
            }, { minDistance: Infinity, client: null });
            
            if (isReversed) {
                 nextStop = unvisited.reduce((farthest, current) => {
                    const dist = calculateDistance(currentLat, currentLon, current.lat, current.lon);
                    if (dist > farthest.maxDistance) return { maxDistance: dist, client: current };
                    return farthest;
                }, { maxDistance: -1, client: null });
            }
            
            orderedPath.push(nextStop.client);
            currentLat = nextStop.client.lat;
            currentLon = nextStop.client.lon;
            unvisited = unvisited.filter(c => c.id !== nextStop.client.id);
        }

        const waypointsForApi = orderedPath.map(stop => ({
            id: stop.id,
            zipCode: stop.zipCode,
            customerName: stop.customers
        }));

        try {
            const response = await fetch('/api/optimize-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originZip: originZip,
                    waypoints: waypointsForApi,
                    isReversed: !isReversed 
                }),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            const route = result.routeData.routes[0];
            itineraryResultsList.innerHTML = `<p class="font-bold text-lg">Optimized Route (${isReversed ? 'Farthest First' : 'Nearest First'}):</p>`;
            let totalDuration = 0, totalDistance = 0;
            
            const finalOrder = route.waypoint_order ? route.waypoint_order.map(i => waypointsForApi[i]) : waypointsForApi;
            orderedClientStops = finalOrder;
            
            route.legs.forEach((leg, i) => {
                const clientName = (finalOrder[i] || { customerName: "Return to Origin" }).customerName;
                itineraryResultsList.innerHTML += `<div class="border-b border-muted py-2"><p class="font-bold text-base">${i + 1}. Go to: ${leg.end_address} (${clientName})</p><p class="ml-4 text-sm">Travel: ${leg.duration.text} | ${leg.distance.text}</p></div>`;
                totalDuration += leg.duration.value;
                totalDistance += leg.distance.value;
            });

            itineraryResultsList.innerHTML += `<div class="mt-4 font-bold text-lg text-brand-primary">Total Travel: ${Math.round(totalDuration / 60)} min / ${(totalDistance / 1000 * 0.621371).toFixed(1)} mi</div>`;
            schedulingControls.classList.remove('hidden');
            applyRouteBtn.disabled = false;
        } catch (error) {
            itineraryResultsList.innerHTML = `<p class="text-red-600 font-bold">Error calculating route: ${error.message}</p>`;
        } finally {
            optimizeItineraryBtn.disabled = false;
            itineraryReverserBtn.disabled = false;
        }
    }

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
