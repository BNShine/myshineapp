// public/appointment/availability-check.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos ---
    const availabilitySection = document.getElementById('availability-checker-section');
    const mainFormSection = document.getElementById('main-appointment-form');
    const skipBtn = document.getElementById('skip-to-manual-btn');
    const zipCodeInputCheck = document.getElementById('customer-zip-code');
    const zipCodeError = document.getElementById('zip-code-error');
    const numPetsInput = document.getElementById('num-pets');
    const marginSelect = document.getElementById('appointment-margin');
    const verifyBtn = document.getElementById('verify-availability-btn');
    const resultsDiv = document.getElementById('availability-results');
    const manualToggle = document.getElementById('manual-mode-toggle');

    // --- Toast Notification Function ---
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        let bgColor = 'bg-card text-foreground';
        if (type === 'success') bgColor = 'bg-success text-success-foreground';
        if (type === 'error') bgColor = 'bg-destructive text-destructive-foreground';

        toast.className = `w-80 p-4 rounded-lg shadow-large ${bgColor} animate-toast-in`;
        toast.innerHTML = `<p class="font-semibold">${message}</p>`;
        
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('animate-toast-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    }

    // --- Validação em tempo real ---
    zipCodeInputCheck.addEventListener('input', () => {
        zipCodeInputCheck.value = zipCodeInputCheck.value.replace(/[^0-9]/g, '');
        if (zipCodeInputCheck.value.length > 0 && zipCodeInputCheck.value.length < 5) {
            zipCodeError.textContent = 'Zip code must be 5 digits.';
            zipCodeInputCheck.classList.add('border-destructive');
        } else {
            zipCodeError.textContent = '';
            zipCodeInputCheck.classList.remove('border-destructive');
        }
    });

    // --- Estado e Lógica ---
    let availabilityData = [];
    let currentOptionIndex = 0;

    skipBtn.addEventListener('click', () => {
        mainFormSection.classList.remove('hidden');
        availabilitySection.classList.add('hidden');
        mainFormSection.scrollIntoView({ behavior: 'smooth' });

        if (manualToggle) {
            manualToggle.checked = true;
            manualToggle.dispatchEvent(new Event('change'));
        }
    });

    function formatToAmPm(timeStr) {
        if (!timeStr) return '';
        const [hour, minute] = timeStr.split(':');
        const h = parseInt(hour, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        let h12 = h % 12;
        h12 = h12 ? h12 : 12;
        return `${h12}:${minute} ${ampm}`;
    }

    async function handleVerifyAvailability() {
        const zipCode = zipCodeInputCheck.value.trim();
        if (zipCode.length !== 5) {
            showToast("Zip code must be 5 digits.", "error");
            zipCodeInputCheck.focus();
            return;
        }

        const numPets = numPetsInput.value;
        const margin = marginSelect.value;
        
        resultsDiv.innerHTML = `<div class="flex items-center justify-center p-4"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary"></div><p class="ml-3 text-muted-foreground">Finding best slots...</p></div>`;
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>`;

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
            showToast(`Error: ${error.message}`, "error");
            resultsDiv.innerHTML = '';
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = `<svg class="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 11 4 4 8-8"/><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Check Availability`;
        }
    }

    function displayCurrentOption(originalZip, numPets, margin) {
        if (availabilityData.length === 0) {
            resultsDiv.innerHTML = `<p class="text-destructive font-semibold text-center p-4">No suitable slots found with the given travel constraints.</p>`;
            return;
        }
        const data = availabilityData[currentOptionIndex];
        const { technician, restrictions, date, availableSlots } = data;
        const friendlyDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        
        const slotsHtml = availableSlots.map(slot => 
            `<button type="button" class="slot-btn btn btn-outline" 
                data-slot="${slot.time}" data-date="${date}" data-tech="${technician}" data-zip="${originalZip}" data-pets="${numPets}"
                data-travel-time="${slot.travelTime}" data-margin="${margin}">
                ${formatToAmPm(slot.time)} (+${slot.travelTime}m travel)
            </button>`
        ).join('');

        const prevButtonHtml = currentOptionIndex > 0 ? `<button id="prev-option-btn" class="btn btn-ghost">← Previous</button>` : `<div></div>`;
        const nextButtonHtml = currentOptionIndex < availabilityData.length - 1 ? `<button id="next-option-btn" class="btn btn-ghost">Next →</button>` : `<div></div>`;
        
        resultsDiv.innerHTML = `
          <div class="space-y-4 p-4 border rounded-lg bg-background">
            <div class="flex justify-between items-center">
              <p class="text-lg font-bold text-brand-primary">Option ${currentOptionIndex + 1} of ${availabilityData.length}</p>
              <div class="flex gap-2">${prevButtonHtml}${nextButtonHtml}</div>
            </div>
            <p class="text-body border-t pt-4">Based on the customer's location, we found these options with <strong>${technician}</strong>:</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p class="text-label">Restrictions:</p>
                <p class="text-base font-medium text-warning-foreground">${restrictions}</p>
              </div>
              <div>
                <p class="text-label">Date:</p>
                <p class="text-base font-semibold">${friendlyDate}</p>
              </div>
            </div>
            <div>
              <p class="text-label">Available Start Times:</p>
              <div class="flex flex-wrap gap-2 mt-2">${slotsHtml}</div>
            </div>
          </div>`;
          
        resultsDiv.querySelectorAll('.slot-btn').forEach(b => b.addEventListener('click', handleSlotSelection));
        if (document.getElementById('prev-option-btn')) document.getElementById('prev-option-btn').addEventListener('click', () => { currentOptionIndex--; displayCurrentOption(originalZip, numPets, margin); });
        if (document.getElementById('next-option-btn')) document.getElementById('next-option-btn').addEventListener('click', () => { currentOptionIndex++; displayCurrentOption(originalZip, numPets, margin); });
    }

    function handleSlotSelection(event) {
        const { slot, date, tech, zip, pets, travelTime, margin } = event.currentTarget.dataset;
        
        mainFormSection.classList.remove('hidden');
        availabilitySection.classList.add('hidden');
        mainFormSection.scrollIntoView({ behavior: 'smooth' });

        if (manualToggle) {
            manualToggle.checked = false;
            manualToggle.dispatchEvent(new Event('change'));
        }

        document.getElementById('appointmentDate').value = `${date}T${slot}`;
        document.getElementById('zipCode').value = zip;
        document.getElementById('pets').value = pets;
        
        document.getElementById('travelTime').value = travelTime;
        document.getElementById('margin').value = margin;

        document.getElementById('suggestedTechDisplay').textContent = tech;
        document.getElementById('suggestedTechSelect').value = tech;

        document.getElementById('zipCode').dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('appointmentDate').dispatchEvent(new Event('input', { bubbles: true }));
    }

    verifyBtn.addEventListener('click', handleVerifyAvailability);
});
