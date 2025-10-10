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
    const MAX_CLUSTERS = 5; // Limite de perímetros por técnico

    // --- Otimização: Cache e Geolocalização ---
    async function getCityPoint(cityName) {
        const cacheKey = `point_${cityName.toLowerCase().replace(/\s/g, '_')}`;
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) return JSON.parse(cachedData);

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cityName)}&format=json&limit=1`);
            if (!response.ok) return null;
            const data = await response.json();
            const point = (data.length > 0) ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
            if (point) sessionStorage.setItem(cacheKey, JSON.stringify(point));
            return point;
        } catch (error) {
            console.error(`Error fetching point for ${cityName}:`, error);
            return null;
        }
    }
    
    // --- Lógica do Mapa e Clustering ---
    function clearAreaMap() {
        currentMapElements.forEach(element => element.setMap(null));
        currentMapElements = [];
    }

    // Função para calcular a distância entre dois pontos (Haversine formula para precisão)
    function getDistance(p1, p2) {
        const R = 6371; // Raio da Terra em km
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLon = (p2.lng - p1.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    async function drawTechnicianArea(techName, color) {
        const tech = techData.find(t => t.nome === techName);
        if (!tech || !tech.cidades || tech.cidades.length === 0) return null;
    
        const bounds = new google.maps.LatLngBounds();
        
        // 1. Coleta todas as coordenadas das cidades em paralelo
        const cityPoints = (await Promise.all(
            tech.cidades.map(async (city) => {
                const point = await getCityPoint(city);
                return point ? { ...point, name: city } : null;
            })
        )).filter(Boolean); // Filtra cidades que não foram encontradas

        if (cityPoints.length === 0) return null;

        // 2. Agrupa os pontos em clusters
        let clusters = [];
        // Define um raio de agrupamento dinâmico (ex: 150km)
        const CLUSTER_RADIUS_KM = 150; 

        cityPoints.forEach(point => {
            let foundCluster = false;
            for (const cluster of clusters) {
                if (getDistance(point, cluster.center) < CLUSTER_RADIUS_KM) {
                    cluster.points.push(point);
                    // Recalcula o centro do cluster
                    cluster.center = {
                        lat: cluster.points.reduce((sum, p) => sum + p.lat, 0) / cluster.points.length,
                        lng: cluster.points.reduce((sum, p) => sum + p.lng, 0) / cluster.points.length,
                    };
                    foundCluster = true;
                    break;
                }
            }
            if (!foundCluster && clusters.length < MAX_CLUSTERS) {
                clusters.push({ center: point, points: [point] });
            }
        });

        // 3. Desenha um perímetro arredondado (círculo) para cada cluster
        clusters.forEach(cluster => {
            // Calcula o raio necessário para englobar todos os pontos do cluster
            let maxRadius = 0;
            cluster.points.forEach(point => {
                const distance = getDistance(cluster.center, point);
                if (distance > maxRadius) {
                    maxRadius = distance;
                }
            });
            // Adiciona uma pequena margem ao raio
            const radiusInMeters = (maxRadius + 20) * 1000; 

            const circle = new google.maps.Circle({
                strokeColor: color,
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: color,
                fillOpacity: 0.2,
                map: areaMap,
                center: cluster.center,
                radius: radiusInMeters
            });
            currentMapElements.push(circle);

            // 4. Desenha marcadores individuais para cada cidade dentro do cluster
            cluster.points.forEach(point => {
                const marker = new google.maps.Marker({
                    position: point,
                    map: areaMap,
                    title: `${techName} - ${point.name}`,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 4,
                        fillColor: color,
                        fillOpacity: 0.8,
                        strokeWeight: 0,
                    }
                });
                currentMapElements.push(marker);

                const infoWindow = new google.maps.InfoWindow({
                    content: `<div style="font-weight: bold;">${techName}</div><div>${point.name}</div>`
                });
                marker.addListener('mouseover', () => infoWindow.open(areaMap, marker));
                marker.addListener('mouseout', () => infoWindow.close());

                bounds.extend(point);
            });
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
