export function alternarEstadoVacio(elementoVacio, tieneDatos) {
    if (!elementoVacio) return;
    elementoVacio.style.display = tieneDatos ? 'none' : 'flex';
}

const FORMATO_MONEDA = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export function formatearMoneda(valor) {
    const numero = Number(valor);
    if (!isFinite(numero)) return '';
    return FORMATO_MONEDA.format(numero);
}

export function aNumero(valor) {
    if (typeof valor === 'number') return isFinite(valor) ? valor : null;

    const crudo = String(valor ?? '').replace(/[^\d.,-]/g, '').trim();
    if (!crudo) return null;

    const tienePunto = crudo.includes('.');
    const tieneComa = crudo.includes(',');

    const normalizado = tienePunto && tieneComa
        ? crudo.replace(/\./g, '').replace(',', '.')
        : crudo.replace(',', '.');

    const numero = parseFloat(normalizado);
    return isFinite(numero) ? numero : null;
}