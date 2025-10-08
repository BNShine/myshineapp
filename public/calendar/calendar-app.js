// public/calendar/calendar-app.js

const { createApp, ref, reactive, computed, onMounted } = Vue;

createApp({
  setup() {
    // --- ESTADO REATIVO (DATA) ---
    const state = reactive({
      allAppointments: [],
      allTechnicians: [],
      techAvailabilityBlocks: [],
      selectedTechnician: '',
      currentWeekStart: getStartOfWeek(new Date()),
      miniCalDate: new Date(),
      isLoading: true,
      // Itinerary State
      dayAppointments: [],
      selectedDayFilter: '',
      itineraryResult: {
        message: 'No route calculated.',
        legs: [],
        totalDuration: '',
        totalDistance: ''
      },
      isOptimizing: false,
      // Modal State
      isEditModalVisible: false,
      editingAppointment: null,
    });

    // --- FUNÇÕES AUXILIARES DE DATA (não reativas) ---
    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        return d;
    }

    function formatDateToYYYYMMDD(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}/${month}/${day}`;
    }
    
    function parseSheetDate(dateStr) {
        if (!dateStr) return null;
        const [datePart, timePart] = dateStr.split(' ');
        if (!datePart || !timePart) return null;
        const [month, day, year] = datePart.split('/').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        if ([year, month, day, hour, minute].some(isNaN)) return null;
        return new Date(year, month - 1, day, hour, minute);
    }

    // --- DADOS COMPUTADOS (COMPUTED) ---
    const weekDisplay = computed(() => {
        const endOfWeek = new Date(state.currentWeekStart);
        endOfWeek.setDate(state.currentWeekStart.getDate() + 6);
        return `${state.currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
    });

    const schedulerDays = computed(() => {
        return Array.from({ length: 7 }).map((_, i) => {
            const date = new Date(state.currentWeekStart);
            date.setDate(date.getDate() + i);
            return {
                name: date.toLocaleDateString('en-US', { weekday: 'short' }),
                date: date.getDate(),
                dateKey: formatDateToYYYYMMDD(date)
            };
        });
    });

    const appointmentsInView = computed(() => {
        if (!state.selectedTechnician) return [];
        const weekEnd = new Date(state.currentWeekStart);
        weekEnd.setDate(state.currentWeekStart.getDate() + 7);

        return state.allAppointments.filter(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            return appt.technician === state.selectedTechnician && apptDate >= state.currentWeekStart && apptDate < weekEnd;
        });
    });

    // --- MÉTODOS (METHODS) ---
    
    // Carregamento inicial
    const loadInitialData = async () => {
        state.isLoading = true;
        try {
            // *** CORREÇÃO APLICADA AQUI ***
            const [techResponse, apptResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-technician-appointments') 
            ]);

            if (!techResponse.ok || !apptResponse.ok) {
                throw new Error('Failed to fetch initial data from one or more endpoints.');
            }

            const techData = await techResponse.json();
            const apptData = await apptResponse.json();

            state.allTechnicians = techData.technicians || [];
            state.allAppointments = (apptData.appointments || []).filter(a => a.appointmentDate);
        } catch (error) {
            console.error("Failed to load initial data:", error);
            alert("Error loading data. Please check the console.");
        } finally {
            state.isLoading = false;
        }
    };
    
    // Navegação do Calendário
    const changeWeek = (direction) => {
        state.currentWeekStart.setDate(state.currentWeekStart.getDate() + direction * 7);
        state.currentWeekStart = new Date(state.currentWeekStart);
    };

    const goToToday = () => {
        state.currentWeekStart = getStartOfWeek(new Date());
        state.miniCalDate = new Date();
    };
    
    // Ações do Modal
    const openEditModal = (appointment) => {
        state.editingAppointment = { ...appointment };
        state.editingAppointment.appointmentDate = formatDateTimeForInput(appointment.appointmentDate);
        state.isEditModalVisible = true;
    };

    const closeEditModal = () => {
        state.isEditModalVisible = false;
        state.editingAppointment = null;
    };
    
    const handleSaveAppointment = async () => {
        if (!state.editingAppointment) return;
        
        const [datePart, timePart] = state.editingAppointment.appointmentDate.split('T');
        const [year, month, day] = datePart.split('-');
        const apiFormattedDate = `${month}/${day}/${year} ${timePart}`;

        const dataToUpdate = {
            rowIndex: state.editingAppointment.id,
            appointmentDate: apiFormattedDate,
            verification: state.editingAppointment.verification,
            technician: state.editingAppointment.technician,
            petShowed: state.editingAppointment.petShowed,
            serviceShowed: state.editingAppointment.serviceShowed,
            tips: state.editingAppointment.tips,
            percentage: state.editingAppointment.percentage,
            paymentMethod: state.editingAppointment.paymentMethod,
        };

        try {
            // *** CORREÇÃO APLICADA AQUI ***
            const response = await fetch('/api/update-appointment-showed-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToUpdate),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            const index = state.allAppointments.findIndex(a => a.id === state.editingAppointment.id);
            if (index !== -1) {
                state.editingAppointment.appointmentDate = apiFormattedDate.replace(/-/g, '/');
                state.allAppointments[index] = { ...state.editingAppointment };
            }
            closeEditModal();
        } catch (error) {
            alert(`Error saving: ${error.message}`);
        }
    };

    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        const date = parseSheetDate(dateTimeStr);
        if (!date) return '';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    // --- CICLO DE VIDA ---
    onMounted(loadInitialData);

    // --- EXPOSIÇÃO PARA O TEMPLATE ---
    return {
      state,
      weekDisplay,
      schedulerDays,
      appointmentsInView,
      changeWeek,
      goToToday,
      openEditModal,
      closeEditModal,
      handleSaveAppointment,
      parseSheetDate, 
      formatDateToYYYYMMDD,
      TIME_SLOTS: Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`),
      SLOT_HEIGHT_PX: 60,
      MIN_HOUR: 7,
    };
  }
}).mount('#calendar-app');
