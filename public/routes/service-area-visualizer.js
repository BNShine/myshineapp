// public/routes/service-area-visualizer.js

document.addEventListener('DOMContentLoaded', () => {
    const areaTechSelect = document.getElementById('area-tech-select');
    const areaMapContainer = document.getElementById('area-map');

    let areaMap;
    let techCoverageData = [];
    let currentMapElements = []; // To store markers and polygons

    // Paleta de cores para os técnicos
    const techColors = [
        '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF',
        '#33FFA1', '#FFC300', '#C70039', '#900C3F', '#581845'
    ];

    // --- Funções Auxiliares ---

    async function getCityBoundary(cityName) {
        // Usa a API Nominatim para obter os limites da cidade (polígono)
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cityName)}&format=json&polygon_geojson=1`);
            if (!response.ok) return null;
            const data = await response.json();
            if (data.length > 0 && data[0].geojson) {
                return data[0].geojson;
            }
            return null;
        } catch (error) {
            console.error(`Error fetching boundary for ${cityName}:`, error);
            return null;
        }
    }

    function clearMap() {
        currentMapElements.forEach(element => {
            if (element.setMap) { // For markers and polygons
                element.setMap(null);
            }
        });
        currentMapElements = [];
    }

    // --- Lógica Principal do Mapa ---

    function initializeAreaMap() {
        if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
            areaMap = new google.maps.Map(areaMapContainer, {
                center: { lat: 39.8283, lng: -98.5795 }, // Centro dos EUA
                zoom: 4,
                streetViewControl: false,
                fullscreenControl: false,
            });
        }
    }

    async function drawTechnicianArea(techName, color) {
        const tech = techCoverageData.find(t => t.nome === techName);
        if (!tech || !tech.cidades || tech.cidades.length === 0) return;

        const bounds = new google.maps.LatLngBounds();

        for (const city of tech.cidades) {
            const geojson = await getCityBoundary(city);
            if (geojson && geojson.coordinates) {
                const paths = geojson.coordinates[0].map(coord => ({ lat: coord[1], lng: coord[0] }));
                
                const polygon = new google.maps.Polygon({
                    paths: paths,
                    strokeColor: color,
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: color,
                    fillOpacity: 0.35
                });

                polygon.setMap(areaMap);
                currentMapElements.push(polygon);
                
                // Adiciona um infowindow para mostrar o nome do técnico
                const infoWindow = new google.maps.InfoWindow({
                    content: `<div style="font-weight: bold;">${techName}</div>`
                });
                
                google.maps.event.addListener(polygon, 'mouseover', function(e) {
                     infoWindow.setPosition(e.latLng);
                     infoWindow.open(areaMap);
                });

                google.maps.event.addListener(polygon, 'mouseout', function() {
                    infoWindow.close();
                });

                // Estende os limites para centralizar o mapa
                paths.forEach(p => bounds.extend(p));
            }
        }
        
        if (!bounds.isEmpty()) {
            areaMap.fitBounds(bounds);
        }
    }
    
    async function drawAllTechnicianAreas() {
        const bounds = new google.maps.LatLngBounds();
        let colorIndex = 0;

        for (const tech of techCoverageData) {
            if (tech.cidades && tech.cidades.length > 0) {
                const color = techColors[colorIndex % techColors.length];
                await drawTechnicianArea(tech.nome, color);
                colorIndex++;
            }
        }
        
        // Não é necessário o fitBounds aqui, pois cada drawTechnicianArea já faz isso.
        // O último a ser desenhado definirá o zoom final.
        // Se quisermos ver todos juntos, precisamos coletar todos os bounds e fazer um fitBounds no final.
    }


    async function handleSelectionChange() {
        clearMap();
        const selectedValue = areaTechSelect.value;
        if (selectedValue === 'all') {
            await drawAllTechnicianAreas();
        } else if (selectedValue) {
            await drawTechnicianArea(selectedValue, techColors[0]);
        }
    }

    // --- Inicialização ---

    async function init() {
        // Espera a API do Google Maps carregar (se ainda não carregou)
        if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
            // A função fetchGoogleMapsApiKey no quick-routes.js já cuida disso.
            // Apenas esperamos um pouco para garantir que ela seja executada.
            await new Promise(resolve => setTimeout(resolve, 1000)); 
        }

        initializeAreaMap();

        try {
            const response = await fetch('/api/get-tech-coverage');
            if (response.ok) {
                techCoverageData = await response.json();
                populateAreaSelect();
            } else {
                console.error("Failed to load technician coverage data for area visualizer.");
            }
        } catch (error) {
            console.error("Error fetching data for area visualizer:", error);
        }
    }
    
    function populateAreaSelect() {
        areaTechSelect.innerHTML = '<option value="">Select a Technician</option><option value="all">View All Technicians</option>';
        if (techCoverageData.length > 0) {
            techCoverageData.forEach(tech => {
                if (tech.nome) {
                    const option = document.createElement('option');
                    option.value = tech.nome;
                    option.textContent = tech.nome;
                    areaTechSelect.appendChild(option);
                }
            });
        }
    }

    areaTechSelect.addEventListener('change', handleSelectionChange);

    init();
});
