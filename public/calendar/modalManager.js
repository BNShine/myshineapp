// public/calendar/modalManager.js (Gerenciador de Modais)

document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos para os Modais ---
    const editModal = document.getElementById('edit-appointment-modal');
    const timeBlockModal = document.getElementById('time-block-modal');
    const editTimeBlockModal = document.getElementById('edit-time-block-modal');

    // Botões de fechar do modal de edição de agendamento
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalCloseXBtn = document.getElementById('modal-close-x-btn');

    // Seletor para o botão de cancelar do modal "Edit Time Block"
    const editBlockCancelBtn = document.getElementById('edit-block-cancel-btn');

    // Funções para abrir/fechar os modais
    window.openEditModal = (appt, allTechnicians) => {
        if (!editModal) return;
        const { id, appointmentDate, verification, technician, pets, margin } = appt;
        document.getElementById('modal-appt-id').value = id;
        document.getElementById('modal-date').value = formatDateTimeForInput(appointmentDate);
        document.getElementById('modal-pets').value = pets || 1;
        document.getElementById('modal-margin').value = margin || 30;
        
        const techSelect = document.getElementById('modal-technician');
        techSelect.innerHTML = allTechnicians.map(t => `<option value="${t}" ${t === technician ? 'selected' : ''}>${t}</option>`).join('');

        const verificationSelect = document.getElementById('modal-verification');
        const statusOptions = ["Scheduled", "Confirmed", "Showed", "Canceled"];
        verificationSelect.innerHTML = statusOptions.map(opt => `<option value="${opt}" ${verification === opt ? 'selected' : ''}>${opt}</option>`).join('');
        
        editModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    };

    window.closeEditModal = () => {
        if (editModal) editModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    };

    // --- Listeners para fechar o modal de edição ---
    if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', window.closeEditModal);
    }
    if (modalCloseXBtn) {
        modalCloseXBtn.addEventListener('click', window.closeEditModal);
    }

    window.openTimeBlockModal = (selectedTechnician) => {
        if (!timeBlockModal) return;
        if (!selectedTechnician) {
            alert('Please select a technician first.');
            return;
        }
        document.getElementById('time-block-form').reset();
        timeBlockModal.classList.remove('hidden');
    };

    window.closeTimeBlockModal = () => {
        if (timeBlockModal) timeBlockModal.classList.add('hidden');
    };

    window.openEditTimeBlockModal = (blockData) => {
        if (!editTimeBlockModal) return;
        document.getElementById('edit-block-row-number').value = blockData.rowNumber;
        const [month, day, year] = blockData.date.split('/');
        document.getElementById('edit-block-date').value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        document.getElementById('edit-block-start-hour').value = blockData.startHour;
        document.getElementById('edit-block-end-hour').value = blockData.endHour;
        document.getElementById('edit-block-notes').value = blockData.notes;
        editTimeBlockModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    };

    window.closeEditTimeBlockModal = () => {
        if (editTimeBlockModal) editTimeBlockModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    };
    
    // Adicionar o ouvinte de evento para o botão de cancelar do modal de edição de time block
    if (editBlockCancelBtn) {
        editBlockCancelBtn.addEventListener('click', window.closeEditTimeBlockModal);
    }
});
