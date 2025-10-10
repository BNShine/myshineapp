// public/routes/service--visualizer.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores ---
    const areaTechSelect = document.getElementById('area-tech-select');
    const areaMapContainer = document.getElementById('area-map');

    // --- Variáveis ---
    let areaMap;
    let techData = [];
    let currentMapElements = [];
    const techColors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF', '#33FFA1', '#FFC300', '#C70039', '#900C3F', '#581845'];

    // --- Otimização: Funções de Cache e Geolocalização ---

    // **MELHORIA 1: Implementação do Cache**
    async function getCityBoundary(cityName) {
        const cacheKey = `boundary_${cityName.toLowerCase().replace(/\s/g, '_')}`;
        const cachedData = sessionStorage.getItem(cacheKey);

        // Se encontrar no cache, usa o dado armazenado para performance máxima
        if (cachedData) {
            return JSON.parse(cachedData);
        }

        // Se não, busca na API externa e armazena no cache para a próxima vez
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cityName)}&format=json&polygon_geojson=1&limit=1`);
            if (!response.ok) return null;
            
            const data = await response.json();
            const geojson = (data.length > 0 && data[0].geojson) ? data[0].geojson : null;
            
            if (geojson) {
                sessionStorage.setItem(cacheKey, JSON.stringify(geojson));
            }
            
            return geojson;
        } catch (error) {
            console.error(`Error fetching boundary for ${cityName}:`, error);
            return null;
        }
    }
    
    // --- Lógica do Mapa ---
    function clearAreaMap() {
        currentMapElements.forEach(element => element.setMap(null));
        currentMapElements = [];
    }

    async function drawTechnicianArea(techName, color) {
        const tech = techData.find(t => t.nome === techName);
        if (!tech || !tech.cidades || tech.cidades.length === 0) return null;
    
        const bounds = new google.maps.LatLngBounds();
    
        // Processa todas as cidades em paralelo para mais velocidade
        const cityPromises = tech.cidades.map(async (city) => {
            const geojson = await getCityBoundary(city);
            if (!geojson || !geojson.coordinates) return;

            const drawPolygon = (coords) => {
                const paths = coords.map(path => path.map(coord => ({ lat: coord[1], lng: coord[0] })));
                paths.forEach(path => {
                    if (path.length === 0) return;

                    const polygon = new google.maps.Polygon({
                        paths: path, strokeColor: color, strokeOpacity: 0.8, strokeWeight: 2, fillColor: color, fillOpacity: 0.35
                    });
                    polygon.setMap(areaMap);
                    currentMapElements.push(polygon);
                    
                    // **MELHORIA 2: Tooltip com Nome do Técnico e da Cidade**
                    const infoWindow = new google.maps.InfoWindow({
                        content: `<div style="font-weight: bold;">${techName}</div><div>${city}</div>`
                    });

                    polygon.addListener('mouseover', e => { infoWindow.setPosition(e.latLng); infoWindow.open(areaMap); });
                    polygon.addListener('mouseout', () => infoWindow.close());

                    path.forEach(p => bounds.extend(p));
                });
            };

            if (geojson.type === 'Polygon') {
                drawPolygon(geojson.coordinates);
            } else if (geojson.type === 'MultiPolygon') {
                geojson.coordinates.forEach(polygonCoords => drawPolygon(polygonCoords));
            }
        });

        await Promise.all(cityPromises); // Espera todas as cidades do técnico serem processadas
    
        return bounds;
    }
    
    async function handleAreaSelectionChange() {
        if (!areaMap) return;
        clearAreaMap();
        
        const selectedValue = areaTechSelect.value;
        const finalBounds = new google.maps.LatLngBounds();

        // Adiciona um feedback visual de carregamento
        areaMapContainer.style.opacity = '0.5';

        if (selectedValue === 'all') {
            const allBoundsPromises = techData.map((tech, index) => {
                 if (tech.cidades && tech.cidades.length > 0) {
                    const color = techColors[index % techColors.length];
                    return drawTechnicianArea(tech.nome, color);
                }
                return Promise.resolve(null);
            });
            
            const allBounds = await Promise.all(allBoundsPromises);
            allBounds.forEach(bounds => {
                if(bounds) finalBounds.union(bounds);
            });

        } else if (selectedValue) {
            const bounds = await drawTechnicianArea(selectedValue, techColors[0]);
            if (bounds) finalBounds.union(bounds);
        }

        if (!finalBounds.isEmpty()) {
            areaMap.fitBounds(finalBounds);
        } else {
            // Se nenhuma área foi desenhada, reseta para a visão geral
            areaMap.setCenter({ lat: 39.8283, lng: -98.5795 });
            areaMap.setZoom(4);
        }
        
        // Remove o feedback de carregamento
        areaMapContainer.style.opacity = '1';
    }
    
    // --- Inicialização do Módulo ---
    function init(data) {
        techData = data;
        areaTechSelect.innerHTML = '<option value="">Select a Technician</option><option value="all">View All Technicians</option>';
        techData.forEach(tech => {
            if (tech.nome) {
                areaTechSelect.innerHTML += `<option value="${tech.nome}">${tech.nome}</option>`;
            }
        });
    }

    // --- Listeners de Eventos ---
    document.addEventListener('techDataLoaded', (event) => {
        init(event.detail.techData);
    });
    
    document.addEventListener('techDataUpdated', (event) => {
        init(event.detail.techData);
    });

    document.addEventListener('googleMapsLoaded', () => {
        if (areaMapContainer && !areaMap) {
             areaMap = new google.maps.Map(areaMapContainer, {
                center: { lat: 39.8283, lng: -98.5795 }, zoom: 4, streetViewControl: false, fullscreenControl: false,
                styles: [ // Estilo opcional para um mapa mais limpo
                    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                    { featureType: 'transit', stylers: [{ visibility: 'off' }] }
                ]
            });
        }
    });

    areaTechSelect.addEventListener('change', handleAreaSelectionChange);
});
