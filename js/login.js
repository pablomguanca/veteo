import { inicializarAutenticacion } from './modules/google-auth.js';
inicializarAutenticacion();

document.addEventListener('DOMContentLoaded', () => {
    inicializarAutenticacionGoogle();
});