import { cerrarSesion, iniciarSesionGoogle } from './google-auth.js';

export function inicializarSesionUI() {
    const btnSalir = document.getElementById('btn-salir');
    const btnGoogleFront = document.getElementById('btn-google-front');

    if (btnSalir) {
        btnSalir.addEventListener('click', async () => {
            await cerrarSesion();
        });
    }

    if (btnGoogleFront) {
        btnGoogleFront.addEventListener('click', () => {
            iniciarSesionGoogle();
        });
    }
}