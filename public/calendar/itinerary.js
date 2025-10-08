// public/calendar/itinerary.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- Seletores de Elementos ---
    const dayFilter = document.getElementById('day-filter');
    const dayItineraryTableBody = document.getElementById('day-itinerary-table-body');
    const optimizeItineraryBtn = document.getElementById('optimize-itinerary-btn');
    const itineraryReverserBtn = document.getElementById('itinerary-reverser-btn');
    const itineraryResultsList = document.getElementById('itinerary-results-list');
    const schedulingControls = document.getElementById('scheduling-controls');
    const firstScheduleSelect = document.getElementById('first-schedule-select');
    const applyRouteBtn = document.getElementById('apply-route-btn');
    const techSelectDropdown = document.getElementById('tech-select-dropdown');

    // --- Variáveis Globais de Estado ---
    let allAppointments = [];
    let dayAppointments = [];
    let techAvailabilityBlocks = [];
    let allTechCoverage = []; // Armazena dados de cobertura dos técnicos
    let orderedClientStops = [];
    let currentWeekStart = getStartOfWeek(new Date());
    let selectedTechnician = '';

    const MIN_HOUR = 7;
    const MAX_HOUR = 21;

    // --- Funções Auxiliares ---

    // Função para obter o início da semana (domingo)
    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        return d;
    }
    
    // Formata uma data para o formato YYYY/MM/DD
    function formatDateToYYYYMMDD(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}/${month}/${day}`;
    }

    // Converte a data da planilha (MM/DD/YYYY HH:MM) para um objeto Date
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

    // Formata um objeto Date para HH:MM
    function getTimeHHMM(date) {
        if (!date) return '';
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // Obtém a data para um dia específico da semana
    function getDayOfWeekDate(startOfWeekDate, dayOfWeek) {
        const date = new Date(startOfWeekDate);
        date.setDate(startOfWeekDate.getDate() + dayOfWeek);
        return date;
    }

    // Busca latitude e longitude de um CEP (EUA)
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
    
    // Calcula a distância euclidiana simples para ordenação
    function calculateDistance(lat1, lon1, lat2, lon2) {
        return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2));
    }

    // Busca o tempo de trajeto real usando a API do Google Maps (via backend)
    async function getTravelTime(originZip, destinationZip) {
        if (!originZip || !destinationZip || originZip === destinationZip) {
            return 0;
        }
        try {
            // Usando um endpoint de backend para fazer a chamada segura à API do Google
            const response = await fetch('/api/get-travel-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originZip, destinationZip }),
            });
            const result = await response.json();
            if (result.success) {
                return result.travelTimeInMinutes;
            }
            console.warn(`Could not get travel time between ${originZip} and ${destinationZip}.`);
            return 0; // Retorna 0 se a API falhar, para não quebrar os cálculos
        } catch (error) {
            console.error("Failed to fetch travel time:", error);
            return 0; // Retorna 0 em caso de erro de rede
        }
    }
    
    // --- Lógica da Aplicação da Rota e Dropdown ---

    // Popula o dropdown com os horários de início disponíveis
    function populateTimeSlotsDropdown() {
        if (!firstScheduleSelect) return;
        firstScheduleSelect.innerHTML = ''; 

        for (let hour = MIN_HOUR; hour < MAX_HOUR; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                const option = document.createElement('option');
                option.value = timeString;
                option.textContent = timeString;
                firstScheduleSelect.appendChild(option);
            }
        }
    }
    
    // Aplica a rota otimizada aos agendamentos
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
        
        // Pega o CEP de origem do técnico
        let techOriginZip = allTechCoverage.find(t => t.nome === selectedTechnician)?.zip_code;
        if (!techOriginZip) {
            alert('Technician origin zip code not found. Cannot calculate route.');
            applyRouteBtn.disabled = false;
            applyRouteBtn.textContent = "Apply Route";
            return;
        }

        const updatePromises = [];
        let lastAppointmentEndTime = new Date(targetDate);
        const [startHour, startMinute] = selectedStartTime.split(':').map(Number);
        lastAppointmentEndTime.setHours(startHour, startMinute, 0, 0);
        
        let lastZipCode = techOriginZip;

        for (const stop of orderedClientStops) {
            const appointmentToUpdate = allAppointments.find(a => a.id === stop.id);
            if (appointmentToUpdate) {
                
                // 1. Calcula o tempo de trajeto a partir do último ponto
                const travelTime = await getTravelTime(lastZipCode, appointmentToUpdate.zipCode);
                
                // 2. O novo horário de início é o fim do último evento + tempo de trajeto
                const newStartTime = new Date(lastAppointmentEndTime.getTime());
                
                // 3. Define a duração do serviço e da margem
                const pets = parseInt(appointmentToUpdate.pets, 10) || 1;
                const margin = parseInt(appointmentToUpdate.margin, 10) || 30;
                const serviceDuration = pets * 60; // 60 minutos por pet
                const totalDurationOnSite = serviceDuration + margin;
                
                // 4. O novo horário de término considera o tempo no local
                const newEndTime = new Date(newStartTime.getTime() + totalDurationOnSite * 60000);
                
                // Formata a data para o formato esperado pela API (MM/DD/YYYY HH:MM)
                const apiDateTime = `${String(newStartTime.getMonth() + 1).padStart(2, '0')}/${String(newStartTime.getDate()).padStart(2, '0')}/${newStartTime.getFullYear()} ${getTimeHHMM(newStartTime)}`;

                // Monta o objeto para a API
                const dataToUpdate = {
                    rowIndex: appointmentToUpdate.id,
                    appointmentDate: apiDateTime,
                    technician: appointmentToUpdate.technician,
                    pets: pets,
                    margin: margin,
                    travelTime: travelTime, // Envia o tempo de trajeto calculado
                    verification: appointmentToUpdate.verification,
                };
                        
                const promise = fetch('/api/update-appointment-showed-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToUpdate),
                }).then(res => res.json());

                updatePromises.push(promise);
                
                // Atualiza as variáveis para a próxima iteração
                lastAppointmentEndTime = newEndTime;
                lastZipCode = appointmentToUpdate.zipCode;
            }
        }

        try {
            const results = await Promise.all(updatePromises);
            const allSuccess = results.every(res => res.success);

            if (allSuccess) {
                alert("Route applied and all appointments updated successfully!");
                document.dispatchEvent(new CustomEvent('appointmentUpdated'));
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


    // --- Renderização e Lógica da Rota ---
    function renderDayItineraryTable() {
        if (!dayItineraryTableBody) return;
        
        dayItineraryTableBody.innerHTML = '';
        itineraryResultsList.innerHTML = 'No route calculated.';
        schedulingControls.classList.add('hidden');

        const selectedDayOfWeek = dayFilter.value;
        
        optimizeItineraryBtn.disabled = true;
        itineraryReverserBtn.disabled = true;

        if (!selectedTechnician || selectedDayOfWeek === '') {
            dayItineraryTableBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-muted-foreground">Select a day and a technician to view appointments.</td></tr>';
            return;
        }

        const targetDate = getDayOfWeekDate(currentWeekStart, parseInt(selectedDayOfWeek, 10));
        const dateKey = formatDateToYYYYMMDD(targetDate);

        dayAppointments = allAppointments
            .filter(appt => {
                const apptDate = parseSheetDate(appt.appointmentDate);
                const apptDateKey = apptDate ? formatDateToYYYYMMDD(apptDate) : null;
                return appt.technician === selectedTechnician && apptDateKey === dateKey;
            })
            .sort((a, b) => (parseSheetDate(a.appointmentDate)?.getTime() || 0) - (parseSheetDate(b.appointmentDate)?.getTime() || 0));

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
        itineraryResultsList.innerHTML = 'Calculating route...';
        optimizeItineraryBtn.disabled = true;
        itineraryReverserBtn.disabled = true;
        
        let techCoverageData = [];
        try {
            const techCoverageResponse = await fetch('/api/get-tech-coverage');
            if (techCoverageResponse.ok) {
                techCoverageData = await techCoverageResponse.json();
            }
        } catch (e) { console.error("Could not fetch tech coverage:", e); }
        
        const selectedTechObj = techCoverageData.find(t => t.nome === selectedTechnician);
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
            itineraryResultsList.innerHTML = '<p class="text-red-600">No appointments with valid Zip Codes (and not Confirmed) to optimize.</p>';
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
            let nextStop = null;
            if (isReversed) {
                nextStop = unvisited.reduce((farthest, current) => {
                    const dist = calculateDistance(currentLat, currentLon, current.lat, current.lon);
                    if (dist > farthest.maxDistance) return { maxDistance: dist, client: current };
                    return farthest;
                }, { maxDistance: -1, client: null });
            } else {
                nextStop = unvisited.reduce((closest, current) => {
                    const dist = calculateDistance(currentLat, currentLon, current.lat, current.lon);
                    if (dist < closest.minDistance) return { minDistance: dist, client: current };
                    return closest;
                }, { minDistance: Infinity, client: null });
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

    // --- Inicialização e Event Listeners ---
    async function loadAppointmentData() {
        try {
            const [appointmentsResponse, techCoverageResponse] = await Promise.all([
                fetch('/api/get-technician-appointments'),
                fetch('/api/get-tech-coverage')
            ]);

            if (!appointmentsResponse.ok) throw new Error('Failed to load appointments for itinerary.');
            const data = await appointmentsResponse.json();
            allAppointments = (data.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            
            if (techCoverageResponse.ok) {
                allTechCoverage = await techCoverageResponse.json();
            }

            renderDayItineraryTable();
        } catch (error) {
            console.error('Error loading initial data for itinerary:', error);
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
        await loadAppointmentData(); // Recarrega os dados para garantir que a cobertura do técnico esteja disponível
    });

    document.addEventListener('weekChanged', (e) => {
        currentWeekStart = e.detail.weekStart;
        renderDayItineraryTable();
    });
    
    document.addEventListener('appointmentUpdated', async () => {
        await loadAppointmentData();
    });

    if (dayFilter) dayFilter.addEventListener('change', renderDayItineraryTable);
    if (optimizeItineraryBtn) optimizeItineraryBtn.addEventListener('click', () => runItineraryOptimization(false));
    if (itineraryReverserBtn) itineraryReverserBtn.addEventListener('click', () => runItineraryOptimization(true));
    if (applyRouteBtn) applyRouteBtn.addEventListener('click', handleApplyRoute);
    
    loadAppointmentData();
    populateTimeSlotsDropdown();
});
