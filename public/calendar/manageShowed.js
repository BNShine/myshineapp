// public/calendar/manageShowed.js

document.addEventListener('DOMContentLoaded', () => {
    const showedAppointmentsTableBody = document.getElementById('showed-appointments-table-body');
    if (!showedAppointmentsTableBody) return;

    let localAppointments = [];
    let localSelectedTechnician = '';
    let localCurrentWeekStart = new Date();

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

    function renderShowedAppointmentsTable() {
        if(!showedAppointmentsTableBody) return;
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
            row.className = 'border-b border-border hover:bg-muted/50';
            row.dataset.rowId = appointment.id;
            const statusOptions = ["Scheduled", "Confirmed", "Showed", "Canceled"];
            row.innerHTML = `
                <td class="p-4"><input type="datetime-local" value="${formatDateTimeForInput(appointment.appointmentDate)}" style="width: 160px;" class="bg-transparent border border-border rounded-md px-2" data-key="appointmentDate"></td>
                <td class="p-4">${appointment.customers.length > 18 ? appointment.customers.substring(0, 15) + '...' : appointment.customers}</td>
                <td class="p-4">${appointment.code}</td>
                <td class="p-4"><input type="text" value="${appointment.technician}" class="bg-transparent border border-border rounded-md px-2" data-key="technician" disabled></td>
                <td class="p-4"><select style="width: 60px;" class="bg-transparent border border-border rounded-md px-2" data-key="petShowed"><option value="">Pets</option>${Array.from({ length: 10 }, (_, i) => i + 1).map(num => `<option value="${num}" ${appointment.petShowed == String(num) ? 'selected' : ''}>${num}</option>`).join('')}</select></td>
                <td class="p-4"><input type="text" value="${appointment.serviceShowed || ''}" style="width: 100px;" class="bg-transparent border border-border rounded-md px-2" data-key="serviceShowed"></td>
                <td class="p-4"><input type="text" value="${appointment.tips || ''}" style="width: 80px;" class="bg-transparent border border-border rounded-md px-2" data-key="tips"></td>
                <td class="p-4"><select style="width: 80px;" class="bg-transparent border border-border rounded-md px-2" data-key="percentage"><option value="">%</option>${["20%", "25%"].map(opt => `<option value="${opt}" ${appointment.percentage === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select></td>
                <td class="p-4"><select style="width: 120px;" class="bg-transparent border border-border rounded-md px-2" data-key="paymentMethod"><option value="">Select...</option>${["Check", "American Express", "Apple Pay", "Discover", "Master Card", "Visa", "Zelle", "Cash", "Invoice"].map(opt => `<option value="${opt}" ${appointment.paymentMethod === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select></td>
                <td class="p-4"><select style="width: 100px;" class="bg-transparent border border-border rounded-md px-2" data-key="verification">${statusOptions.map(opt => `<option value="${opt}" ${appointment.verification === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select></td>
            `;
            showedAppointmentsTableBody.appendChild(row);
        });
    }

    // Ouve o evento unificado para receber todos os dados e se atualizar
    document.addEventListener('stateUpdated', (e) => {
        localAppointments = e.detail.allAppointments;
        localSelectedTechnician = e.detail.technician;
        localCurrentWeekStart = e.detail.weekStart;
        renderShowedAppointmentsTable();
    });
});
