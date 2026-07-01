import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { inicializarFirebase, getAuthInstance, getFirestoreInstance } from '../firebase/firebase.js';
import { iniciarTour } from './tour.js';
import { formatearEmailTienda } from './config.js';

const CLAVE_OPERADOR = 'veteo_operador_v1';

export function obtenerOperador() {
    try { return JSON.parse(localStorage.getItem(CLAVE_OPERADOR)) || null; }
    catch { return null; }
}

export function guardarOperador(operador) {
    localStorage.setItem(CLAVE_OPERADOR, JSON.stringify(operador));
}

export function obtenerUsuarioActual() {
    return getAuthInstance()?.currentUser || null;
}

export function obtenerTiendaId() {
    const user = getAuthInstance()?.currentUser;
    if (!user) return null;
    const match = user.email.match(/^tienda(\w+)@/);
    return match ? match[1] : null;
}

export async function iniciarSesionTienda(idTienda, password) {
    const { auth } = await inicializarFirebase();
    const email = formatearEmailTienda(idTienda);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
}

export async function cerrarSesion() {
    await signOut(getAuthInstance());
    location.reload();
}

async function obtenerPerfilTienda(tiendaId) {
    const db = getFirestoreInstance();
    const ref = doc(db, 'tiendas', tiendaId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
}

async function crearTiendaSiNoExiste(tiendaId) {
    const db = getFirestoreInstance();
    const ref = doc(db, 'tiendas', tiendaId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, {
            nombre: `Tienda ${tiendaId}`,
            operadores: [],
            creadaEl: serverTimestamp(),
        });
    }
}

function mostrarApp(tiendaId, nombreTienda) {
    document.getElementById('login-overlay')?.style.setProperty('display', 'none');
    const appContent = document.getElementById('app-content');
    if (appContent) appContent.hidden = false;
    document.getElementById('usuario-info')?.removeAttribute('hidden');
    document.getElementById('sidebar-open')?.removeAttribute('hidden');
    const saludo = document.getElementById('saludo-usuario');
    if (saludo) saludo.textContent = `Hola, ${nombreTienda}!`;
}

function mostrarLogin() {
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.removeAttribute('hidden');
    const appContent = document.getElementById('app-content');
    if (appContent) appContent.hidden = true;
    document.getElementById('sidebar-open')?.setAttribute('hidden', '');
}

export function mostrarSelectorOperador(tiendaId, onConfirmar) {
    const db = getFirestoreInstance();
    const operadorActual = obtenerOperador();

    const overlay = document.createElement('div');
    overlay.id = 'operador-overlay';
    overlay.className = 'operador-overlay';

    overlay.innerHTML = `
        <div class="operador-modal">
            <h3 class="operador-modal__title">¿Quién está cargando?</h3>
            <p class="operador-modal__subtitle">
                Tienda ${tiendaId} · Esta preferencia se guarda en este dispositivo
            </p>
            <div class="operador-modal__lista" id="operador-lista"></div>
            <div class="operador-modal__add">
                <input
                    class="operador-modal__input"
                    id="operador-nuevo-input"
                    type="text"
                    placeholder="Agregar nombre..."
                    maxlength="40"
                />
                <button class="operador-modal__btn-add" id="operador-nuevo-btn">+</button>
            </div>
            <p class="operador-modal__hint">
                El nombre elegido se registra en cada carga que hagas.
            </p>
            <button class="operador-modal__btn-cancelar" id="operador-cancelar">
                ${operadorActual ? 'Cancelar' : 'Continuar sin nombre'}
            </button>
        </div>
    `;

    document.body.appendChild(overlay);

    const lista = overlay.querySelector('#operador-lista');

    async function cargarLista() {
        const snap = await getDoc(doc(db, 'tiendas', tiendaId));
        const operadores = snap.data()?.operadores || [];
        lista.innerHTML = '';

        if (!operadores.length) {
            lista.innerHTML = `<p class="operador-modal__vacio">Todavía no hay operadores. Agregá el primero.</p>`;
            return;
        }

        operadores.forEach(nombre => {
            const btn = document.createElement('button');
            btn.textContent = nombre;
            btn.className = `operador-item${operadorActual?.nombre === nombre ? ' operador-item--activo' : ''}`;
            btn.onclick = () => seleccionar(nombre);
            lista.appendChild(btn);
        });
    }

    async function agregar() {
        const input = overlay.querySelector('#operador-nuevo-input');
        const nombre = input.value.trim();
        if (!nombre) return;

        const ref = doc(db, 'tiendas', tiendaId);
        const snap = await getDoc(ref);
        const operadores = snap.data()?.operadores || [];

        if (!operadores.includes(nombre)) {
            await setDoc(ref, { operadores: [...operadores, nombre] }, { merge: true });
        }

        input.value = '';
        await cargarLista();
        seleccionar(nombre);
    }

    function seleccionar(nombre) {
        const operador = { nombre, tiendaId };
        guardarOperador(operador);
        document.body.removeChild(overlay);
        window.dispatchEvent(new CustomEvent('veteo:operadorSeleccionado', { detail: operador }));
        if (onConfirmar) onConfirmar(operador);
    }

    overlay.querySelector('#operador-nuevo-btn').onclick = agregar;
    overlay.querySelector('#operador-nuevo-input').onkeydown = e => {
        if (e.key === 'Enter') agregar();
    };
    overlay.querySelector('#operador-cancelar').onclick = () => {
        document.body.removeChild(overlay);
        if (onConfirmar) onConfirmar(operadorActual);
    };

    cargarLista();
}

function inicializarFormLogin() {
    const inputId = document.getElementById('login-tienda-id');
    const inputPw = document.getElementById('login-password');
    const btnLogin = document.getElementById('btn-login-tienda');
    const msgError = document.getElementById('error-message');

    if (!btnLogin) return;

    const intentarLogin = async () => {
        const id = inputId?.value.trim();
        const pw = inputPw?.value.trim();

        if (!id || !pw) {
            if (msgError) { msgError.textContent = 'Completá el número de tienda y la contraseña.'; msgError.hidden = false; }
            return;
        }

        btnLogin.disabled = true;
        btnLogin.textContent = 'Ingresando...';

        try {
            await iniciarSesionTienda(id, pw);
        } catch (err) {
            if (msgError) {
                msgError.textContent = err.code === 'auth/invalid-credential'
                    ? 'Tienda o contraseña incorrecta.'
                    : 'Error de conexión. Intentá de nuevo.';
                msgError.hidden = false;
            }
            btnLogin.disabled = false;
            btnLogin.textContent = 'Ingresar';
        }
    };

    btnLogin.addEventListener('click', intentarLogin);
    inputPw?.addEventListener('keydown', e => { if (e.key === 'Enter') intentarLogin(); });
}

export async function inicializarAutenticacion() {
    const { auth } = await inicializarFirebase();
    const loginOverlay = document.getElementById('login-overlay');
    const loginCard = document.querySelector('.login-card');
    if (loginCard) loginCard.style.visibility = 'hidden';

    inicializarFormLogin();

    onAuthStateChanged(auth, async user => {
        if (loginCard) loginCard.style.visibility = '';

        if (!user) {
            mostrarLogin();
            return;
        }

        const tiendaId = user.email.match(/^tienda(\w+)@/)?.[1];
        if (!tiendaId) { await cerrarSesion(); return; }

        await crearTiendaSiNoExiste(tiendaId);
        const perfil = await obtenerPerfilTienda(tiendaId);
        const nombreTienda = perfil?.nombre || `Tienda ${tiendaId}`;

        mostrarApp(tiendaId, nombreTienda);
        window.dispatchEvent(new CustomEvent('veteo:login', { detail: { tiendaId, nombreTienda } }));

        const operadorGuardado = obtenerOperador();
        if (!operadorGuardado || operadorGuardado.tiendaId !== tiendaId) {
            mostrarSelectorOperador(tiendaId, () => {
                setTimeout(() => iniciarTour(), 500);
            });
        }
    });
}

export { inicializarAutenticacion as inicializarAutenticacionGoogle };