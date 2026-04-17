const MENSAJES_DIARIOS = {
    0: 'Hoy es domingo. Revisá formularios disponibles. Último día para cargar Acciones Especiales y Rescates.',
    1: 'Hoy es lunes. Revisá PAS, PCH y el cierre de ventanas del fin de semana.',
    2: 'Hoy es martes. Controlá pendientes de PFT Carnes y vencimientos críticos.',
    3: 'Hoy es miércoles. Revisá formularios activos: foco en PFT general y Última Milla, no esperes al Finde!',
    4: 'Hoy es jueves. PFT hasta las 10 AM! Dejá preparada la gestión para las ventanas del viernes y el fin de semana.',
    5: 'Hoy es viernes. Controlá Acciones Especiales, PFT, Rescates y Cíclicos de FyV y Carnes',
    6: 'Hoy es sábado. Revisá formularios como Bulnez & Carrefour y último llamado a Rescates.',
};

export function inicializarMensajeDelDia() {
    const elementoMensaje = document.getElementById('today-msg');
    if (!elementoMensaje) return;

    const diaActual = new Date().getDay();
    elementoMensaje.textContent = MENSAJES_DIARIOS[diaActual] ?? 'Revisá vencimientos y usá los formularios habilitados según la etapa.';
}