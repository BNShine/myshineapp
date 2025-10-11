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

        const waypoints = appointmentsForDay.map(appt => ({ zipCode: appt.zipCode }));

        try {
            const response = await fetch('/api/optimize-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originZip: originZip,
                    waypoints: waypoints,
                    isReversed: true, // IMPORTANT: Calculates the route in chronological order, not optimized.
                }),
            });

            const result = await response.json();
            if (!result.success || !result.routeData || result.routeData.routes.length === 0) {
                console.error("Failed to calculate route for the day:", result.message);
                return 0;
            }

            const totalMeters = result.routeData.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0);
            
            // Convert meters to miles
            const totalMiles = totalMeters / 1609.34;
            return totalMiles;

        } catch (error) {
            console.error("Error calling the route API for distance calculation:", error);
            return 0;
        }
    }

    function initializeOrResetCards() {
        const dayCards = dailyGrid.querySelectorAll('.card-base');
        dayCards.forEach((card, index) => {
            const dayDate = getDayOfWeekDate(localCurrentWeekStart, index);
            card.querySelector('.day-date').textContent = dayDate.getDate();
            card.querySelector('.daily-distance').textContent = '0 mi';
            card.querySelector('.daily-cost').textContent = '$0.00';
            card.classList.remove('animate-pulse');
        });
        weeklyDistanceEl.textContent = '0 mi';
        weeklyCostEl.textContent = '$0.00';
    }


    async function calculateAndRenderCosts() {
        if (!localSelectedTechnician) {
            alert("Please select a technician to calculate costs.");
            return;
        }

        calculateBtn.disabled = true;
        calculateBtn.textContent = 'Calculating...';
        
        const dayCards = dailyGrid.querySelectorAll('.card-base');
        dayCards.forEach(card => card.classList.add('animate-pulse'));

        const mpg = parseFloat(mpgInput.value) || 25;
        const fuelCost = parseFloat(fuelCostInput.value) || 3.50;
        const techOrigin = localTechCoverage.find(t => t.nome === localSelectedTechnician)?.zip_code;

        if (!techOrigin) {
            alert("The selected technician does not have an origin ZIP code. Travel cannot be calculated.");
            calculateBtn.disabled = false;
            calculateBtn.textContent = 'Calculate Costs';
            dayCards.forEach(card => card.classList.remove('animate-pulse'));
            return;
        }

        let weeklyTotalDistance = 0;
        let weeklyTotalCost = 0;

        for (let i = 0; i < 7; i++) {
            const dayDate = getDayOfWeekDate(localCurrentWeekStart, i);
            const dayCard = dayCards[i];
            
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
            dayCard.querySelector('.daily-distance').textContent = `${dailyDistance.toFixed(1)} mi`;
            dayCard.querySelector('.daily-cost').textContent = dailyCost.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            dayCard.classList.remove('animate-pulse');
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
        
        // When the week or technician changes, just reset the cards to their initial state.
        initializeOrResetCards();
    });

    calculateBtn.addEventListener('click', calculateAndRenderCosts);
    
    // Initialize the cards on first load
    initializeOrResetCards();
});
