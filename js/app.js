import { inicializarFecha } from './modules/fecha.js';
import { inicializarMensajeDelDia } from './modules/mensaje-diario.js';
import { inicializarChecklist } from './modules/checklist.js';
import { inicializarVencimientos } from './modules/vencimientos.js';
import { inicializarNotificaciones } from './modules/notificaciones.js';
import { registrarServiceWorker } from './modules/sw-register.js';
import { inicializarEstadoFormularios } from './modules/estado-formularios.js';
import { inicializarBaseDatosVencimientos } from './modules/vencimientos-db.js';
import { inicializarEnlaces } from './modules/enlaces.js';
import { inicializarEscaner } from './modules/escaner.js';
import { inicializarSesionUI } from './modules/sesion-ui.js';
import { inicializarAutenticacionGoogle } from './modules/google-auth.js';
import { inicializarFiltros } from './modules/filtros.js';

document.addEventListener('DOMContentLoaded', () => {
    inicializarAutenticacionGoogle();
    inicializarFecha();
    inicializarMensajeDelDia();
    inicializarChecklist();
    inicializarVencimientos();
    inicializarNotificaciones();
    registrarServiceWorker();
    inicializarEstadoFormularios();
    inicializarBaseDatosVencimientos();
    inicializarEnlaces();
    inicializarEscaner();
    inicializarSesionUI();
    inicializarFiltros();
});