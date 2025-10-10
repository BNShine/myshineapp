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

    // --- Otimização: Funções de Cache e Geolocalização ---

    // **MELHORIA 1: Cache para coordenadas de cidades**
    async function getCityPoint(cityName) {
        const cacheKey = `point_${cityName.toLowerCase().replace(/\s/g, '_')}`;
        const cachedData = sessionStorage.getItem(cacheKey);

        if (cachedData) {
            return JSON.parse(cachedData);
        }

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cityName)}&format=json&limit=1`);
            if (!response.ok) return null;
            
            const data = await response.json();
            const point = (data.length > 0) ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
            
            if (point) {
                sessionStorage.setItem(cacheKey, JSON.stringify(point));
            }
            return point;
        } catch (error) {
            console.error(`Error fetching point for ${cityName}:`, error);
            return null;
        }
    }
    
    // --- Lógica do Mapa e Perímetro (Convex Hull) ---

    // Função para calcular o perímetro (Convex Hull)
    function createConvexHull(points) {
        points.sort((a, b) => a.lng - b.lng || a.lat - b.lat);

        const crossProduct = (p1, p2, p3) => (p2.lng - p1.lng) * (p3.lat - p1.lat) - (p2.lat - p1.lat) * (p3.lng - p1.lng);

        const buildHull = (points) => {
            const hull = [];
            for (const pt of points) {
                while (hull.length >= 2 && crossProduct(hull[hull.length - 2], hull[hull.length - 1], pt) <= 0) {
                    hull.pop();
                }
                hull.push(pt);
            }
            hull.pop();
            return hull;
        };

        const upperHull = buildHull(points);
        const lowerHull = buildHull([...points].reverse());
        return upperHull.concat(lowerHull);
    }

    function clearAreaMap() {
        currentMapElements.forEach(element => element.setMap(null));
        currentMapElements = [];
    }

    async function drawTechnicianArea(techName, color) {
        const tech = techData.find(t => t.nome === techName);
        if (!tech || !tech.cidades || tech.cidades.length === 0) return null;
    
        const bounds = new google.maps.LatLngBounds();
        const cityPoints = [];

        // 1. Coleta todas as coordenadas das cidades em paralelo
        const pointPromises = tech.cidades.map(async (city) => {
            const point = await getCityPoint(city);
            if (point) {
                cityPoints.push({ ...point, name: city });
                bounds.extend(point);
            }
        });
        await Promise.all(pointPromises);

        // 2. Desenha o perímetro (Convex Hull) se houver 3 ou mais pontos
        if (cityPoints.length >= 3) {
            const hullPoints = createConvexHull(cityPoints);
            const hullPolygon = new google.maps.Polygon({
                paths: hullPoints,
                strokeColor: color,
                strokeOpacity: 0.6,
                strokeWeight: 2,
                fillColor: color,
                fillOpacity: 0.20
            });
            hullPolygon.setMap(areaMap);
            currentMapElements.push(hullPolygon);
        }

        // 3. Desenha um marcador para cada cidade
        cityPoints.forEach(point => {
            const marker = new google.maps.Marker({
                position: point,
                map: areaMap,
                title: `${techName} - ${point.name}`,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 5,
                    fillColor: color,
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 1,
                }
            });
            currentMapElements.push(marker);

            // **MELHORIA 2: Tooltip com Nome do Técnico e da Cidade**
            const infoWindow = new google.maps.InfoWindow({
                content: `<div style="font-weight: bold;">${techName}</div><div>${point.name}</div>`
            });

            marker.addListener('mouseover', () => infoWindow.open(areaMap, marker));
            marker.addListener('mouseout', () => infoWindow.close());
        });
    
        return bounds;
    }
    
    async function handleAreaSelectionChange() {
        if (!areaMap) return;
        clearAreaMap();
        
        const selectedValue = areaTechSelect.value;
        const finalBounds = new google.maps.LatLngBounds();

        areaMapContainer.style.opacity = '0.5'; // Feedback de carregamento

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
                if(bounds && !bounds.isEmpty()) finalBounds.union(bounds);
            });

        } else if (selectedValue) {
            const bounds = await drawTechnicianArea(selectedValue, techColors[0]);
            if (bounds && !bounds.isEmpty()) finalBounds.union(bounds);
        }

        if (!finalBounds.isEmpty()) {
            areaMap.fitBounds(finalBounds);
        } else {
            areaMap.setCenter({ lat: 39.8283, lng: -98.5795 });
            areaMap.setZoom(4);
        }
        
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
                styles: [
                    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                    { featureType: 'transit', stylers: [{ visibility: 'off' }] }
                ]
            });
        }
    });

    areaTechSelect.addEventListener('change', handleAreaSelectionChange);
});
