// public/calendar/fuelCalculator.js

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Seletores ---
    const dailyGrid = document.getElementById('daily-summary-grid');
    const mpgInput = document.getElementById('mpg-input');
    const fuelCostInput = document.getElementById('fuel-cost-input');
    const calculateBtn = document.getElementById('calculate-fuel-cost-btn');
    const weeklyDistanceEl = document.getElementById('weekly-total-distance');
    const weeklyCostEl = document.getElementById('weekly-total-cost');

    if (!calculateBtn) return; // Não executa se a seção não existir na página

    // --- 2. Variáveis de Estado ---
    let localAppointments = [];
    let localTechCoverage = [];
    let localCurrentWeekStart = new Date();
    let localSelectedTechnician = '';

    const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // --- 3. Funções Auxiliares ---
    const getDayOfWeekDate = (startOfWeekDate, dayIndex) => {
        const date = new Date(startOfWeekDate);
        date.setDate(date.getDate() + dayIndex);
        return date;
    };

    const parseSheetDate = (dateStr) => {
        if (!dateStr) return null;
        const [datePart, timePart] = dateStr.split(' ');
        if (!datePart || !timePart) return null;
        const [month, day, year] = datePart.split('/').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        if ([year, month, day, hour, minute].some(isNaN)) return null;
        return new Date(year, month - 1, day, hour, minute);
    };

    // --- 4. Lógica Principal de Cálculo ---
    async function calculateDailyDistance(originZip, appointmentsForDay) {
        if (appointmentsForDay.length === 0) {
            return 0;
        }

        // Cria uma lista de todas as paradas do dia
        const waypoints = appointmentsForDay.map(appt => ({ zipCode: appt.zipCode }));

        try {
            const response = await fetch('/api/optimize-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originZip: originZip,
                    waypoints: waypoints,
                    isReversed: true, // Importante: Calcula a rota na ordem cronológica, sem otimizar
                }),
            });

            const result = await response.json();
            if (!result.success || !result.routeData || result.routeData.routes.length === 0) {
                console.error("Falha ao calcular a rota para o dia:", result.message);
                return 0;
            }

            // Soma a distância de todas as "pernas" da viagem (incluindo a volta para a origem)
            const totalMeters = result.routeData.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0);
            
            // Converte metros para milhas
            const totalMiles = totalMeters / 1609.34;
            return totalMiles;

        } catch (error) {
            console.error("Erro ao chamar a API de rota para cálculo de distância:", error);
            return 0;
        }
    }


    async function calculateAndRenderCosts() {
        if (!localSelectedTechnician) {
            dailyGrid.innerHTML = `<p class="col-span-full text-center text-muted-foreground">Por favor, selecione um técnico para calcular os custos.</p>`;
            weeklyDistanceEl.textContent = '0 mi';
            weeklyCostEl.textContent = '$0.00';
            return;
        }

        calculateBtn.disabled = true;
        calculateBtn.textContent = 'Calculando...';
        dailyGrid.innerHTML = ''; // Limpa resultados anteriores

        const mpg = parseFloat(mpgInput.value) || 25;
        const fuelCost = parseFloat(fuelCostInput.value) || 3.50;
        const techOrigin = localTechCoverage.find(t => t.nome === localSelectedTechnician)?.zip_code;

        if (!techOrigin) {
            dailyGrid.innerHTML = `<p class="col-span-full text-center text-destructive">O técnico não possui um ZIP Code de origem. Não é possível calcular a viagem.</p>`;
            calculateBtn.disabled = false;
            calculateBtn.textContent = 'Calcular Custos';
            return;
        }

        let weeklyTotalDistance = 0;
        let weeklyTotalCost = 0;

        for (let i = 0; i < 7; i++) {
            const dayDate = getDayOfWeekDate(localCurrentWeekStart, i);
            
            // Renderiza um card de "carregando"
            const dayCard = document.createElement('div');
            dayCard.className = 'card-base p-3 space-y-2 animate-pulse';
            dayCard.innerHTML = `
                 <div class="flex justify-between items-center">
                    <p class="font-bold text-foreground h-5 bg-muted rounded w-1/2"></p>
                </div>
                <div class="h-4 bg-muted rounded w-3/4"></div>
                <div class="h-4 bg-muted rounded w-1/2"></div>
            `;
            dailyGrid.appendChild(dayCard);
            
            const appointmentsForDay = localAppointments
                .filter(appt => {
                    const apptDate = parseSheetDate(appt.appointmentDate);
                    return appt.technician === localSelectedTechnician && apptDate && apptDate.toDateString() === dayDate.toDateString();
                })
                .sort((a, b) => parseSheetDate(a.appointmentDate) - parseSheetDate(b.appointmentDate));

            const dailyDistance = await calculateDailyDistance(techOrigin, appointmentsForDay);
            const dailyCost = dailyDistance > 0 && mpg > 0 ? (dailyDistance / mpg) * fuelCost : 0;

            weeklyTotalDistance += dailyDistance;
            weeklyTotalCost += dailyCost;

            // Atualiza o card com os dados reais
            dayCard.classList.remove('animate-pulse');
            dayCard.innerHTML = `
                <div class="flex justify-between items-center">
                    <p class="font-bold text-foreground">${DAY_NAMES_SHORT[i]}</p>
                    <p class="text-xs text-muted-foreground">${dayDate.getDate()}</p>
                </div>
                <p class="text-sm">Distância: <span class="font-semibold">${dailyDistance.toFixed(1)} mi</span></p>
                <p class="text-sm">Custo: <span class="font-semibold text-success">${dailyCost.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span></p>
            `;
        }
        
        weeklyDistanceEl.textContent = `${weeklyTotalDistance.toFixed(1)} mi`;
        weeklyCostEl.textContent = weeklyTotalCost.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

        calculateBtn.disabled = false;
        calculateBtn.textContent = 'Calcular Custos';
    }


    // --- 5. Ouvintes de Eventos ---
    document.addEventListener('stateUpdated', (e) => {
        localAppointments = e.detail.allAppointments;
        localTechCoverage = e.detail.allTechCoverage;
        localSelectedTechnician = e.detail.technician;
        localCurrentWeekStart = e.detail.weekStart;
        // Recalcula automaticamente quando o técnico ou a semana mudam
        calculateAndRenderCosts();
    });

    calculateBtn.addEventListener('click', calculateAndRenderCosts);
});
