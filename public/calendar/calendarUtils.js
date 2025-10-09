// public/calendar/calendarUtils.js

function getStartOfWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
}

function formatDateToYYYYMMDD(date) {
    if (!(date instanceof Date) || isNaN(date)) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
}

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

function getTimeHHMM(date) {
    if (!date) return '';
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
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

async function getTravelTime(originZip, destinationZip) {
    if (!originZip || !destinationZip || originZip === destinationZip) {
        return 0;
    }
    try {
        const response = await fetch('/api/get-travel-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originZip, destinationZip }),
        });
        const result = await response.json();
        return result.success ? result.travelTimeInMinutes : 0;
    } catch (error) {
        console.error("Failed to fetch travel time:", error);
        return 0;
    }
}
