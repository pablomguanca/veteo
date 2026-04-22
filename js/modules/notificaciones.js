import { obtenerProductosEnMemoria } from './vencimientos-db.js';
import { obtenerUsuarioActual } from './google-auth.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging.js";
import { CONFIGURACION } from './config.js';

const app = initializeApp(CONFIGURACION.firebase);
const mensajeria = getMessaging(app);
const CLAVE_ALMACENAMIENTO_NOTIFICACIONES = 'veteo_notif_config_v1';

function cargarConfiguracion() {
    try { return JSON.parse(localStorage.getItem(CLAVE_ALMACENAMIENTO_NOTIFICACIONES)) || null; }
    catch { return null; }
}

function guardarConfiguracion(configuracion) {
    localStorage.setItem(CLAVE_ALMACENAMIENTO_NOTIFICACIONES, JSON.stringify(configuracion));
}

function limpiarConfiguracion() {
    localStorage.removeItem(CLAVE_ALMACENAMIENTO_NOTIFICACIONES);
}

function establecerEstado(punto, texto, textoEstado, estado) {
    const estados = {
        inactivo:  { clasePunto: '', etiqueta: 'Sin configurar' },
        activo:    { clasePunto: 'notif-status__dot--active', etiqueta: 'Activo' },
        denegado:  { clasePunto: 'notif-status__dot--denied', etiqueta: 'Bloqueado' },
    };
    const seleccion = estados[estado] ?? estados.inactivo;
    punto.className = `notif-status__dot ${seleccion.clasePunto}`;
    texto.textContent = textoEstado || seleccion.etiqueta;
}

function parsearFecha(cadenaFecha) {
    if (!cadenaFecha) return null;
    const s = String(cadenaFecha).trim();

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [d, m, a] = s.split('/');
        return new Date(`${a}-${m}-${d}T00:00:00`);
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        return new Date(s.slice(0, 10) + 'T00:00:00');
    }

    const fallback = new Date(s);
    return isNaN(fallback) ? null : fallback;
}

function mostrarBanner(refs, { mensaje, etiquetaBoton, alHacerClic, modificadorExtra = null }) {
    const { banner, textoBanner, botonBanner } = refs;

    banner.classList.remove('vdb-alert--warning');
    if (modificadorExtra) banner.classList.add(modificadorExtra);

    textoBanner.textContent = mensaje;
    botonBanner.textContent = etiquetaBoton;
    botonBanner.hidden = false;
    botonBanner.onclick = alHacerClic;
    banner.hidden = false;
}

function ocultarBanner(refs) {
    refs.banner.hidden = true;
}

function contarCriticos() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const esCritico = (fecha) => {
        const objetivo = parsearFecha(fecha);
        if (!objetivo || isNaN(objetivo)) return false;
        const dias = Math.round((objetivo - hoy) / 864e5);
        return dias >= 0 && dias <= 7;
    };

    const datosManuales = (() => {
        try { return JSON.parse(localStorage.getItem('veteo_vencimientos_v1')) || []; }
        catch { return []; }
    })();
    const criticosManuales = datosManuales.filter(item => esCritico(item.fecha));

    const datosPlanilla = obtenerProductosEnMemoria();
    const criticosPlanilla = datosPlanilla.filter(item => {
        const estado = (item.ESTADO || item.estado || '').toUpperCase();
        if (estado.includes('CARGADO')) return false;
        return esCritico(item.VENCIMIENTO || item.vencimiento);
    });

    return criticosManuales.length + criticosPlanilla.length;
}

function revisarVencimientosCriticos(refs) {
    if (Notification.permission === 'denied') return;

    const total = contarCriticos();

    if (total > 0) {
        mostrarBanner(refs, {
            mensaje: `Tenés ${total} producto${total > 1 ? 's' : ''} que vencen en menos de 7 días.`,
            etiquetaBoton: 'Ver ahora',
            alHacerClic: () => {
                const destino = document.getElementById('vdb-list') ?? document.getElementById('venc-list');
                destino?.scrollIntoView({ behavior: 'smooth' });
                ocultarBanner(refs);
            },
        });
    } else {
        ocultarBanner(refs);
    }
}

export function inicializarNotificaciones() {
    const botonHabilitar  = document.getElementById('notif-enable-btn');
    const botonDeshabilitar = document.getElementById('notif-disable-btn');
    const controles       = document.getElementById('notif-controls');
    const panelActivo     = document.getElementById('notif-active');
    const textoActivo     = document.getElementById('notif-active-text');
    const puntoEstado     = document.getElementById('notif-dot');
    const textoEstado     = document.getElementById('notif-status-text');

    const refsBanner = {
        banner:      document.getElementById('notif-banner'),
        textoBanner: document.getElementById('notif-banner-text'),
        botonBanner: document.getElementById('notif-banner-btn'),
    };
    const cerrarBanner = document.getElementById('notif-banner-close');

    if (!botonHabilitar) return;

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        establecerEstado(puntoEstado, textoEstado, 'No soportado en este navegador', 'denegado');
        botonHabilitar.disabled = true;
        botonHabilitar.textContent = 'No disponible';
        return;
    }

    const configuracion = cargarConfiguracion();
    if (configuracion?.active && Notification.permission === 'granted') {
        mostrarEstadoActivo();
    } else if (Notification.permission === 'denied') {
        mostrarEstadoDenegado();
    } else {
        mostrarEstadoInactivo();
    }

    revisarVencimientosCriticos(refsBanner);
    window.addEventListener('veteo:productosActualizados', () => revisarVencimientosCriticos(refsBanner));

    botonHabilitar.addEventListener('click', async () => {
        const usuario = obtenerUsuarioActual();
        if (!usuario) {
            alert("Iniciá sesión con Google primero para activar las notificaciones.");
            return;
        }

        try {
            console.log("[Veteo] Solicitando permiso...");
            const permiso = await Notification.requestPermission();

            if (permiso === 'granted') {
                establecerEstado(puntoEstado, textoEstado, 'Conectando...', 'activo');

                const registro = await navigator.serviceWorker.ready;
                const token = await getToken(mensajeria, {
                    vapidKey: CONFIGURACION.vapidKey,
                    serviceWorkerRegistration: registro,
                });

                if (token) {
                    guardarConfiguracion({ active: true, fcmToken: token });
                    mostrarEstadoActivo();

                    fetch(CONFIGURACION.apiUrl, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'saveToken', token, email: usuario.email }),
                    })
                        .then(res => res.json())
                        .then(data => console.log("[Veteo] Token guardado:", data))
                        .catch(err => console.error("[Veteo] Error al guardar token:", err));

                    registro.showNotification('Veteo App conectada ✓', {
                        body: 'Recordatorio configurado a las 08:00 hs.',
                        icon: './icons/icon-512.png',
                        tag: 'veteo-setup',
                    });

                    onMessage(mensajeria, (payload) => {
                        registro.showNotification(
                            payload.notification?.title ?? 'Veteo App',
                            { body: payload.notification?.body ?? 'Tenés un nuevo recordatorio.', icon: './icons/icon-512.png' }
                        );
                    });

                } else {
                    establecerEstado(puntoEstado, textoEstado, 'Error: no se obtuvo token', 'denegado');
                }

            } else if (permiso === 'denied') {
                mostrarEstadoDenegado();
            }

        } catch (error) {
            console.error("[Veteo] Error en notificaciones:", error);
            alert("Detalle del error: " + error.message);
            establecerEstado(puntoEstado, textoEstado, 'Error de conexión', 'denegado');
        }
    });

    botonDeshabilitar?.addEventListener('click', () => {
        limpiarConfiguracion();
        mostrarEstadoInactivo();
    });

    cerrarBanner?.addEventListener('click', () => ocultarBanner(refsBanner));

    function mostrarEstadoActivo() {
        establecerEstado(puntoEstado, textoEstado, 'Activo', 'activo');
        if (controles) controles.hidden = true;
        if (panelActivo) panelActivo.hidden = false;
        if (textoActivo) textoActivo.textContent = 'Recordatorio activo de lunes a viernes a las 08:00 hs.';
    }

    function mostrarEstadoInactivo() {
        establecerEstado(puntoEstado, textoEstado, 'Sin configurar', 'inactivo');
        if (controles) controles.hidden = false;
        if (panelActivo) panelActivo.hidden = true;
    }

    function mostrarEstadoDenegado() {
        establecerEstado(puntoEstado, textoEstado, 'Bloqueado por el navegador', 'denegado');
        botonHabilitar.disabled = true;
        botonHabilitar.textContent = 'Permiso bloqueado';

        const total = contarCriticos();
        if (total === 0) {
            mostrarBanner(refsBanner, {
                mensaje: 'Las notificaciones están bloqueadas. Habilitá los permisos desde el navegador.',
                etiquetaBoton: 'Cómo habilitarlas',
                alHacerClic: () => window.open('https://support.google.com/chrome/answer/3220216', '_blank'),
                modificadorExtra: 'vdb-alert--warning',
            });
        }
    }
}