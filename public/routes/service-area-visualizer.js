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
    const MAX_CLUSTERS = 5;

    const isZipCode = (str) => /^\d{5}$/.test(String(str).trim());

    // --- Funções de Geolocalização ---
    async function getPoint(location, stateHint = null) {
        const isZip = isZipCode(location);
        const cacheKey = `point_${String(location).toLowerCase().replace(/\s/g, '_')}${isZip ? '' : (stateHint ? `_${stateHint}` : '')}`;
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) return JSON.parse(cachedData);

        try {
            let apiUrl;
            if (isZip) {
                // Para Zip Codes, a API do Nominatim usa 'postalcode'
                apiUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&postalcode=${encodeURIComponent(location)}&country=us`;
            } else {
                apiUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&city=${encodeURIComponent(location)}`;
                if (stateHint) apiUrl += `&state=${encodeURIComponent(stateHint)}`;
            }

            const response = await fetch(apiUrl);
            if (!response.ok) return null;
            const data = await response.json();
            const point = (data.length > 0) ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
            if (point) sessionStorage.setItem(cacheKey, JSON.stringify(point));
            return point;
        } catch (error) {
            console.error(`Error fetching point for ${location}:`, error);
            return null;
        }
    }

    async function getStateFromZip(zipCode) {
        if (!zipCode || String(zipCode).length !== 5) return null;
        const cacheKey = `state_for_zip_${zipCode}`;
        const cachedState = sessionStorage.getItem(cacheKey);
        if (cachedState) return cachedState;
        
        try {
            const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
            if (!response.ok) return null;
            const data = await response.json();
            const state = data.places[0]?.['state'];
            if (state) sessionStorage.setItem(cacheKey, state);
            return state;
        } catch (error) {
            console.error(`Error fetching state for zip ${zipCode}:`, error);
            return null;
        }
    }

    // --- Lógica do Mapa ---
    function getDistance(p1, p2) {
        const R = 6371;
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLon = (p2.lng - p1.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function clearAreaMap() {
        currentMapElements.forEach(element => element.setMap(null));
        currentMapElements = [];
    }

    async function drawTechnicianArea(techName, color) {
        const tech = techData.find(t => t.nome === techName);
        if (!tech || !tech.cidades || tech.cidades.length === 0) return null;
    
        const bounds = new google.maps.LatLngBounds();
        const stateHint = tech.zip_code ? await getStateFromZip(tech.zip_code) : null;
        
        const cityPoints = (await Promise.all(
            tech.cidades.map(async (area) => {
                const point = await getPoint(area, stateHint);
                return point ? { ...point, name: area } : null;
            })
        )).filter(Boolean);

        if (cityPoints.length === 0) return null;

        let clusters = [];
        const CLUSTER_RADIUS_KM = 150; 

        cityPoints.forEach(point => {
            let foundCluster = false;
            for (const cluster of clusters) {
                if (getDistance(point, cluster.center) < CLUSTER_RADIUS_KM) {
                    cluster.points.push(point);
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

        clusters.forEach(cluster => {
            let maxRadius = 0;
            cluster.points.forEach(point => {
                const distance = getDistance(cluster.center, point);
                if (distance > maxRadius) maxRadius = distance;
            });
            const radiusInMeters = (maxRadius + 20) * 1000;

            const circle = new google.maps.Circle({
                strokeColor: color, strokeOpacity: 0.8, strokeWeight: 2, fillColor: color, fillOpacity: 0.2,
                map: areaMap, center: cluster.center, radius: radiusInMeters
            });
            currentMapElements.push(circle);

            cluster.points.forEach(point => {
                const marker = new google.maps.Marker({
                    position: point, map: areaMap, title: `${techName} - ${point.name}`,
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 4, fillColor: color, fillOpacity: 0.8, strokeWeight: 0 }
                });
                currentMapElements.push(marker);

                const infoWindow = new google.maps.InfoWindow({ content: `<div style="font-weight: bold;">${techName}</div><div>${point.name}</div>` });
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

        let techniciansToDraw = [];

        if (selectedValue === 'all') {
            techniciansToDraw = techData;
        } else if (selectedValue === 'all-central') {
            techniciansToDraw = techData.filter(tech => tech.categoria === 'Central');
        } else if (selectedValue === 'all-franchise') {
            techniciansToDraw = techData.filter(tech => tech.categoria === 'Franchise');
        } else if (selectedValue) {
            const singleTech = techData.find(tech => tech.nome === selectedValue);
            if(singleTech) techniciansToDraw.push(singleTech);
        }

        const allBoundsPromises = techniciansToDraw.map((tech, index) => {
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
        areaTechSelect.innerHTML = `<option value="">Select an Option</option>
                                    <option value="all">View All Technicians</option>
                                    <option value="all-central">All Central</option>
                                    <option value="all-franchise">All Franchise</option>
                                    <optgroup label="Individual Technicians">`;
        techData.forEach(tech => {
            if (tech.nome) {
                areaTechSelect.innerHTML += `<option value="${tech.nome}">${tech.nome}</option>`;
            }
        });
        areaTechSelect.innerHTML += `</optgroup>`;
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
                styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }, { featureType: 'transit', stylers: [{ visibility: 'off' }] }]
            });
        }
    });

    areaTechSelect.addEventListener('change', handleAreaSelectionChange);
});
