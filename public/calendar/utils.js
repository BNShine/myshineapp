// public/calendar/utils.js

/**
 * Retorna o início da semana (domingo) para uma data específica.
 * @param {Date} date A data de referência.
 * @returns {Date} O objeto Date representando o início da semana.
 */
function getStartOfWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
}

/**
 * Formata um objeto Date para o formato YYYY/MM/DD.
 * @param {Date} date O objeto Date.
 * @returns {string} A data formatada.
 */
function formatDateToYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
}

/**
 * Converte uma string de data da planilha (MM/DD/YYYY HH:MM) para um objeto Date.
 * @param {string} dateStr A string da data.
 * @returns {Date|null} O objeto Date ou null se a string for inválida.
 */
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

/**
 * Formata uma string de data da planilha para o formato de input datetime-local (YYYY-MM-DDTHH:MM).
 * @param {string} dateTimeStr A string da data da planilha.
 * @returns {string} A data formatada para o input.
 */
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

/**
 * Extrai a hora (HH:MM) de um objeto Date.
 * @param {Date} date O objeto Date.
 * @returns {string} A hora formatada.
 */
function getTimeHHMM(date) {
    if (!date) return '';
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Retorna a data para um dia específico da semana com base na data de início da semana.
 * @param {Date} startOfWeekDate O início da semana.
 * @param {number} dayOfWeek O dia da semana (0 para Domingo, 1 para Segunda, etc.).
 * @returns {Date} O objeto Date para o dia solicitado.
 */
function getDayOfWeekDate(startOfWeekDate, dayOfWeek) {
    const date = new Date(startOfWeekDate);
    date.setDate(startOfWeekDate.getDate() + dayOfWeek);
    return date;
}
