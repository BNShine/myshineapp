// public/routes/routes-manager.js

// Função de callback global para a API do Google Maps
// Ela precisa estar no escopo global para que o script do Google possa chamá-la.
function initMap() {
    // Dispara um evento global para notificar que a API do Google Maps está pronta.
    document.dispatchEvent(new Event('googleMapsLoaded'));
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Variáveis Globais de Dados ---
    let techData = [];
    let GOOGLE_MAPS_API_KEY = null;

    const showToast = (message, type) => alert(type.toUpperCase() + ": " + message);

    // --- Carregamento de Dados ---

    // 1. Carrega a chave da API do Google Maps e o script
    async function loadGoogleMapsApi() {
        if (GOOGLE_MAPS_API_KEY) return;
        try {
            const response = await fetch('/api/get-google-maps-api-key');
            if (!response.ok) throw new Error('Failed to fetch Google Maps API key.');
            
            const data = await response.json();
            GOOGLE_MAPS_API_KEY = data.apiKey;
            
            // Verifica se o script já não está na página
            if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap`;
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            } else {
                // Se o script já existe, apenas dispara o evento de inicialização
                initMap();
            }
        } catch (error) {
            console.error(error.message);
            showToast('Could not load Google Maps API. Please check your API key.', 'error');
        }
    }

    // 2. Busca os dados de cobertura dos técnicos APENAS UMA VEZ
    async function loadTechCoverageData() {
        try {
            const response = await fetch('/api/get-tech-coverage'); 
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `API failed with status: ${response.status}`);
            }
            const apiData = await response.json();
            techData = Array.isArray(apiData) ? apiData.filter(t => t.nome) : [];
            localStorage.setItem('tech_data_cache', JSON.stringify(techData)); // Atualiza o cache
        } catch (error) {
            console.error('Failed to load coverage data from Sheets:', error);
            const cachedData = localStorage.getItem('tech_data_cache');
            if (cachedData) {
                techData = JSON.parse(cachedData);
                showToast('Using cached data due to a connection error.', 'warning');
            } else {
                 showToast('Critical error loading technician data.', 'error');
                 techData = [];
            }
        } finally {
            // 3. Dispara um evento global com os dados carregados para que os outros scripts possam usá-los
            const event = new CustomEvent('techDataLoaded', { detail: { techData } });
            document.dispatchEvent(event);
        }
    }

    // --- Função de Inicialização Principal ---
    async function init() {
        await loadGoogleMapsApi();
        await loadTechCoverageData();
    }

    init();
});
