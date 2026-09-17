export const ICONO_COPIAR = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>`;

export const ICONO_COPIADO = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
    </svg>`;

export const ICONO_ELIMINAR = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 6h18" />
        <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M10 11v6M14 11v6" />
    </svg>`;

export function claseUrgencia(dias) {
    if (dias === null || dias === undefined || isNaN(dias)) return '';
    if (dias < 0) return 'venc-row__urgency--vencido';
    if (dias <= 7) return 'venc-row__urgency--7';
    if (dias <= 30) return 'venc-row__urgency--30';
    if (dias <= 60) return 'venc-row__urgency--60';
    return 'venc-row__urgency--90';
}

export function textoUrgencia(dias) {
    if (dias === null || dias === undefined || isNaN(dias)) return 'Sin fecha';
    if (dias < 0) return `Vencido hace ${Math.abs(dias)}d`;
    if (dias === 0) return 'Vence hoy';
    if (dias === 1) return 'Queda 1 día';
    return `Quedan ${dias} días`;
}

export function botonesFila({ etiquetaPrincipal, mostrarUM, permiteEliminar }) {
    const carga = [
        etiquetaPrincipal
            ? `<button type="button" class="venc-row__btn" data-accion="principal" data-action="${etiquetaPrincipal}">${etiquetaPrincipal}</button>`
            : '',
        mostrarUM
            ? `<button type="button" class="venc-row__btn venc-row__btn--um" data-accion="um">UM</button>`
            : '',
    ].join('');

    const herramientas = [
        `<button type="button" class="venc-row__icon" data-accion="copiar" aria-label="Copiar EAN" title="Copiar EAN">${ICONO_COPIAR}</button>`,
        permiteEliminar
            ? `<button type="button" class="venc-row__icon venc-row__icon--danger" data-accion="eliminar" aria-label="Eliminar producto" title="Eliminar producto">${ICONO_ELIMINAR}</button>`
            : '',
    ].join('');

    return `${carga}<span class="venc-row__tools">${herramientas}</span>`;
}

export async function confirmarEliminacion(descripcion, origen) {
    const nombre = descripcion || 'este producto';

    if (!window.Swal) {
        return window.confirm(`¿Eliminar ${nombre}?`);
    }

    const resultado = await window.Swal.fire({
        title: '¿Eliminar producto?',
        html: `Vas a eliminar <strong>${nombre}</strong> de ${origen}.<br />Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar',
        focusCancel: true,
        reverseButtons: true,
        customClass: { popup: 'swal-veteo' },
    });

    return resultado.isConfirmed;
}
