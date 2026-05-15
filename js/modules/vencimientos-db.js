import { alternarEstadoVacio } from '../utils/ui.js';
import { obtenerUsuarioActual } from './google-auth.js';
import { CONFIGURACION } from './config.js';
import { ENLACES_APP } from './enlaces.js';

let productosEnMemoria = [];

export function obtenerProductosEnMemoria() {
    return productosEnMemoria;
}

function parsearTxt(contenido) {
    const filas = [];
    for (const linea of contenido.split('\n')) {
        const limpia = linea.trim();
        if (!/^\*\s+\d+/.test(limpia)) continue;
        const interior = limpia.replace(/^\*\s*/, '').replace(/\s*\*$/, '').trim();
        const partes = interior.split(/\s+/);
        if (partes.length < 7) continue;
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(partes[partes.length - 1])) continue;

        filas.push({
            po: partes[0],
            sec: partes[1],
            ean: partes[2],
            vencimiento: partes[partes.length - 1],
            cantidad: partes[partes.length - 2],
            stock: partes[partes.length - 3],
            descripcion: partes.slice(3, partes.length - 3).join(' '),
        });
    }
    return filas;
}

function parsearFecha(cadenaFecha) {
    if (!cadenaFecha) return null;
    const limpia = String(cadenaFecha).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(limpia)) {
        const [dia, mes, anio] = limpia.split('/');
        return new Date(`${anio}-${mes}-${dia}T00:00:00`);
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(limpia)) {
        return new Date(limpia.split('T')[0] + 'T00:00:00');
    }
    const fecha = new Date(limpia);
    return isNaN(fecha) ? null : fecha;
}

function obtenerDiasRestantes(cadenaFecha) {
    const objetivo = parsearFecha(cadenaFecha);
    if (!objetivo) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((objetivo - hoy) / (1000 * 60 * 60 * 24));
}

function obtenerEtapa(diasRestantes) {
    if (diasRestantes === null) return { etiqueta: '?', claseCSS: 'venc-badge--unknown' };
    const etiqueta = diasRestantes < 0 ? `+${Math.abs(diasRestantes)}d` : `-${diasRestantes}d`;
    if (diasRestantes <= 7) return { etiqueta, claseCSS: 'venc-badge--7' };
    if (diasRestantes <= 30) return { etiqueta, claseCSS: 'venc-badge--30' };
    if (diasRestantes <= 60) return { etiqueta, claseCSS: 'venc-badge--60' };
    return { etiqueta, claseCSS: 'venc-badge--90' };
}

function formatearFecha(cadenaFecha) {
    const fecha = parsearFecha(cadenaFecha);
    if (!fecha) return cadenaFecha;
    return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function apiObtenerTodo(usuario) {
    const parametros = new URLSearchParams({ action: 'getAll', email: usuario.email });
    const respuesta = await fetch(`${CONFIGURACION.apiUrl}?${parametros.toString()}`, {
        method: 'GET',
        redirect: 'follow'
    });
    return respuesta.json();
}

async function apiConfigurarHoja(usuario) {
    const respuesta = await fetch(CONFIGURACION.apiUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'setupSheet', email: usuario.email }),
    });
    return respuesta.json();
}

async function apiImportarTxt(filas, usuario) {
    const respuesta = await fetch(CONFIGURACION.apiUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'importTxt', rows: filas, email: usuario.email }),
    });
    return respuesta.json();
}

async function apiActualizarEstado(ean, vencimiento, estado, usuario) {
    const respuesta = await fetch(CONFIGURACION.apiUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'updateEstado', ean, vencimiento, estado, email: usuario.email }),
    });
    return respuesta.json();
}

function escaparHTML(cadena) {
    return String(cadena ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export async function ejecutarCargaCompleta(item, tipo) {
    const sec = parseInt(item.sec || item.SEC);
    const ean = item.ean || item.EAN;
    const vto = item.vencimiento || item.VENCIMIENTO;
    const desc = item.descripcion || item.DESCRIPCION || "";
    const descMinuscula = desc.toLowerCase();
    const dias = obtenerDiasRestantes(vto);

    const FORMS = {
        PAS: { url: ENLACES_APP.formPas, id: "entry.1279354663" },
        PFT: { url: ENLACES_APP.formPft },
        UM: { url: ENLACES_APP.ultimaMilla, id: "entry.140972296" },
        S10: { url: ENLACES_APP.accEspeciales, id: "entry.1275730876" },
        PCH: { url: ENLACES_APP.pch }
    };

    let urlAbrir = "";
    let nuevoEstado = "CARGADO";

    if (tipo === 'UM') {
        urlAbrir = `${FORMS.UM.url}?usp=pp_url&${FORMS.UM.id}=${ean}`;
        nuevoEstado = "CARGADO UM";
    } else {
        if (sec === 20 && dias >= 3 && dias <= 7) {
            urlAbrir = FORMS.PCH.url;
        }
        else if ([20, 21, 22, 23, 24, 26].includes(sec)) {
            urlAbrir = FORMS.PFT.url;
        } else if (descMinuscula.includes("carrefour") || descMinuscula.includes("bulnez") || [10, 34].includes(sec)) {
            urlAbrir = `${FORMS.S10.url}?usp=pp_url&${FORMS.S10.id}=${ean}`;
        } else if (sec === 15) {
            urlAbrir = `${FORMS.PAS.url}?usp=pp_url&${FORMS.PAS.id}=${ean}`;
        } else if ([11, 14].includes(sec)) {
            urlAbrir = FORMS.PCH.url;
        }
    }

    if (urlAbrir) window.open(urlAbrir, '_blank');

    const usuario = obtenerUsuarioActual();
    if (usuario) {
        try {
            const res = await apiActualizarEstado(ean, vto, nuevoEstado, usuario);
            if (res.ok) {
                const p = productosEnMemoria.find(x => (x.ean || x.EAN) === ean && (x.vencimiento || x.VENCIMIENTO) === vto);
                if (p) p.ESTADO = nuevoEstado;
                renderizarTabla(document.getElementById('vdb-list'), document.getElementById('vdb-empty'), productosEnMemoria);
                window.dispatchEvent(new CustomEvent('veteo:productosActualizados', { detail: productosEnMemoria }));
            }
        } catch (e) {
            console.error(e);
        }
    }
}

export function copiarEAN(ean, event) {
    event.stopPropagation();
    const btn = event.currentTarget;
    const originalIcon = btn.innerHTML;

    navigator.clipboard.writeText(ean).then(() => {

        btn.classList.add('copied');

        btn.innerHTML = `
            <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;

        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = originalIcon;
        }, 2000);
    });
}

function renderizarTabla(contenedor, elementoVacio, filas) {
    contenedor.querySelectorAll('.vdb-row').forEach(el => el.remove());

    if (!filas?.length) {
        alternarEstadoVacio(elementoVacio, false);
        return;
    }

    const filasFiltradas = filas.filter(item => {
        const sec = parseInt(item.sec || item.SEC);
        return ![30, 31, 32, 33, 65, 83].includes(sec);
    });

    const filasOrdenadas = filasFiltradas.sort((a, b) =>
        obtenerDiasRestantes(a.vencimiento || a.VENCIMIENTO) - obtenerDiasRestantes(b.vencimiento || b.VENCIMIENTO)
    );

    filasOrdenadas.forEach(item => {
        const ean = item.ean || item.EAN;
        const vto = item.vencimiento || item.VENCIMIENTO;
        const desc = item.descripcion || item.DESCRIPCION || "";
        const sec = parseInt(item.sec || item.SEC);
        const cantRaw = item.cantidad || item.CANTIDAD;
        const cant = !isNaN(parseFloat(cantRaw)) ? parseFloat(cantRaw).toString().replace('.', ',') : cantRaw;
        const estado = item.ESTADO || 'PENDIENTE';
        const dias = obtenerDiasRestantes(vto);
        const etapa = obtenerEtapa(dias);
        const textoVence = dias === 0 ? 'Vence hoy' : `Vence el ${formatearFecha(vto)}`;
        const textoDias = dias < 0 ? `Vencido hace ${Math.abs(dias)}d` : `${dias}d restantes`;

        let labelPrincipal = "";
        const descMinuscula = desc.toLowerCase();

        if ([11, 14].includes(sec) || (sec === 20 && dias >= 3 && dias <= 7)) {
            labelPrincipal = "PCH";
        }
        else if ([20, 21, 22, 23, 24, 26].includes(sec)) {
            labelPrincipal = "PFT";
        }
        else if (descMinuscula.includes("carrefour") || descMinuscula.includes("bulnez") || [10, 34].includes(sec)) {
            labelPrincipal = "ACC";
        }
        else if (sec === 15) {
            labelPrincipal = "PAS";
        }

        const mostrarUM = (sec === 14 || sec === 15 || sec === 10) && (dias >= 3 && dias <= 7);
        if (mostrarUM) {
            labelPrincipal = "";
        }

        const elemento = document.createElement('div');
        elemento.className = `vdb-row ${estado.includes('CARGADO') ? 'vdb-row--done' : ''}`;
        elemento.dataset.fecha = vto;
        elemento.dataset.vencido = dias < 0 ? 'true' : 'false';

        if (dias < 0) {
            elemento.style.display = 'none';
        }

        elemento.innerHTML = `
            <div class="vdb-row__left">
                <span class="venc-badge ${etapa.claseCSS}">${etapa.etiqueta}</span>
            </div>
            <div class="vdb-row__info">
                <div class="vdb-row__name">${escaparHTML(desc)}</div>
                <div class="vdb-row__meta">
                    EAN ${escaparHTML(ean)} · SEC ${sec} · ${textoVence} · ${textoDias} · Cant: ${cant}
                </div>
            </div>
            <div class="vdb-row__actions">
                <button class="copy-btn" title="Copiar EAN">
                    <div class="copy-icon"></div>
                </button>
                ${labelPrincipal ? `<button class="action-btn action-btn--main" id="btn-main-${ean}" data-action="${labelPrincipal}">${labelPrincipal}</button>` : ''}
                ${mostrarUM ? `<button class="action-btn action-btn--um">UM</button>` : ''}
            </div>
        `;

        elemento.querySelector('.copy-btn').onclick = (e) => copiarEAN(ean, e);

        const btnMain = elemento.querySelector('.action-btn--main');
        if (btnMain) {
            btnMain.onclick = () => ejecutarCargaCompleta(item, 'PRINCIPAL');
        }

        if (mostrarUM) {
            elemento.querySelector('.action-btn--um').onclick = () => ejecutarCargaCompleta(item, 'UM');
        }

        contenedor.appendChild(elemento);
    });

    const tieneVisibles = [...contenedor.querySelectorAll('.vdb-row')].some(r => r.style.display !== 'none');
    alternarEstadoVacio(elementoVacio, tieneVisibles);
}

function establecerCargando(boton, texto) {
    boton.disabled = true;
    boton.textContent = texto;
}

function restablecerBoton(boton, texto) {
    boton.disabled = false;
    boton.textContent = texto;
}

export async function inicializarBaseDatosVencimientos() {
    const entradaArchivo = document.getElementById('vdb-file-input');
    const botonImportar = document.getElementById('vdb-import-btn');
    const botonRefrescar = document.getElementById('vdb-refresh-btn');
    const contenedorLista = document.getElementById('vdb-list');
    const elementoVacio = document.getElementById('vdb-empty');
    const elementoEstado = document.getElementById('vdb-status');

    if (!contenedorLista) return;

    async function cargarDatos() {
        const usuario = obtenerUsuarioActual();
        if (!usuario) {
            renderizarTabla(contenedorLista, elementoVacio, []);
            if (elementoEstado) elementoEstado.textContent = 'Iniciá sesión con Google para ver o importar.';
            return;
        }

        if (elementoEstado) elementoEstado.textContent = 'Conectando…';

        try {
            const datosApi = await apiObtenerTodo(usuario);
            if (datosApi.needsSetup) {
                const setup = await apiConfigurarHoja(usuario);
                if (setup.spreadsheetId) {
                    const url = `https://docs.google.com/spreadsheets/d/${setup.spreadsheetId}`;
                    localStorage.setItem('veteo_sheets_url', url);
                }
                await cargarDatos();
                return;
            }
            productosEnMemoria = datosApi.rows || [];
            if (!localStorage.getItem('veteo_sheets_url') && datosApi.spreadsheetId) {
                const url = `https://docs.google.com/spreadsheets/d/${datosApi.spreadsheetId}`;
                localStorage.setItem('veteo_sheets_url', url);
            }
            renderizarTabla(contenedorLista, elementoVacio, productosEnMemoria);
            if (elementoEstado) elementoEstado.textContent = construirEstado(usuario);
            window.dispatchEvent(new CustomEvent('veteo:productosActualizados', { detail: productosEnMemoria }));
        } catch (error) {
            console.error('[Veteo Error]:', error);
            if (elementoEstado) elementoEstado.textContent = 'Error de conexión.';
        }
    }

    function construirEstado(usuario) {
        const vigentes = productosEnMemoria.filter(item => obtenerDiasRestantes(item.vencimiento || item.VENCIMIENTO) >= 0);
        return `${vigentes.length} productos vigentes · ${usuario.email}`;
    }

    botonImportar?.addEventListener('click', () => {
        if (!obtenerUsuarioActual()) return;
        entradaArchivo?.click();
    });

    entradaArchivo?.addEventListener('change', async () => {
        const usuario = obtenerUsuarioActual();
        const archivo = entradaArchivo.files[0];
        if (!archivo || !usuario) return;

        establecerCargando(botonImportar, 'Procesando…');
        const lector = new FileReader();
        lector.onload = async (e) => {
            const filas = parsearTxt(e.target.result);
            if (filas.length > 0) {
                const res = await apiImportarTxt(filas, usuario);
                if (res.ok) await cargarDatos();
            }
            restablecerBoton(botonImportar, '↑ Importar TXT');
            entradaArchivo.value = '';
        };
        lector.readAsText(archivo);
    });

    botonRefrescar?.addEventListener('click', cargarDatos);

    const usuarioActual = obtenerUsuarioActual();
    if (usuarioActual) {
        await cargarDatos();
    } else {
        renderizarTabla(contenedorLista, elementoVacio, []);
        window.addEventListener('veteo:login', () => cargarDatos(), { once: true });
    }
}