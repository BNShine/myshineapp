// public/appointment/availability-check.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores dos Elementos ---
    const smartCheckToggle = document.getElementById('smart-check-toggle');
    const smartCheckStatusBadge = document.getElementById('smart-check-status-badge');
    const smartCheckDescription = document.getElementById('smart-check-description');
    
    const availabilitySection = document.getElementById('availability-checker-section');
    const mainFormSection = document.getElementById('main-appointment-form');
    
    const zipCodeInputCheck = document.getElementById('customer-zip-code');
    const numPetsInput = document.getElementById('num-pets');
    const marginSelect = document.getElementById('appointment-margin');
    const verifyBtn = document.getElementById('verify-availability-btn');
    const resultsDiv = document.getElementById('availability-results');

    // --- Estado Inicial ---
    let availabilityData = [];
    let currentOptionIndex = 0;
    
    // --- Lógica do Switch ---
    const handleToggleChange = () => {
        const isSmartCheckOn = smartCheckToggle.checked;

        if (isSmartCheckOn) {
            smartCheckStatusBadge.textContent = 'ON';
            smartCheckStatusBadge.classList.remove('bg-gray-500');
            smartCheckStatusBadge.classList.add('bg-green-600');
            smartCheckDescription.textContent = 'O modo inteligente está ATIVADO. O sistema calculará o tempo de viagem e encontrará os melhores horários.';
            availabilitySection.classList.remove('hidden');
            mainFormSection.classList.add('hidden');
        } else {
            smartCheckStatusBadge.textContent = 'OFF';
            smartCheckStatusBadge.classList.remove('bg-green-600');
            smartCheckStatusBadge.classList.add('bg-gray-500');
            smartCheckDescription.textContent = 'O modo inteligente está DESATIVADO. O agendamento será manual com duração fixa (60 min/pet + 60 min margem).';
            availabilitySection.classList.add('hidden');
            mainFormSection.classList.remove('hidden');
            mainFormSection.scrollIntoView({ behavior: 'smooth' });
        }
    };
    
    smartCheckToggle.addEventListener('change', handleToggleChange);

    // --- Funções da Checagem de Disponibilidade ---
    verifyBtn.addEventListener('click', handleVerifyAvailability);
    
    async function handleVerifyAvailability() {
        const zipCode = zipCodeInputCheck.value.trim();
        const numPets = numPetsInput.value;
        const margin = marginSelect.value;
        if (zipCode.length !== 5 || !numPets || numPets < 1) {
            resultsDiv.innerHTML = `<p class="text-red-600 font-semibold">Please enter a valid Zip Code and Number of Pets.</p>`;
            return;
        }
        resultsDiv.innerHTML = `<p class="text-muted-foreground">Calculating travel times and finding the best slots...</p>`;
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Calculating...';
        try {
            const response = await fetch('/api/find-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ zipCode, numPets, margin }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'An unknown error occurred.');
            availabilityData = result.options;
            currentOptionIndex = 0;
            displayCurrentOption(zipCode, numPets, margin);
        } catch (error) {
            resultsDiv.innerHTML = `<p class="text-red-600 font-semibold">Error: ${error.message}</p>`;
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Check Availability';
        }
    }

    function displayCurrentOption(originalZip, numPets, margin) {
        if (availabilityData.length === 0) {
            resultsDiv.innerHTML = `<p class="text-red-600 font-semibold">No suitable slots found with the given travel constraints.</p>`;
            return;
        }
        const data = availabilityData[currentOptionIndex];
        const { technician, restrictions, date, availableSlots } = data;
        const friendlyDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        const slotsHtml = availableSlots.map(slot => 
            `<button type="button" class="slot-btn bg-brand-primary/10 text-brand-primary font-semibold py-2 px-4 rounded-lg hover:bg-brand-primary hover:text-white transition-colors" 
                data-slot="${slot.time}" data-date="${date}" data-tech="${technician}" data-zip="${originalZip}" data-pets="${numPets}"
                data-travel-time="${slot.travelTime}" data-margin="${margin}">
                ${slot.time} (+${slot.travelTime} min travel)
            </button>`
        ).join('');

        const prevButtonHtml = currentOptionIndex > 0 ? `<button id="prev-option-btn" class="text-sm font-semibold text-brand-primary hover:underline">&larr; Previous Option</button>` : `<div></div>`;
        const nextButtonHtml = currentOptionIndex < availabilityData.length - 1 ? `<button id="next-option-btn" class="text-sm font-semibold text-brand-primary hover:underline">Next Option &rarr;</button>` : `<div></div>`;
        resultsDiv.innerHTML = `<div class="space-y-4 p-4 border rounded-lg bg-muted/30"><div class="flex justify-between items-center"><p class="text-lg font-bold text-green-600">Option ${currentOptionIndex + 1} of ${availabilityData.length}</p><div class="flex gap-4">${prevButtonHtml}${nextButtonHtml}</div></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><p class="text-sm font-semibold text-foreground">Technician:</p><p class="text-base">${technician}</p></div><div><p class="text-sm font-semibold text-foreground">Restrictions:</p><p class="text-base font-medium text-amber-700">${restrictions}</p></div></div><div><p class="text-sm font-semibold text-foreground">Date:</p><p class="text-base">${friendlyDate}</p></div><div><p class="text-sm font-semibold text-foreground">Available Start Times:</p><div class="flex flex-wrap gap-2 mt-2">${slotsHtml}</div></div></div>`;
        document.querySelectorAll('.slot-btn').forEach(b => b.addEventListener('click', handleSlotSelection));
        if (document.getElementById('prev-option-btn')) document.getElementById('prev-option-btn').addEventListener('click', () => { currentOptionIndex--; displayCurrentOption(originalZip, numPets, margin); });
        if (document.getElementById('next-option-btn')) document.getElementById('next-option-btn').addEventListener('click', () => { currentOptionIndex++; displayCurrentOption(originalZip, numPets, margin); });
    }

    function handleSlotSelection(event) {
        const { slot, date, tech, zip, pets, travelTime, margin } = event.currentTarget.dataset;
        
        availabilitySection.classList.add('hidden');
        mainFormSection.classList.remove('hidden');
        
        document.getElementById('appointmentDate').value = `${date}T${slot}`;
        document.getElementById('zipCode').value = zip;
        document.getElementById('pets').value = pets;
        document.getElementById('travelTime').value = travelTime;
        document.getElementById('margin').value = margin;

        document.getElementById('zipCode').dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => {
            const techSelect = document.getElementById('suggestedTechSelect');
            if (techSelect) techSelect.value = tech;
        }, 1500);
        mainFormSection.scrollIntoView({ behavior: 'smooth' });
        document.getElementById('appointmentDate').dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Inicializa o estado do switch na carga da página
    handleToggleChange();
});
