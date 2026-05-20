import { obtenerUsuarioActual, cerrarSesion } from './google-auth.js';
import { trackearEvento } from './analytics.js';

function cargarLinkSheets(linkEl) {
    try {
        const spreadsheetUrl = localStorage.getItem('veteo_sheets_url');
        if (spreadsheetUrl) {
            linkEl.href = spreadsheetUrl;
            linkEl.hidden = false;
        }
    } catch (e) {
        console.warn('No se pudo cargar el link de Sheets:', e);
    }
}

function poblarPerfil() {
    const usuario = obtenerUsuarioActual();
    if (!usuario) return;

    const avatar = document.getElementById('sidebar-avatar');
    const nombre = document.getElementById('sidebar-nombre');
    const email = document.getElementById('sidebar-email');
    const sheetsLink = document.getElementById('sidebar-sheets-link');

    if (avatar) avatar.src = usuario.foto || '';
    if (nombre) nombre.textContent = usuario.nombre || '';
    if (email) email.textContent = usuario.email || '';

    if (sheetsLink) cargarLinkSheets(sheetsLink);
}

export function inicializarSidebar() {
    const btnTrigger = document.getElementById('sidebar-open');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const btnSalir = document.getElementById('btn-salir');

    poblarPerfil();

    const toggleSidebar = () => {
        const estaAbierto = sidebar.classList.contains('sidebar--open');
        sidebar.classList.toggle('sidebar--open');
        btnTrigger?.classList.toggle('is-active');

        if (overlay) overlay.hidden = estaAbierto;
        document.body.style.overflow = estaAbierto ? '' : 'hidden';
    };

    btnTrigger?.addEventListener('click', toggleSidebar);
    overlay?.addEventListener('click', toggleSidebar);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && sidebar?.classList.contains('sidebar--open')) {
            toggleSidebar();
        }
    });

    btnSalir?.addEventListener('click', cerrarSesion);
}