import { CONFIGURACION } from './config.js';

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
    } catch {
        return null;
    }
}

function mostrarUsuario(usuario) {
    const saludo = document.getElementById('saludo-usuario');
    const foto = document.getElementById('usuario-foto');
    const informacion = document.getElementById('usuario-info');
    const boton = document.getElementById('google-btn');

    if (saludo) saludo.textContent = `Hola, ${usuario.nombre}!`;
    if (foto) foto.src = usuario.foto;
    if (informacion) informacion.style.display = 'flex';
    if (boton) boton.style.display = 'none';
}

export function obtenerUsuarioActual() {
    try {
        const datosCrudos = localStorage.getItem(CLAVE_SESION);
        return datosCrudos ? JSON.parse(datosCrudos) : null;
    } catch {
        return null;
    }
}

export function obtenerTokenAcceso() {
    return new Promise((resolver, rechazar) => {
        if (tokenAcceso) {
            resolver(tokenAcceso);
            return;
        }

        if (!clienteToken) {
            rechazar(new Error('Cliente de token no inicializado. El usuario debe iniciar sesión primero.'));
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

export function limpiarTokenAcceso() {
    tokenAcceso = null;
}

export function inicializarAutenticacionGoogle() {
    const sesionGuardada = cargarSesion();

    if (sesionGuardada) {
        mostrarUsuario(sesionGuardada);
        if (document.readyState === 'complete') {
            inicializarSDK(sesionGuardada.email);
        } else {
            window.addEventListener('load', () => inicializarSDK(sesionGuardada.email));
        }
        window.dispatchEvent(new CustomEvent('veteo:login', { detail: sesionGuardada }));
        return;
    }

    if (document.readyState === 'complete') {
        inicializarSDK(null);
    } else {
        window.addEventListener('load', () => inicializarSDK(null));
    }
}

function inicializarSDK(sugerenciaEmail) {
    if (typeof google === 'undefined') return;

    google.accounts.id.initialize({
        client_id: CONFIGURACION.googleClientId,
        callback: window.manejarRespuestaCredenciales,
    });

    const elementoBoton = document.getElementById('google-btn');
    if (elementoBoton && elementoBoton.style.display !== 'none') {
        google.accounts.id.renderButton(elementoBoton, {
            theme: 'filled_black',
            size: 'medium',
            shape: 'pill',
            locale: 'es',
        });
    }

    clienteToken = google.accounts.oauth2.initTokenClient({
        client_id: CONFIGURACION.googleClientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',
        hint: sugerenciaEmail || '',
        callback: () => { },
    });
}

window.manejarRespuestaCredenciales = function (respuesta) {
    const cargaUtil = JSON.parse(atob(respuesta.credential.split('.')[1]));

    guardarSesion(cargaUtil);
    mostrarUsuario({
        nombre: cargaUtil.given_name,
        foto: cargaUtil.picture,
        email: cargaUtil.email,
        googleId: cargaUtil.sub,
    });

    if (clienteToken) {
        clienteToken = google.accounts.oauth2.initTokenClient({
            client_id: CONFIGURACION.googleClientId,
            scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',
            hint: cargaUtil.email,
            callback: () => { },
        });
    }
};

export function cerrarSesion() {
    localStorage.removeItem(CLAVE_SESION);
    tokenAcceso = null;
    window.dispatchEvent(new CustomEvent('veteo:logout'));
    location.reload();
}