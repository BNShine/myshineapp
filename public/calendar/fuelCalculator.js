// public/calendar/fuelCalculator.js

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Selectors ---
    const dailyGrid = document.getElementById('daily-summary-grid');
    const mpgInput = document.getElementById('mpg-input');
    const fuelCostInput = document.getElementById('fuel-cost-input');
    const calculateBtn = document.getElementById('calculate-fuel-cost-btn');
    const weeklyDistanceEl = document.getElementById('weekly-total-distance');
    const weeklyCostEl = document.getElementById('weekly-total-cost');

    if (!calculateBtn) return; // Don't run if the section doesn't exist

    // --- 2. State Variables ---
    let localAppointments = [];
    let localTechCoverage = [];
    let localCurrentWeekStart = new Date();
    let localSelectedTechnician = '';

    const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // --- 3. Helper Functions ---
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

    // --- 4. Core Calculation Logic ---
    async function calculateDailyDistance(originZip, appointmentsForDay) {
        if (appointmentsForDay.length === 0) {
            return 0;
        }

        // Create a list of all stops for the day
        const waypoints = appointmentsForDay.map(appt => ({ zipCode: appt.zipCode }));

        try {
            const response = await fetch('/api/optimize-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originZip: originZip,
                    waypoints: waypoints,
                    isReversed: true, // IMPORTANT: This tells the API to calculate the route in the given order, not optimize it.
                }),
            });

            const result = await response.json();
            if (!result.success || !result.routeData || result.routeData.routes.length === 0) {
                console.error("Failed to calculate route for a day:", result.message);
                return 0;
            }

            // Sum the distance of all legs of the journey (including the return to origin)
            const totalMeters = result.routeData.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0);
            
            // Convert meters to miles
            const totalMiles = totalMeters / 1609.34;
            return totalMiles;

        } catch (error) {
            console.error("Error calling route optimization API for distance calculation:", error);
            return 0;
        }
    }


    async function calculateAndRenderCosts() {
        if (!localSelectedTechnician) {
            dailyGrid.innerHTML = `<p class="col-span-full text-center text-muted-foreground">Please select a technician to calculate costs.</p>`;
            weeklyDistanceEl.textContent = '0 mi';
            weeklyCostEl.textContent = '$0.00';
            return;
        }

        calculateBtn.disabled = true;
        calculateBtn.textContent = 'Calculating...';
        dailyGrid.innerHTML = ''; // Clear previous results

        const mpg = parseFloat(mpgInput.value) || 25;
        const fuelCost = parseFloat(fuelCostInput.value) || 3.50;
        const techOrigin = localTechCoverage.find(t => t.nome === localSelectedTechnician)?.zip_code;

        if (!techOrigin) {
            dailyGrid.innerHTML = `<p class="col-span-full text-center text-destructive">Technician has no origin ZIP code set. Cannot calculate travel.</p>`;
            calculateBtn.disabled = false;
            calculateBtn.textContent = 'Calculate Costs';
            return;
        }

        let weeklyTotalDistance = 0;
        let weeklyTotalCost = 0;

        for (let i = 0; i < 7; i++) {
            const dayDate = getDayOfWeekDate(localCurrentWeekStart, i);
            
            // Render a skeleton card first
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

            // Update the card with real data
            dayCard.classList.remove('animate-pulse');
            dayCard.innerHTML = `
                <div class="flex justify-between items-center">
                    <p class="font-bold text-foreground">${DAY_NAMES_SHORT[i]}</p>
                    <p class="text-xs text-muted-foreground">${dayDate.getDate()}</p>
                </div>
                <p class="text-sm">Distance: <span class="font-semibold">${dailyDistance.toFixed(1)} mi</span></p>
                <p class="text-sm">Fuel Cost: <span class="font-semibold text-success">${dailyCost.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span></p>
            `;
        }
        
        weeklyDistanceEl.textContent = `${weeklyTotalDistance.toFixed(1)} mi`;
        weeklyCostEl.textContent = weeklyTotalCost.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

        calculateBtn.disabled = false;
        calculateBtn.textContent = 'Calculate Costs';
    }


    // --- 5. Event Listeners ---
    document.addEventListener('stateUpdated', (e) => {
        localAppointments = e.detail.allAppointments;
        localTechCoverage = e.detail.allTechCoverage;
        localSelectedTechnician = e.detail.technician;
        localCurrentWeekStart = e.detail.weekStart;
        // Automatically recalculate when technician or week changes
        calculateAndRenderCosts();
    });

    calculateBtn.addEventListener('click', calculateAndRenderCosts);
});
