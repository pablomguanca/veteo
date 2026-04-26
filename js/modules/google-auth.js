import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { CONFIGURACION } from './config.js';

const app = getApps().length === 0 ? initializeApp(CONFIGURACION.firebase) : getApp();
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

const correosAutorizados = [
    'pablo_guanca@carrefour.com',
    'pablo_ciancio@carrefour.com',
    'fernando_porro_falco@carrefour.com',
    'sergio_gustavo_alfonsin@carrefour.com',
    'cecilia_serrano@carrefour.com',
    'cristian_rivas@carrefour.com',
    'luis_gonzales@carrefour.com',
    'adrian_falcon@carrefour.com',
    'daisis_pereira@carrefour.com',
    'anabel_gonzalez@carrefour.com',
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
    'jesus_rios@carrefour.com',
    'pablo_chaperon@carrefour.com'
];

export async function iniciarSesionGoogle() {
    const msjError = document.getElementById('error-message');
    if (msjError) msjError.hidden = true;

    try {
        const resultado = await signInWithPopup(auth, provider);
        const usuario = resultado.user;

        if (!correosAutorizados.includes(usuario.email)) {
            await signOut(auth);
            if (msjError) {
                msjError.textContent = "Acceso denegado. Cuenta no autorizada para esta sucursal.";
                msjError.hidden = false;
            }
            return;
        }

        const credencial = GoogleAuthProvider.credentialFromResult(resultado);
        const tokenAcceso = credencial.accessToken;

        window.location.href = "index.html";

    } catch (error) {
        console.error("Error en login:", error);
        if (msjError) {
            msjError.textContent = "Error al conectar con Google.";
            msjError.hidden = false;
        }
    }
}

onAuthStateChanged(auth, (usuario) => {
    const esPaginaLogin = window.location.pathname.includes('login.html');
    const body = document.body;

    if (esPaginaLogin) {
        window.location.replace("index.html");
        return;
    }

    body.classList.remove('protegido');

    const saludo = document.getElementById('saludo-usuario');
    const foto = document.getElementById('usuario-foto');
    const infoDiv = document.getElementById('usuario-info');
    const btnGoogleFront = document.getElementById('btn-google-front');

    if (usuario && correosAutorizados.includes(usuario.email)) {
        if (infoDiv) infoDiv.hidden = false;
        if (btnGoogleFront) btnGoogleFront.hidden = true;
        if (saludo) saludo.textContent = `Hola, ${usuario.displayName || 'Equipo'}!`;
        if (foto && usuario.photoURL) foto.src = usuario.photoURL;
    } else {
        if (infoDiv) infoDiv.hidden = true;
        if (btnGoogleFront) btnGoogleFront.hidden = false;
    }

    // if (usuario && correosAutorizados.includes(usuario.email)) {
    //     if (esPaginaLogin) {
    //         window.location.replace("index.html");
    //     } else {
    //         body.classList.remove('protegido');

    //         const saludo = document.getElementById('saludo-usuario');
    //         const foto = document.getElementById('usuario-foto');
    //         const infoDiv = document.getElementById('usuario-info');

    //         if (infoDiv) infoDiv.hidden = false;
    //         if (saludo) saludo.textContent = `Hola, ${usuario.displayName || 'Equipo'}!`;
    //         if (foto && usuario.photoURL) foto.src = usuario.photoURL;
    //     }
    // } else {
    //     if (!esPaginaLogin) {
    //         window.location.replace("login.html");
    //     } else {
    //         body.classList.remove('protegido');
    //     }
    // }
});

export function obtenerUsuarioActual() {
    return auth.currentUser;
}

export async function cerrarSesion() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error al cerrar sesión", error);
    }
}