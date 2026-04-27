import { cerrarSesion } from './google-auth.js';

export function inicializarSesionUI() {
    const btnSalir = document.getElementById('btn-salir');
    if (btnSalir) {
        btnSalir.addEventListener('click', async () => {
            await cerrarSesion();
        });
    }
}