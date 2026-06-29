import { cerrarSesion } from './auth.js';

export function inicializarSesionUI() {
    const btnSalir = document.getElementById('btn-salir');
    if (btnSalir) btnSalir.addEventListener('click', cerrarSesion);
}