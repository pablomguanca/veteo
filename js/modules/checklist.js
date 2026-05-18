import { obtenerProductosEnMemoria } from './vencimientos-db.js';

export function inicializarChecklist() {
    renderizarImpacto();
}

export function recalcularGamificacionTotal() {
    const hoy = new Date();
    const strHoy = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
    let cargasHoy = 0;

    const filasDB = obtenerProductosEnMemoria();
    if (filasDB && filasDB.length) {
        cargasHoy += filasDB.filter(item => {
            const estado = item.ESTADO || '';
            const fechaCarga = String(item.CARGADO_EL || '').trim();
            return estado.includes('CARGADO') && fechaCarga === strHoy;
        }).length;
    }

    try {
        const manuales = JSON.parse(localStorage.getItem('veteo_vencimientos_v1')) || [];
        const strHoyISO = hoy.toISOString().split('T')[0];
        cargasHoy += manuales.filter(item => {
            const estado = item.estado || '';
            const createdAt = item.createdAt || '';
            return estado.includes('CARGADO') && createdAt.startsWith(strHoyISO);
        }).length;
    } catch (e) {}

    localStorage.setItem('veteo_impacto_diario', cargasHoy);
    renderizarImpacto();
}

export function actualizarPosicionGamificacion(posicion) {
    localStorage.setItem('veteo_impacto_posicion', posicion);
    renderizarImpacto();
}

function renderizarImpacto() {
    const cargasHoy = parseInt(localStorage.getItem('veteo_impacto_diario')) || 0;
    const posicionTop = localStorage.getItem('veteo_impacto_posicion') || '-';

    const elCargas = document.getElementById('impact-cargas');
    const elPos = document.getElementById('impact-pos');
    const elStatus = document.getElementById('impact-status');

    if (elCargas) elCargas.textContent = cargasHoy;
    if (elPos) elPos.textContent = posicionTop !== '-' ? `#${posicionTop}` : '-';

    if (elStatus) {
        elStatus.style.display = 'flex';
        elStatus.style.alignItems = 'center';
        elStatus.style.justifyContent = 'center';
        elStatus.style.gap = '6px';

        const svgRayo = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
        const svgFuego = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
        const svgCohete = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`;

        if (cargasHoy === 0) {
            elStatus.innerHTML = `${svgRayo} <span>¡Hacé tu primera carga!</span>`;
            elStatus.style.color = "var(--muted)";
            elStatus.style.background = "transparent";
            elStatus.style.border = "none";
        } else if (cargasHoy < 5) {
            elStatus.innerHTML = `${svgFuego} <span>¡En racha!</span>`;
            elStatus.style.color = "var(--orange)";
            elStatus.style.background = "var(--orange-glow)";
        } else {
            elStatus.innerHTML = `${svgCohete} <span>¡Sos imparable!</span>`;
            elStatus.style.color = "var(--green)";
            elStatus.style.background = "var(--green-glow)";
        }
    }
}