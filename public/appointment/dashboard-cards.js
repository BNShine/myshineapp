// public/appointment/dashboard-cards.js

document.addEventListener('DOMContentLoaded', () => {
    
    const cardContainers = {
        todayAppointments: document.getElementById('card-today-appointments'),
        customersMonth: document.getElementById('card-customers-month'),
        petsMonth: document.getElementById('card-pets-month'),
        topCloser: document.getElementById('card-top-closer')
    };

    function renderSkeletons() {
        const skeletonHtml = `
            <div class="flex items-center justify-between mb-4">
                <div class="h-4 bg-muted rounded w-2/3 animate-pulse"></div>
                <div class="h-8 w-8 rounded-full bg-muted animate-pulse"></div>
            </div>
            <div class="h-8 bg-muted rounded w-1/2 animate-pulse"></div>
            <div class="h-4 bg-muted rounded w-1/3 mt-2 animate-pulse"></div>
        `;
        Object.values(cardContainers).forEach(container => {
            if (container) container.innerHTML = skeletonHtml;
        });
    }

    function renderCard(container, { title, value, subtitle, subtitleColor, icon, iconBgColor }) {
        if (!container) return;
        const iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;
        
        container.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-small">${title}</h3>
                <div class="h-8 w-8 rounded-full flex items-center justify-center text-white" style="background-color: ${iconBgColor};">
                    ${iconHtml}
                </div>
            </div>
            <p class="text-3xl font-bold text-foreground">${value}</p>
            <p class="text-sm font-medium" style="color: ${subtitleColor};">${subtitle}</p>
        `;
    }

    async function fetchAndRenderDashboardData() {
        renderSkeletons();

        try {
            const dataResponse = await fetch('/api/get-dashboard-data');
            if (!dataResponse.ok) throw new Error('Failed to load dashboard data.');
            const data = await dataResponse.json();
            const { appointments } = data;
            
            // Funções auxiliares para cálculos
            const formatDateToMMDDYYYY = (dateObj) => {
                const year = dateObj.getFullYear();
                const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                const day = dateObj.getDate().toString().padStart(2, '0');
                return `${month}/${day}/${year}`;
            };

            const today = formatDateToMMDDYYYY(new Date());
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayFormatted = formatDateToMMDDYYYY(yesterday);

            const todayAppointments = appointments.filter(a => a.date === today);
            const yesterdayAppointments = appointments.filter(a => a.date === yesterdayFormatted);
            const difference = todayAppointments.length - yesterdayAppointments.length;

            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            const thisMonthAppointments = appointments.filter(a => {
                const parts = a.date.split('/');
                return parseInt(parts[0], 10) === currentMonth && parseInt(parts[2], 10) === currentYear;
            });
            
            const thisMonthPetsCount = thisMonthAppointments.reduce((sum, a) => sum + (parseInt(a.pets) || 0), 0);
            
            const closerCounts = thisMonthAppointments.reduce((acc, a) => {
                if (a.closer1) acc[a.closer1] = (acc[a.closer1] || 0) + 1;
                return acc;
            }, {});
            let bestSeller = Object.keys(closerCounts).reduce((a, b) => closerCounts[a] > closerCounts[b] ? a : b, '--');
            if (bestSeller !== '--') {
                const nameParts = bestSeller.split(' ');
                if (nameParts.length > 1) {
                    bestSeller = `${nameParts[0]} ${nameParts[1].charAt(0)}.`;
                }
            }
            
            renderCard(cardContainers.todayAppointments, {
                title: "Today's Appointments",
                value: todayAppointments.length,
                subtitle: `${difference >= 0 ? '+' : ''}${difference} from yesterday`,
                subtitleColor: difference > 0 ? 'hsl(var(--success))' : (difference < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))'),
                icon: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>`,
                iconBgColor: 'hsl(var(--success-background))'
            });
            
            renderCard(cardContainers.customersMonth, {
                title: "Customers This Month",
                value: thisMonthAppointments.length,
                subtitle: `in ${new Date().toLocaleString('default', { month: 'long' })}`,
                subtitleColor: 'hsl(var(--muted-foreground))',
                icon: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
                iconBgColor: 'hsl(var(--info-background))'
            });

             renderCard(cardContainers.petsMonth, {
                title: "Pets Scheduled",
                value: thisMonthPetsCount,
                subtitle: `this month`,
                subtitleColor: 'hsl(var(--muted-foreground))',
                icon: `<path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M12 8v4"/><path d="m8.5 14.5.8-1.3a2 2 0 0 1 3.4 0l.8 1.3"/><path d="M7 4v2"/><path d="M17 4v2"/>`,
                iconBgColor: 'hsl(var(--warning-background))'
            });

             renderCard(cardContainers.topCloser, {
                title: "Top Closer",
                value: bestSeller,
                subtitle: "This month's top performer",
                subtitleColor: 'hsl(var(--muted-foreground))',
                icon: `<path d="M12 6.52c.42-.25.86-.42 1.32-.52"/><path d="m8.68 6-1.32.52C2.86 8.41 1.5 12.52 4.05 16.5c2.55 3.98 7.26 5.86 11.45 4.36s6.3-6.22 4.36-11.45c-.2-.53-.44-.93-.72-1.32"/><path d="M15.32 6 14 5.48c.42-.25.86-.42 1.32-.52"/><path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M12 22v-2"/>`,
                iconBgColor: 'hsl(var(--brand-primary))'
            });

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            Object.values(cardContainers).forEach(container => {
                if(container) container.innerHTML = `<p class="text-destructive">Failed to load data</p>`;
            });
        }
    }

    fetchAndRenderDashboardData();
});
