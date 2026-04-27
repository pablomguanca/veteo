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
    } catch { return null; }
}


function mostrarUsuario(usuario) {
    const saludo = document.getElementById('saludo-usuario');
    const foto = document.getElementById('usuario-foto');
    const informacion = document.getElementById('usuario-info');
    const botonContainer = document.getElementById('btn-google-front');

    if (saludo) saludo.textContent = `Hola, ${usuario.nombre}!`;
    if (foto) foto.src = usuario.foto;
    if (informacion) informacion.hidden = false;
    if (botonContainer) botonContainer.style.display = 'none';
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
                    theme: 'filled_black',
                    size: 'large',
                    shape: 'pill',
                });
            }
        }

        clienteToken = google.accounts.oauth2.initTokenClient({
            client_id: CONFIGURACION.googleClientId,
            scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
            callback: () => {},
        });
    };

    if (document.readyState === 'complete') {
        cargarSDK();
    } else {
        window.addEventListener('load', cargarSDK);
    }
}

function manejarRespuestaCredenciales(respuesta) {
    const cargaUtil = JSON.parse(atob(respuesta.credential.split('.')[1]));
    guardarSesion(cargaUtil);
    mostrarUsuario({
        nombre: cargaUtil.given_name,
        foto: cargaUtil.picture,
        email: cargaUtil.email,
    });
    location.reload();
}

export function cerrarSesion() {
    localStorage.removeItem(CLAVE_SESION);
    tokenAcceso = null;
    location.reload();
}