// public/routes/itinerary-optimizer.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores ---
    const zipCodeInput = document.getElementById('zip-code-input');
    const verifyZipBtn = document.getElementById('verify-zip-btn');
    const zipCodeResults = document.getElementById('zip-code-results');
    const clientTableBody = document.getElementById('client-table-body');
    const techSelect = document.getElementById('tech-select');
    const addClientRowBtn = document.getElementById('add-client-row-btn');
    const optimizeItineraryBtn = document.getElementById('optimize-itinerary-btn');
    const itineraryResults = document.getElementById('itinerary-results');
    const itineraryList = document.getElementById('itinerary-list');
    const mapContainer = document.getElementById('map');

    let techData = [];
    let clientData = [{ nome: "", zip_code: "" }];
    let directionsService, directionsRenderer;
    let routeMap;
    const showToast = (message, type) => alert(type.toUpperCase() + ": " + message);

    // --- Funções Auxiliares de Geolocalização ---
    async function getLatLon(zipCode) {
        if (!zipCode || zipCode.length !== 5) return [null, null, null, null];
        try {
            const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
            if (!response.ok) return [null, null, null, null];
            const data = await response.json();
            const place = data.places[0];
            return [parseFloat(place.latitude), parseFloat(place.longitude), place['place name'], place['state abbreviation']];
        } catch (error) {
            return [null, null, null, null];
        }
    }

    // --- Lógica Principal ---
    function populateTechSelect() {
        techSelect.innerHTML = '<option value="">Select a technician to optimize</option>';
        techData.forEach(tech => {
            if (tech.nome && tech.zip_code) {
                techSelect.innerHTML += `<option value="${tech.nome}">${tech.nome} (${tech.zip_code})</option>`;
            }
        });
    }

    function renderClientTable() {
        clientTableBody.innerHTML = '';
        clientData.forEach((client, i) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="p-4"><input type="text" class="w-full bg-transparent border-none focus:outline-none" value="${client.nome}" data-key="nome" data-index="${i}"></td>
                <td class="p-4"><input type="text" class="w-full bg-transparent border-none focus:outline-none" value="${client.zip_code}" data-key="zip_code" data-index="${i}" maxlength="5"></td>
                <td class="p-4">${i > 0 ? `<button data-index="${i}" class="text-red-600 hover:text-red-800 delete-client-btn">🗑️</button>` : 'Principal'}</td>`;
            clientTableBody.appendChild(row);
        });
        clientTableBody.querySelectorAll('input').forEach(input => input.addEventListener('change', e => clientData[e.target.dataset.index][e.target.dataset.key] = e.target.value));
        clientTableBody.querySelectorAll('.delete-client-btn').forEach(btn => btn.addEventListener('click', e => {
            clientData.splice(e.target.dataset.index, 1);
            renderClientTable();
        }));
    }

    async function handleVerifyZipCode() {
        const zipCode = zipCodeInput.value.trim();
        zipCodeResults.innerHTML = '';
        if (!zipCode || zipCode.length !== 5) {
            zipCodeResults.innerHTML = `<p class="text-red-600">Please enter a valid 5-digit Zip Code.</p>`;
            return;
        }

        const [lat, lon, city, state] = await getLatLon(zipCode);
        if (!city) {
            zipCodeResults.innerHTML = `<p class="text-red-600">Zip Code not found or invalid.</p>`;
            return;
        }

        zipCodeResults.innerHTML = `<p class="text-green-600 font-bold">Zip Code Found:</p><p><strong>City:</strong> ${city}, ${state}</p>`;
        
        const availableTechs = techData.filter(tech => {
            const serviceAreas = (tech.cidades || []).map(area => String(area).toLowerCase().trim());
            return serviceAreas.includes(String(zipCode).toLowerCase().trim()) || serviceAreas.includes(String(city).toLowerCase().trim());
        });
        
        zipCodeResults.innerHTML += `<p class="mt-2"><strong>Covering Technicians:</strong> ${availableTechs.length > 0 ? availableTechs.map(t => t.nome).join(', ') : 'None'}</p>`;
    }
    
    function handleOptimizeItinerary() {
        itineraryResults.classList.add('hidden');
        if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });

        const selectedTech = techData.find(tech => tech.nome === techSelect.value);
        if (!selectedTech || !selectedTech.zip_code) {
            return showToast('Please select a valid technician with an origin Zip Code.', 'error');
        }
        
        const validClients = clientData.filter(c => c.zip_code && c.zip_code.length === 5);
        if (validClients.length < 1) {
            return showToast('Please add at least one client with a valid Zip Code.', 'error');
        }

        const waypoints = validClients.map(c => ({ location: c.zip_code, stopover: true }));
        const request = {
            origin: selectedTech.zip_code,
            destination: selectedTech.zip_code,
            waypoints: waypoints,
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING
        };
        
        directionsService.route(request, (response, status) => {
            if (status === 'OK') {
                itineraryResults.classList.remove('hidden');
                directionsRenderer.setDirections(response);

                const route = response.routes[0];
                let listHtml = '<p class="font-bold">Optimized Stop Sequence:</p>';
                const orderedClients = route.waypoint_order.map(i => validClients[i]);

                route.legs.forEach((leg, i) => {
                    const clientName = (i < orderedClients.length) ? orderedClients[i].nome : "Return to Origin";
                    listHtml += `<div class="border-b border-muted py-2"><p class="font-bold text-base">${i + 1}. ${clientName} (${leg.end_address})</p><p class="ml-4 text-sm">Travel: ${leg.duration.text} | ${leg.distance.text}</p></div>`;
                });

                const totalDuration = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0);
                const totalDistance = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
                listHtml += `<div class="mt-4 font-bold text-lg text-brand-primary">Total Estimated Travel: ${Math.round(totalDuration / 60)} min / ${(totalDistance / 1609.34).toFixed(1)} mi</div>`;
                itineraryList.innerHTML = listHtml;

            } else {
                showToast(`Google Maps route request failed. Status: ${status}`, 'error');
            }
        });
    }

    // --- Inicialização do Módulo ---
    function init(data) {
        techData = data;
        populateTechSelect();
        renderClientTable();
    }

    // --- Listeners de Eventos ---
    document.addEventListener('techDataLoaded', (event) => {
        init(event.detail.techData);
    });
    
    document.addEventListener('techDataUpdated', (event) => {
        techData = event.detail.techData;
        populateTechSelect();
    });
    
    document.addEventListener('googleMapsLoaded', () => {
        if (mapContainer && !routeMap) {
            routeMap = new google.maps.Map(mapContainer, {
                center: { lat: 39.8283, lng: -98.5795 }, zoom: 4, streetViewControl: false, fullscreenControl: false
            });
        }
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({ map: routeMap });
    });
    
    verifyZipBtn.addEventListener('click', handleVerifyZipCode);
    addClientRowBtn.addEventListener('click', () => {
        clientData.push({ nome: "", zip_code: "" });
        renderClientTable();
    });
    optimizeItineraryBtn.addEventListener('click', handleOptimizeItinerary);
});
