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
    setTimeout(() => { if (typeof iniciarTour === 'function') iniciarTour(); }, 2000);
}

function mostrarLogin() {
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.display = '';
    const appContent = document.getElementById('app-content');
    if (appContent) appContent.hidden = true;
    document.getElementById('sidebar-open')?.setAttribute('hidden', '');
}

export function mostrarSelectorOperador(tiendaId, onConfirmar) {
    const db = getFirestoreInstance();
    const operadorActual = obtenerOperador();

    const overlay = document.createElement('div');
    overlay.id = 'operador-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,.7);
        display:flex;align-items:center;justify-content:center;z-index:9999;
    `;

    overlay.innerHTML = `
        <div style="background:var(--bg-card,#1a1a2e);border-radius:12px;padding:28px 24px;
                    width:min(360px,90vw);box-shadow:0 8px 32px rgba(0,0,0,.4)">
            <h3 style="margin:0 0 6px;font-size:16px;color:var(--text,#fff)">¿Quién está cargando?</h3>
            <p style="margin:0 0 20px;font-size:13px;color:var(--muted,#888)">
                Tienda ${tiendaId} · Esta preferencia se guarda en este dispositivo
            </p>
            <div id="operador-lista"
                style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;
                        max-height:200px;overflow-y:auto"></div>
            <div style="display:flex;gap:8px;margin-bottom:8px">
                <input id="operador-nuevo-input" type="text" placeholder="Agregar nombre..."
                    maxlength="40"
                    style="flex:1;padding:10px 12px;border-radius:8px;border:1px solid #333;
                            background:#0d0d1a;color:#fff;font-size:14px"/>
                <button id="operador-nuevo-btn"
                        style="padding:10px 14px;border-radius:8px;background:var(--green,#00c46a);
                            border:none;color:#000;font-weight:700;cursor:pointer;font-size:13px">+</button>
            </div>
            <p style="font-size:11px;color:var(--muted,#888);margin:0 0 16px">
                El nombre elegido se registra en cada carga que hagas.
            </p>
            <button id="operador-cancelar"
                    style="width:100%;padding:10px;border-radius:8px;border:1px solid #333;background:transparent;color:var(--muted,#888);cursor:pointer;font-size:13px">
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
            lista.innerHTML = `<p style="font-size:13px;color:var(--muted,#888);text-align:center">
                Todavía no hay operadores. Agregá el primero.</p>`;
            return;
        }

        operadores.forEach(nombre => {
            const btn = document.createElement('button');
            btn.textContent = nombre;
            const esActual = operadorActual?.nombre === nombre;
            btn.style.cssText = `
                padding:10px 14px;border-radius:8px;
                border:1px solid ${esActual ? 'var(--green,#00c46a)' : '#333'};
                background:${esActual ? 'var(--green,#00c46a)' : '#1a1a2e'};
                color:${esActual ? '#000' : '#fff'};
                cursor:pointer;font-size:14px;text-align:left;font-weight:500;
            `;
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

    inicializarFormLogin();

    onAuthStateChanged(auth, async user => {
        if (!user) { mostrarLogin(); return; }

        const tiendaId = user.email.match(/^tienda(\w+)@/)?.[1];
        if (!tiendaId) { await cerrarSesion(); return; }

        await crearTiendaSiNoExiste(tiendaId);
        const perfil = await obtenerPerfilTienda(tiendaId);
        const nombreTienda = perfil?.nombre || `Tienda ${tiendaId}`;

        mostrarApp(tiendaId, nombreTienda);
        window.dispatchEvent(new CustomEvent('veteo:login', { detail: { tiendaId, nombreTienda } }));

        const operadorGuardado = obtenerOperador();
        if (!operadorGuardado || operadorGuardado.tiendaId !== tiendaId) {
            mostrarSelectorOperador(tiendaId, null);
        }
    });
}

export { inicializarAutenticacion as inicializarAutenticacionGoogle };