import { obtenerProductosEnMemoria } from './vencimientos-db.js';
import { obtenerUsuarioActual } from './google-auth.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging.js";
import { CONFIGURACION } from './config.js';

const app = initializeApp(CONFIGURACION.firebase);
const mensajeria = getMessaging(app);
const CLAVE_ALMACENAMIENTO_NOTIFICACIONES = 'veteo_notif_config_v1';


function cargarConfiguracion() {
    try { return JSON.parse(localStorage.getItem(CLAVE_ALMACENAMIENTO_NOTIFICACIONES)) || null; } catch { return null; }
}

function guardarConfiguracion(configuracion) {
    localStorage.setItem(CLAVE_ALMACENAMIENTO_NOTIFICACIONES, JSON.stringify(configuracion));
}

function limpiarConfiguracion() {
    localStorage.removeItem(CLAVE_ALMACENAMIENTO_NOTIFICACIONES);
}

function establecerEstado(punto, texto, textoEstado, estado) {
    const estados = {
        inactivo: { clasePunto: '', etiqueta: 'Sin configurar' },
        activo: { clasePunto: 'notif-status__dot--active', etiqueta: 'Activo' },
        denegado: { clasePunto: 'notif-status__dot--denied', etiqueta: 'Bloqueado' },
    };
    const seleccion = estados[estado] || estados.inactivo;
    punto.className = `notif-status__dot ${seleccion.clasePunto}`;
    texto.textContent = textoEstado || seleccion.etiqueta;
}

function mostrarBanner(elementoBanner, elementoTexto, elementoBoton, { mensaje, etiquetaBoton, alHacerClic }) {
    elementoBanner.hidden = false;
    elementoTexto.textContent = mensaje;
    elementoBoton.textContent = etiquetaBoton;
    elementoBoton.onclick = alHacerClic;
}

function ocultarBanner(elementoBanner) {
    elementoBanner.hidden = true;
}

function parsearFechaNotificacion(cadenaFecha) {
    if (!cadenaFecha) return null;
    const cadenaLimpia = String(cadenaFecha).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(cadenaLimpia)) {
        const [dia, mes, anio] = cadenaLimpia.split('/');
        return new Date(`${anio}-${mes}-${dia}T00:00:00`);
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(cadenaLimpia)) {
        return new Date(cadenaLimpia.split('T')[0] + 'T00:00:00');
    }
    const fecha = new Date(cadenaLimpia);
    return isNaN(fecha) ? null : fecha;
}

function revisarVencimientosCriticos(banner, textoBanner, botonBanner) {
    try {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const datosManuales = JSON.parse(localStorage.getItem('veteo_vencimientos_v1')) || [];
        const criticosManuales = datosManuales.filter(item => {
            const objetivo = parsearFechaNotificacion(item.fecha);
            if (!objetivo) return false;
            const dias = Math.round((objetivo - hoy) / (1000 * 60 * 60 * 24));
            return dias >= 0 && dias <= 7;
        });

        const datosPlanilla = obtenerProductosEnMemoria();
        const criticosPlanilla = datosPlanilla.filter(item => {
            const vtoStr = item.VENCIMIENTO || item.vencimiento;
            const estado = (item.ESTADO || item.estado || '').toUpperCase();
            const objetivo = parsearFechaNotificacion(vtoStr);
            if (!objetivo || estado.includes('CARGADO')) return false;
            const dias = Math.round((objetivo - hoy) / (1000 * 60 * 60 * 24));
            return dias >= 0 && dias <= 7;
        });

        const totalCriticos = criticosManuales.length + criticosPlanilla.length;

        if (totalCriticos > 0 && banner) {
            banner.hidden = false;
            banner.className = 'vdb-alert vdb-alert--critical';
            banner.innerHTML = `
                <span class="vdb-alert__icon">⚠️</span>
                <span class="vdb-alert__text">Tenés ${totalCriticos} producto${totalCriticos > 1 ? 's' : ''} en etapa −7 días.</span>
                <button class="vdb-alert__btn">Ver ahora</button>
            `;

            const btn = banner.querySelector('.vdb-alert__btn');
            btn.onclick = () => {
                const destino = document.getElementById('vdb-list') || document.getElementById('venc-list');
                destino?.scrollIntoView({ behavior: 'smooth' });
                banner.hidden = true;
            };
        } else if (banner) {
            banner.hidden = true;
        }
    } catch (e) {
        console.error(e);
    }
}

export function inicializarNotificaciones() {
    const botonHabilitar = document.getElementById('notif-enable-btn');
    const botonDeshabilitar = document.getElementById('notif-disable-btn');
    const controles = document.getElementById('notif-controls');
    const panelActivo = document.getElementById('notif-active');
    const textoActivo = document.getElementById('notif-active-text');
    const puntoEstado = document.getElementById('notif-dot');
    const textoEstado = document.getElementById('notif-status-text');
    const banner = document.getElementById('notif-banner');
    const textoBanner = document.getElementById('notif-banner-text');
    const botonBanner = document.getElementById('notif-banner-btn');
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

    revisarVencimientosCriticos(banner, textoBanner, botonBanner);

    window.addEventListener('veteo:productosActualizados', () => {
        revisarVencimientosCriticos(banner, textoBanner, botonBanner);
    });

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
                console.log("[Veteo] Service Worker listo:", registro);

                const token = await getToken(mensajeria, {
                    vapidKey: CONFIGURACION.vapidKey,
                    serviceWorkerRegistration: registro
                });

                if (token) {
                    console.log("[Veteo] Token obtenido:", token);
                    guardarConfiguracion({ active: true, fcmToken: token });
                    mostrarEstadoActivo();

                    fetch(CONFIGURACION.apiUrl, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'saveToken', token: token, email: usuario.email })
                    }).then(res => res.json())
                        .then(data => console.log("[Veteo] Token guardado en Sheet:", data))
                        .catch(error => console.error("Error al guardar token:", error));

                    registro.showNotification('Veteo App conectada ✓', {
                        body: `Recordatorio configurado a las 08:00 hs.`,
                        icon: './icons/icon-512.png',
                        tag: 'veteo-setup',
                    });

                    onMessage(mensajeria, (cargaUtil) => {
                        console.log("[Veteo] Mensaje recibido en primer plano:", cargaUtil);
                        const titulo = cargaUtil.notification?.title || 'Veteo App';
                        const opciones = {
                            body: cargaUtil.notification?.body || 'Tienes un nuevo recordatorio.',
                            icon: './icons/icon-512.png'
                        };
                        registro.showNotification(titulo, opciones);
                    });

                } else {
                    establecerEstado(puntoEstado, textoEstado, 'Error: No se obtuvo token', 'denegado');
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

    cerrarBanner?.addEventListener('click', () => ocultarBanner(banner));

    function mostrarEstadoActivo() {
        establecerEstado(puntoEstado, textoEstado, 'Activo', 'activo');
        controles.hidden = true;
        panelActivo.hidden = false;
        textoActivo.textContent = `Recordatorio activo de lunes a viernes a las 08:00 hs.`;
    }

    function mostrarEstadoInactivo() {
        establecerEstado(puntoEstado, textoEstado, 'Sin configurar', 'inactivo');
        controles.hidden = false;
        panelActivo.hidden = true;
    }

    function mostrarEstadoDenegado() {
        establecerEstado(puntoEstado, textoEstado, 'Bloqueado por el navegador', 'denegado');
        botonHabilitar.disabled = true;
        botonHabilitar.textContent = 'Permiso bloqueado';
        mostrarBanner(banner, textoBanner, botonBanner, {
            mensaje: 'Las notificaciones están bloqueadas. Habilitá los permisos desde la configuración del navegador.',
            etiquetaBoton: 'Cómo habilitarlas',
            alHacerClic: () => window.open('https://support.google.com/chrome/answer/3220216', '_blank'),
        });
    }
}