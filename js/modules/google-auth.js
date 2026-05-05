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

function manejarRespuestaCredenciales(respuesta) {
    const base64Url = respuesta.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const cargaUtil = JSON.parse(jsonPayload);
    const emailUsuario = cargaUtil.email.toLowerCase();
    const usuariosPermitidos = [
        'pablo.m.guanca@gmail.com',
        'pablo_guanca@carrefour.com',
        'pablo_ciancio@carrefour.com',
        'fernando_porro_falco@carrefour.com',
        'sergio_gustavo_alfonsin@carrefour.com',
        'cecilia_serrano@carrefour.com',
        'cristian_rivas@carrefour.com',
        'luis_gonzales@carrefour.com',
        'adrian_falcon@carrefour.com',
        'daisis_pereira@carrefour.com',
        'anabel_Gonzalez@carrefour.com',
        'juan_riquelme@carrefour.com',
        'pamela_montalvo@carrefour.com',
        'valeria_lima@carrefour.com',
        'ariel_hernan_latorre@carrefour.com',
        'nadin_cespedes@carrefour.com',
        'claudia_rochelle@carrefour.com',
        'lorena_estefania_lucero@carrefour.com',
        'yanina_malagueno@carrefour.com',
        'ezequiel_mendez@carrefour.com',
        'lorena_leguiza@carrefour.com',
        'augusto_leon@carrefour.com',
        'guillermo_Reynoso@carrefour.com',
        'celeste_soledad_palavecino@carrefour.com',
        'pedro_ramirez@carrefour.com',
        'carolina_camargo@carrefour.com',
        'natalia_medina@carrefour.com',
        'pablo_chaperon@carrefour.com',
        'navarro_malave_juan_arturo@carrefour.com',
        'romina_fornes@carrefour.com',
        'damian_correa@carrefour.com',
        'julieta_caputto@carrefour.com',
    ];

    if (!usuariosPermitidos.includes(emailUsuario)) {
        const msjError = document.getElementById('error-message');
        if (msjError) {
            msjError.textContent = "Acceso denegado: Tu cuenta no está autorizada para usar Veteo.";
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
    }).catch(() => { });

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