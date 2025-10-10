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

    // **NOVA LÓGICA:** A função agora aceita um 'stateHint' para resolver ambiguidades.
    async function getCityPoint(cityName, stateHint = null) {
        const cacheKey = `point_${cityName.toLowerCase().replace(/\s/g, '_')}${stateHint ? `_${stateHint.toLowerCase().replace(/\s/g, '_')}` : ''}`;
        const cachedData = sessionStorage.getItem(cacheKey);

        if (cachedData) {
            return JSON.parse(cachedData);
        }

        try {
            // Constrói a URL da API dinamicamente, adicionando o estado se ele for fornecido.
            let apiUrl = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cityName)}&format=json&limit=1`;
            if (stateHint) {
                apiUrl = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cityName)}&state=${encodeURIComponent(stateHint)}&format=json&limit=1`;
            }

            const response = await fetch(apiUrl);
            if (!response.ok) return null;
            
            const data = await response.json();
            const pointData = (data.length > 0) ? { 
                lat: parseFloat(data[0].lat), 
                lng: parseFloat(data[0].lon),
                // Extrai o estado do resultado para usar na próxima etapa
                state: data[0].display_name.split(', ').slice(-2)[0] 
            } : null;
            
            if (pointData) {
                sessionStorage.setItem(cacheKey, JSON.stringify(pointData));
            }
            return pointData;
        } catch (error) {
            console.error(`Error fetching point for ${cityName}:`, error);
            return null;
        }
    }
    
    // --- Lógica do Mapa e Perímetro (Convex Hull) ---
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
        
        // --- INÍCIO DA NOVA LÓGICA DE ESTADO PREDOMINANTE ---

        // 1. Faz uma primeira passagem para obter as coordenadas e contar a frequência de cada estado.
        const cityDetails = [];
        const stateCounts = {};

        for (const city of tech.cidades) {
            const point = await getCityPoint(city); // Primeira busca, sem dica de estado
            if (point && point.state) {
                cityDetails.push({ ...point, name: city });
                stateCounts[point.state] = (stateCounts[point.state] || 0) + 1;
            }
        }
        
        // 2. Encontra o estado predominante (o que mais aparece)
        let predominantState = null;
        if (Object.keys(stateCounts).length > 0) {
            predominantState = Object.keys(stateCounts).reduce((a, b) => stateCounts[a] > stateCounts[b] ? a : b);
        }

        // 3. Processa a lista final de pontos, forçando o estado predominante se necessário
        const finalCityPoints = [];
        const pointPromises = cityDetails.map(async (detail) => {
            // Se o estado do ponto for diferente do predominante, faz uma nova busca com a dica de estado.
            if (predominantState && detail.state !== predominantState) {
                const correctedPoint = await getCityPoint(detail.name, predominantState);
                if (correctedPoint) {
                    finalCityPoints.push({ ...correctedPoint, name: detail.name });
                    bounds.extend(correctedPoint);
                }
            } else {
                finalCityPoints.push(detail);
                bounds.extend(detail);
            }
        });

        await Promise.all(pointPromises);

        // --- FIM DA NOVA LÓGICA ---

        // 4. Desenha o perímetro (Convex Hull) com os pontos finais
        if (finalCityPoints.length >= 3) {
            const hullPoints = createConvexHull(finalCityPoints);
            const hullPolygon = new google.maps.Polygon({
                paths: hullPoints, strokeColor: color, strokeOpacity: 0.6, strokeWeight: 2, fillColor: color, fillOpacity: 0.20
            });
            hullPolygon.setMap(areaMap);
            currentMapElements.push(hullPolygon);
        }

        // 5. Desenha um marcador para cada cidade
        finalCityPoints.forEach(point => {
            const marker = new google.maps.Marker({
                position: point, map: areaMap, title: `${techName} - ${point.name}`,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: color, fillOpacity: 1, strokeColor: 'white', strokeWeight: 1,
                }
            });
            currentMapElements.push(marker);

            const infoWindow = new google.maps.InfoWindow({ content: `<div style="font-weight: bold;">${techName}</div><div>${point.name}</div>` });
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
    
    function init(data) {
        techData = data;
        areaTechSelect.innerHTML = '<option value="">Select a Technician</option><option value="all">View All Technicians</option>';
        techData.forEach(tech => {
            if (tech.nome) {
                areaTechSelect.innerHTML += `<option value="${tech.nome}">${tech.nome}</option>`;
            }
        });
    }

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
