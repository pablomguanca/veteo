export function alternarEstadoVacio(elementoVacio, tieneDatos) {
    if (!elementoVacio) return;
    elementoVacio.style.display = tieneDatos ? 'none' : 'flex';
}