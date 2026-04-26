import { iniciarSesionGoogle } from './modules/google-auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnGoogle = document.getElementById('btn-google');
    
    if (btnGoogle) {
        btnGoogle.addEventListener('click', () => {
            iniciarSesionGoogle();
        });
    }
});