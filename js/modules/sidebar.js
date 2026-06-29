import { obtenerTiendaId, cerrarSesion, obtenerOperador, mostrarSelectorOperador } from './auth.js';
import { trackearEvento } from './analytics.js';

function poblarPerfil() {
    const tiendaId = obtenerTiendaId();
    if (!tiendaId) return;

    const operador = obtenerOperador();

    const nombre   = document.getElementById('sidebar-nombre');
    const email    = document.getElementById('sidebar-email');
    const avatar   = document.getElementById('sidebar-avatar');
    const sheetsLink = document.getElementById('sidebar-sheets-link');

    if (nombre) nombre.textContent = operador?.nombre || `Tienda ${tiendaId}`;
    if (email)  email.textContent  = `Tienda ${tiendaId}`;
    if (avatar) avatar.src         = '';

    if (sheetsLink) sheetsLink.hidden = true;
}

export function inicializarSidebar() {
    const btnTrigger = document.getElementById('sidebar-open');
    const sidebar    = document.getElementById('sidebar');
    const overlay    = document.getElementById('sidebar-overlay');
    const btnSalir   = document.getElementById('btn-salir');
    const btnCambiarOperador = document.getElementById('btn-cambiar-operador');

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
        if (e.key === 'Escape' && sidebar?.classList.contains('sidebar--open')) toggleSidebar();
    });

    btnSalir?.addEventListener('click', cerrarSesion);

    btnCambiarOperador?.addEventListener('click', () => {
        const tiendaId = obtenerTiendaId();
        if (!tiendaId) return;
        toggleSidebar();
        mostrarSelectorOperador(tiendaId, () => poblarPerfil());
    });

    window.addEventListener('veteo:operadorSeleccionado', () => poblarPerfil());
}