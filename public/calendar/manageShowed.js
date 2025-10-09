// public/calendar/manageShowed.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos ---
    const showedAppointmentsTableBody = document.getElementById('showed-appointments-table-body');
    const accessPasswordBtn = document.getElementById('access-password-btn');
    const manageShowedLockScreen = document.getElementById('manage-showed-lock-screen');
    const manageShowedContent = document.getElementById('manage-showed-content');

    if (!showedAppointmentsTableBody || !accessPasswordBtn || !manageShowedLockScreen || !manageShowedContent) {
        console.error("One or more required elements for ManageShowed script are missing.");
        return;
    }

    // --- Variáveis de Estado ---
    let localAppointments = [];
    let localSelectedTechnician = '';
    let localCurrentWeekStart = new Date();

    // --- Funções Auxiliares ---
    function parseSheetDate(dateStr) {
        if (!dateStr) return null;
        const [datePart, timePart] = dateStr.split(' ');
        if (!datePart || !timePart) return null;
        const dateParts = datePart.split('/');
        if (dateParts.length !== 3) return null;
        const [month, day, year] = dateParts.map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null;
        return new Date(year, month - 1, day, hour, minute);
    }

    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        const date = parseSheetDate(dateTimeStr);
        if (!date) return '';
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hour}:${minute}`;
    }

    // --- Lógica de Desbloqueio por Senha ---
    accessPasswordBtn.addEventListener('click', async () => {
        const password = prompt("Please enter the access password:");
        if (password === null) { // Usuário clicou em "Cancelar"
            return; 
        }

        try {
            accessPasswordBtn.disabled = true;
            accessPasswordBtn.textContent = "Verifying...";

            const response = await fetch('/api/verify-fkey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password })
            });

            const result = await response.json();

            if (result.success) {
                manageShowedLockScreen.classList.add('hidden');
                manageShowedContent.classList.remove('hidden');
                // Após desbloquear, renderiza a tabela com os dados já carregados
                renderShowedAppointmentsTable();
            } else {
                alert('Incorrect password. Please try again.');
            }
        } catch (error) {
            console.error("Error verifying password:", error);
            alert("An error occurred while trying to verify the password. Please check the console.");
        } finally {
            accessPasswordBtn.disabled = false;
            accessPasswordBtn.textContent = "Access with Password";
        }
    });

    // --- Lógica de Renderização da Tabela ---
    function renderShowedAppointmentsTable() {
        if (!showedAppointmentsTableBody) return;
        
        showedAppointmentsTableBody.innerHTML = '';
        const weekEnd = new Date(localCurrentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const appointmentsForWeek = localAppointments.filter(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            return appt.technician === localSelectedTechnician && apptDate && apptDate >= localCurrentWeekStart && apptDate < weekEnd;
        }).sort((a, b) => (parseSheetDate(a.appointmentDate)?.getTime() || 0) - (parseSheetDate(b.appointmentDate)?.getTime() || 0));
        
        if (appointmentsForWeek.length === 0) {
            showedAppointmentsTableBody.innerHTML = '<tr><td colspan="10" class="p-4 text-center text-muted-foreground">No appointments for this technician in the selected week.</td></tr>';
            return;
        }

        appointmentsForWeek.forEach(appointment => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-muted/50';
            row.dataset.rowId = appointment.id;
            const statusOptions = ["Scheduled", "Confirmed", "Showed", "Canceled"];
            row.innerHTML = `
                <td class="p-4"><input type="datetime-local" value="${formatDateTimeForInput(appointment.appointmentDate)}" style="width: 160px;" class="input-base h-9 text-sm" data-key="appointmentDate"></td>
                <td class="p-4">${appointment.customers.length > 18 ? appointment.customers.substring(0, 15) + '...' : appointment.customers}</td>
                <td class="p-4">${appointment.code}</td>
                <td class="p-4"><input type="text" value="${appointment.technician}" class="input-base h-9 text-sm" data-key="technician" disabled></td>
                <td class="p-4"><select style="width: 80px;" class="input-base h-9 text-sm" data-key="petShowed"><option value="">Pets</option>${Array.from({ length: 10 }, (_, i) => i + 1).map(num => `<option value="${num}" ${appointment.petShowed == String(num) ? 'selected' : ''}>${num}</option>`).join('')}</select></td>
                <td class="p-4"><input type="text" value="${appointment.serviceShowed || ''}" style="width: 100px;" class="input-base h-9 text-sm" data-key="serviceShowed"></td>
                <td class="p-4"><input type="text" value="${appointment.tips || ''}" style="width: 80px;" class="input-base h-9 text-sm" data-key="tips"></td>
                <td class="p-4"><select style="width: 80px;" class="input-base h-9 text-sm" data-key="percentage"><option value="">%</option>${["20%", "25%"].map(opt => `<option value="${opt}" ${appointment.percentage === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select></td>
                <td class="p-4"><select style="width: 120px;" class="input-base h-9 text-sm" data-key="paymentMethod"><option value="">Select...</option>${["Check", "American Express", "Apple Pay", "Discover", "Master Card", "Visa", "Zelle", "Cash", "Invoice"].map(opt => `<option value="${opt}" ${appointment.paymentMethod === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select></td>
                <td class="p-4"><select style="width: 100px;" class="input-base h-9 text-sm" data-key="verification">${statusOptions.map(opt => `<option value="${opt}" ${appointment.verification === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select></td>
            `;
            showedAppointmentsTableBody.appendChild(row);
        });
    }

    // --- Ouvinte de Eventos Globais ---
    document.addEventListener('stateUpdated', (event) => {
        localAppointments = event.detail.allAppointments;
        localSelectedTechnician = event.detail.technician;
        localCurrentWeekStart = event.detail.weekStart;
        
        // Renderiza a tabela somente se a seção de gerenciamento já estiver visível (desbloqueada).
        if (!manageShowedContent.classList.contains('hidden')) {
            renderShowedAppointmentsTable();
        }
    });
});
