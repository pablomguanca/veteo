import { obtenerProductosEnMemoria } from './vencimientos-db.js';
import { obtenerEscaneadosParaNotificaciones } from './vencimientos.js';
import { obtenerTiendaId } from './auth.js';
import { getFirestoreInstance } from '../firebase/firebase.js';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { obtenerConfiguracion } from './config.js';

let mensajeria = null;

async function obtenerMensajeria() {
    if (mensajeria) return mensajeria;
    const config = await obtenerConfiguracion();
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging: gM } = await import('firebase/messaging');
    const app = getApps()[0];
    mensajeria = gM(app);
    return mensajeria;
}

const CLAVE_NOTIF = 'veteo_notif_config_v1';

function cargarConfigNotif() {
    try { return JSON.parse(localStorage.getItem(CLAVE_NOTIF)) || null; }
    catch { return null; }
}

function guardarConfigNotif(config) {
    localStorage.setItem(CLAVE_NOTIF, JSON.stringify(config));
}

function limpiarConfigNotif() {
    localStorage.removeItem(CLAVE_NOTIF);
}

function establecerEstado(punto, texto, textoEstado, estado) {
    const estados = {
        inactivo: { clasePunto: '', etiqueta: 'Sin configurar' },
        activo: { clasePunto: 'notif-status__dot--active', etiqueta: 'Activo' },
        denegado: { clasePunto: 'notif-status__dot--denied', etiqueta: 'Bloqueado' },
    };
    const sel = estados[estado] ?? estados.inactivo;
    punto.className = `notif-status__dot ${sel.clasePunto}`;
    texto.textContent = textoEstado || sel.etiqueta;
}

function parsearFecha(cadena) {
    if (!cadena) return null;
    const s = String(cadena).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [d, m, a] = s.split('/');
        return new Date(`${a}-${m}-${d}T00:00:00`);
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.slice(0, 10) + 'T00:00:00');
    const f = new Date(s);
    return isNaN(f) ? null : f;
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

async function contarCriticos() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const esCritico = (fecha) => {
        const objetivo = parsearFecha(fecha);
        if (!objetivo || isNaN(objetivo)) return false;
        const dias = Math.round((objetivo - hoy) / 864e5);
        return dias >= 0 && dias <= 7;
    };

    const escaneados = await obtenerEscaneadosParaNotificaciones();
    const criticosEsc = escaneados.filter(item => {
        const estado = (item.estado || '').toUpperCase();
        if (estado.includes('CARGADO')) return false;
        return esCritico(item.fechaVencimiento || item.fecha);
    });

    const importados = obtenerProductosEnMemoria();
    const criticosImp = importados.filter(item => {
        const estado = (item.estado || item.ESTADO || '').toUpperCase();
        if (estado.includes('CARGADO')) return false;
        return esCritico(item.vencimiento || item.VENCIMIENTO);
    });

    return criticosEsc.length + criticosImp.length;
}

async function revisarVencimientosCriticos(refs) {
    if (Notification.permission === 'denied') return;

    const total = await contarCriticos();

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

async function guardarTokenFirestore(token) {
    const tiendaId = obtenerTiendaId();
    if (!tiendaId) return;

    const db = getFirestoreInstance();
    const ref = doc(db, 'tiendas', tiendaId);
    await setDoc(ref, { fcmToken: token }, { merge: true });
}

export async function inicializarNotificaciones() {
    const botonHabilitar = document.getElementById('notif-enable-btn');
    const botonDeshabilitar = document.getElementById('notif-disable-btn');
    const controles = document.getElementById('notif-controls');
    const panelActivo = document.getElementById('notif-active');
    const textoActivo = document.getElementById('notif-active-text');
    const puntoEstado = document.getElementById('notif-dot');
    const textoEstado = document.getElementById('notif-status-text');

    const refsBanner = {
        banner: document.getElementById('notif-banner'),
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

    const configNotif = cargarConfigNotif();

    if (configNotif?.active && Notification.permission === 'granted') {
        mostrarEstadoActivo();
    } else if (Notification.permission === 'denied') {
        mostrarEstadoDenegado();
    } else {
        mostrarEstadoInactivo();
    }

    await revisarVencimientosCriticos(refsBanner);

    window.addEventListener('veteo:productosActualizados', async () => {
        await revisarVencimientosCriticos(refsBanner);
    });

    botonHabilitar.addEventListener('click', async () => {
        const tiendaId = obtenerTiendaId();
        if (!tiendaId) {
            alert('Iniciá sesión primero para activar las notificaciones.');
            return;
        }

        try {
            const permiso = await Notification.requestPermission();

            if (permiso === 'granted') {
                establecerEstado(puntoEstado, textoEstado, 'Conectando...', 'activo');

                const config = await obtenerConfiguracion();
                const msj = await obtenerMensajeria();
                const registro = await navigator.serviceWorker.ready;
                const token = await getToken(msj, {
                    vapidKey: config.vapidKey,
                    serviceWorkerRegistration: registro,
                });

                if (token) {
                    guardarConfigNotif({ active: true, fcmToken: token });
                    await guardarTokenFirestore(token);
                    mostrarEstadoActivo();

                    registro.showNotification('Veteo App conectada ✓', {
                        body: 'Recordatorio configurado a las 08:00 hs.',
                        icon: './icons/icon-512.png',
                        tag: 'veteo-setup',
                    });

                    onMessage(msj, payload => {
                        registro.showNotification(
                            payload.notification?.title ?? 'Veteo App',
                            {
                                body: payload.notification?.body ?? 'Tenés un nuevo recordatorio.',
                                icon: './icons/icon-512.png',
                            }
                        );
                    });
                } else {
                    establecerEstado(puntoEstado, textoEstado, 'Error: no se obtuvo token', 'denegado');
                }

            } else if (permiso === 'denied') {
                mostrarEstadoDenegado();
            }

        } catch (error) {
            console.error('[Notificaciones]:', error);
            establecerEstado(puntoEstado, textoEstado, 'Error de conexión', 'denegado');
        }
    });

    botonDeshabilitar?.addEventListener('click', () => {
        limpiarConfigNotif();
        mostrarEstadoInactivo();
    });

    cerrarBanner?.addEventListener('click', () => ocultarBanner(refsBanner));

    function mostrarEstadoActivo() {
        establecerEstado(puntoEstado, textoEstado, 'Activo', 'activo');
        if (controles) controles.hidden = true;
        if (panelActivo) panelActivo.hidden = false;
        if (textoActivo) textoActivo.textContent = 'Recibirás recordatorios diarios a las 08:00 hs.';
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

        mostrarBanner(refsBanner, {
            mensaje: 'Las notificaciones están bloqueadas. Habilitá los permisos desde el navegador.',
            etiquetaBoton: 'Cómo habilitarlas',
            alHacerClic: () => window.open('https://support.google.com/chrome/answer/3220216', '_blank'),
            modificadorExtra: 'vdb-alert--warning',
        });
    }
}