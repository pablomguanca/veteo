import { CONFIGURACION } from './config.js';
import { iniciarTour } from './tour.js';

const CLAVE_SESION = 'veteo_user';
let tokenAcceso = null;
let clienteToken = null;

function guardarSesion(cargaUtil) {
    const usuario = {
        nombre: cargaUtil.given_name,
        foto: cargaUtil.picture,
        email: cargaUtil.email,
        googleId: cargaUtil.sub,
    };
    localStorage.setItem(CLAVE_SESION, JSON.stringify(usuario));
    window.dispatchEvent(new CustomEvent('veteo:login', { detail: usuario }));
}

function cargarSesion() {
    try {
        const datosCrudos = localStorage.getItem(CLAVE_SESION);
        return datosCrudos ? JSON.parse(datosCrudos) : null;
    } catch { return null; }
}


function mostrarUsuario(usuario) {
    const saludo = document.getElementById('saludo-usuario');
    const foto = document.getElementById('usuario-foto');
    const informacion = document.getElementById('usuario-info');
    const loginOverlay = document.getElementById('login-overlay');
    const appContent = document.getElementById('app-content');

    if (saludo) saludo.textContent = `Hola, ${usuario.nombre}!`;
    if (foto) foto.src = usuario.foto;
    if (informacion) informacion.hidden = false;
    if (loginOverlay) loginOverlay.style.display = 'none';
    if (appContent) appContent.hidden = false;

    setTimeout(() => {
        if (typeof iniciarTour === 'function') {
            iniciarTour();
        }
    }, 2000);
}

export function obtenerTokenAcceso() {
    return new Promise((resolver, rechazar) => {
        if (tokenAcceso) {
            resolver(tokenAcceso);
            return;
        }

        if (!clienteToken) {
            rechazar(new Error('Iniciá sesión primero.'));
            return;
        }

        clienteToken.callback = (respuesta) => {
            if (respuesta.error) {
                rechazar(new Error(respuesta.error));
                return;
            }
            tokenAcceso = respuesta.access_token;
            resolver(tokenAcceso);
        };

        clienteToken.requestAccessToken({ prompt: '' });
    });
}

export function inicializarAutenticacionGoogle() {
    const sesionGuardada = cargarSesion();

    if (sesionGuardada) {
        mostrarUsuario(sesionGuardada);
    }

    const cargarSDK = () => {
        if (typeof google === 'undefined') return;

        google.accounts.id.initialize({
            client_id: CONFIGURACION.googleClientId,
            callback: manejarRespuestaCredenciales,
        });

        if (!sesionGuardada) {
            const elementoBoton = document.getElementById('btn-google-front');
            if (elementoBoton) {
                google.accounts.id.renderButton(elementoBoton, {
                    theme: 'filled_blue',
                    size: 'large',
                    shape: 'pill',
                    text: 'signin_with',
                    width: 300
                });
            }
        }

        clienteToken = google.accounts.oauth2.initTokenClient({
            client_id: CONFIGURACION.googleClientId,
            scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
            callback: () => { },
        });
    };

    if (document.readyState === 'complete') {
        cargarSDK();
    } else {
        window.addEventListener('load', cargarSDK);
    }
}

async function manejarRespuestaCredenciales(respuesta) {
    const base64Url = respuesta.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const cargaUtil = JSON.parse(jsonPayload);
    const emailUsuario = cargaUtil.email.toLowerCase();

    const msjError = document.getElementById('error-message');

    try {
        const res = await fetch(CONFIGURACION.apiUrl, {
            method: 'POST',
            body: JSON.stringify({ action: 'verificarUsuario', email: emailUsuario })
        });
        const datos = await res.json();

        if (!datos.permitido) {
            if (msjError) {
                msjError.textContent = "Acceso denegado: Tu cuenta no está autorizada para usar Veteo.";
                msjError.hidden = false;
            }
            return;
        }
    } catch (err) {
        console.error('Error verificando usuario:', err);
        if (msjError) {
            msjError.textContent = "Error de conexión al verificar acceso.";
            msjError.hidden = false;
        }
        return;
    }

    guardarSesion(cargaUtil);
    mostrarUsuario({
        nombre: cargaUtil.given_name,
        foto: cargaUtil.picture,
        email: emailUsuario,
    });

    fetch(CONFIGURACION.apiUrl, {
        method: 'POST',
        body: JSON.stringify({
            action: 'actualizarPerfil',
            email: emailUsuario,
            nombre: cargaUtil.given_name,
            foto: cargaUtil.picture,
        }),
    }).catch(() => {});

    window.location.href = 'index.html';
}

export function cerrarSesion() {
    localStorage.removeItem(CLAVE_SESION);
    tokenAcceso = null;
    location.reload();
}

export function obtenerUsuarioActual() {
    return cargarSesion();
}