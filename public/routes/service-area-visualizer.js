// public/routes/service-area-visualizer.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores ---
    const areaTechSelect = document.getElementById('area-tech-select');
    const areaMapContainer = document.getElementById('area-map');

    // --- Variáveis ---
    let areaMap;
    let techData = [];
    let currentMapElements = [];
    const techColors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF', '#33FFA1', '#FFC300', '#C70039', '#900C3F', '#581845'];

    // --- Funções Auxiliares de Geolocalização ---
    async function getCityBoundary(cityName) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cityName)}&format=json&polygon_geojson=1`);
            if (!response.ok) return null;
            const data = await response.json();
            return (data.length > 0 && data[0].geojson) ? data[0].geojson : null;
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
    
        const drawPolygon = (coords) => {
            const paths = coords.map(path => path.map(coord => ({ lat: coord[1], lng: coord[0] })));
            paths.forEach(path => {
                const polygon = new google.maps.Polygon({
                    paths: path, strokeColor: color, strokeOpacity: 0.8, strokeWeight: 2, fillColor: color, fillOpacity: 0.35
                });
                polygon.setMap(areaMap);
                currentMapElements.push(polygon);
                
                const infoWindow = new google.maps.InfoWindow({ content: `<div style="font-weight: bold;">${techName}</div>` });
                polygon.addListener('mouseover', e => { infoWindow.setPosition(e.latLng); infoWindow.open(areaMap); });
                polygon.addListener('mouseout', () => infoWindow.close());
                path.forEach(p => bounds.extend(p));
            });
        };
        
        for (const city of tech.cidades) {
            const geojson = await getCityBoundary(city);
            if (geojson && geojson.coordinates) {
                if (geojson.type === 'Polygon') {
                    drawPolygon(geojson.coordinates);
                } else if (geojson.type === 'MultiPolygon') {
                    geojson.coordinates.forEach(polygonCoords => drawPolygon(polygonCoords));
                }
            }
        }
        return bounds;
    }
    
    async function handleAreaSelectionChange() {
        if (!areaMap) return; // Garante que o mapa foi inicializado
        clearAreaMap();
        const selectedValue = areaTechSelect.value;
        const finalBounds = new google.maps.LatLngBounds();

        if (selectedValue === 'all') {
            let colorIndex = 0;
            for (const tech of techData) {
                if (tech.cidades && tech.cidades.length > 0) {
                    const color = techColors[colorIndex % techColors.length];
                    const bounds = await drawTechnicianArea(tech.nome, color);
                    if (bounds) finalBounds.union(bounds);
                    colorIndex++;
                }
            }
        } else if (selectedValue) {
            const bounds = await drawTechnicianArea(selectedValue, techColors[0]);
            if (bounds) finalBounds.union(bounds);
        }

        if (!finalBounds.isEmpty()) {
            areaMap.fitBounds(finalBounds);
        } else {
            areaMap.setCenter({ lat: 39.8283, lng: -98.5795 });
            areaMap.setZoom(4);
        }
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
    
    document.addEventListener('techDataUpdated', (event) => { // Ouve atualizações do editor de técnicos
        init(event.detail.techData);
    });

    document.addEventListener('googleMapsLoaded', () => {
        if (areaMapContainer && !areaMap) {
             areaMap = new google.maps.Map(areaMapContainer, {
                center: { lat: 39.8283, lng: -98.5795 }, zoom: 4, streetViewControl: false, fullscreenControl: false
            });
        }
    });

    areaTechSelect.addEventListener('change', handleAreaSelectionChange);
});
