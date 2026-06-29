import { db } from '../firebase/firebase.js';
import { alternarEstadoVacio } from '../utils/ui.js';
import { obtenerTiendaId, obtenerOperador } from './auth.js';
import {
    sincronizarImpacto, sumarCargaGamificacion,
    recalcularGamificacionTotal
} from './checklist.js';
import { trackearEvento } from './analytics.js';
import { ENLACES_APP } from './enlaces.js';

import {
    collection, doc, getDoc, getDocs, setDoc,
    deleteDoc, writeBatch, serverTimestamp,
    query, where, orderBy,
} from 'firebase/firestore';

let productosEnMemoria = [];

export function obtenerProductosEnMemoria() {
    return productosEnMemoria;
}

function refVencimientos(tiendaId) {
    return collection(db, 'tiendas', tiendaId, 'vencimientos');
}

function refEscaneados(tiendaId) {
    return collection(db, 'tiendas', tiendaId, 'escaneados');
}

function refHistorial(tiendaId) {
    return collection(db, 'tiendas', tiendaId, 'historial');
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

export async function importarTxtFirestore(contenido) {
    const tiendaId = obtenerTiendaId();
    if (!tiendaId) throw new Error('No hay tienda activa');

    const filas = parsearTxt(contenido);
    if (!filas.length) throw new Error('No se encontraron filas válidas en el archivo');

    const vencRef = refVencimientos(tiendaId);
    const hoy = new Date().toISOString().split('T')[0];
    const qCargados = query(vencRef, where('estado', '==', 'CARGADO'));
    const snapCargados = await getDocs(qCargados);

    const mapaEstados = {};
    snapCargados.forEach(d => {
        const data = d.data();
        mapaEstados[`${data.ean}__${data.vencimiento}`] = {
            estado: data.estado,
            cargadoEl: data.cargadoEl || null,
        };
    });

    const chunks = [];
    for (let i = 0; i < filas.length; i += 490) {
        chunks.push(filas.slice(i, i + 490));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(fila => {
            const clave = `${fila.ean}__${fila.vencimiento}`;
            const previo = mapaEstados[clave];
            const docRef = doc(vencRef, clave);

            batch.set(docRef, {
                po: fila.po || '',
                sec: fila.sec || '',
                ean: fila.ean || '',
                descripcion: fila.descripcion || '',
                stock: fila.stock || '',
                cantidad: fila.cantidad || '',
                vencimiento: fila.vencimiento || '',
                estado: previo ? previo.estado : 'PENDIENTE',
                importadoEl: hoy,
                cargadoEl: previo ? previo.cargadoEl : null,
            });
        });
        await batch.commit();
    }

    return { ok: true, imported: filas.length };
}

export async function obtenerTodosFirestore() {
    const tiendaId = obtenerTiendaId();
    if (!tiendaId) return { rows: [], cargasHoy: 0 };

    const snapVenc = await getDocs(refVencimientos(tiendaId));
    const vencimientos = [];
    snapVenc.forEach(d => vencimientos.push({ id: d.id, fuente: 'venc', ...d.data() }));

    const snapEsc = await getDocs(refEscaneados(tiendaId));
    const escaneados = [];
    snapEsc.forEach(d => escaneados.push({ id: d.id, fuente: 'esc', ...d.data() }));
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const snapHist = await getDocs(refHistorial(tiendaId));
    let cargasHoy = 0;
    snapHist.forEach(d => {
        const fecha = d.data().fechaCarga?.toDate?.();
        if (fecha && fecha >= hoy) cargasHoy++;
    });

    return {
        rows: [...vencimientos, ...escaneados],
        cargasHoy,
    };
}

export async function actualizarEstadoFirestore(ean, vencimiento, estado) {
    const tiendaId = obtenerTiendaId();
    if (!tiendaId) throw new Error('No hay tienda activa');

    const clave = `${ean}__${vencimiento}`;
    const docRef = doc(db, 'tiendas', tiendaId, 'vencimientos', clave);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
        await setDoc(docRef, {
            estado,
            cargadoEl: serverTimestamp(),
        }, { merge: true });

        await registrarHistorial(tiendaId, { ...snap.data(), estado });
        return { ok: true };
    }

    const escRef = refEscaneados(tiendaId);
    const qEsc = query(escRef,
        where('ean', '==', ean),
        where('fechaVencimiento', '==', vencimiento)
    );
    const snapEsc = await getDocs(qEsc);

    if (!snapEsc.empty) {
        const escDoc = snapEsc.docs[0];
        await setDoc(escDoc.ref, {
            estado,
            cargadoEl: serverTimestamp(),
        }, { merge: true });
        await registrarHistorial(tiendaId, { ...escDoc.data(), estado });
        return { ok: true };
    }

    throw new Error('Producto no encontrado');
}

export async function guardarEscaneadoFirestore(datos) {
    const tiendaId = obtenerTiendaId();
    if (!tiendaId) throw new Error('No hay tienda activa');

    const nuevoRef = doc(refEscaneados(tiendaId));
    await setDoc(nuevoRef, {
        sec: datos.sec || '',
        ean: datos.ean || '',
        descripcion: datos.descripcion || 'Ingreso manual',
        cantidad: datos.cantidad || 1,
        fechaVencimiento: String(datos.fecha_vencimiento || ''),
        nota: datos.nota || '',
        estado: 'PENDIENTE',
        cargadoEl: null,
        creadoEl: serverTimestamp(),
    });

    return { ok: true };
}

export async function eliminarEscaneadoFirestore(ean, fechaVencimiento) {
    const tiendaId = obtenerTiendaId();
    if (!tiendaId) throw new Error('No hay tienda activa');

    const escRef = refEscaneados(tiendaId);
    const q = query(escRef,
        where('ean', '==', ean),
        where('fechaVencimiento', '==', fechaVencimiento)
    );
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('No se encontró el registro');

    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    return { ok: true };
}

async function registrarHistorial(tiendaId, datos) {
    const operador = obtenerOperador();
    const nuevoRef = doc(refHistorial(tiendaId));
    await setDoc(nuevoRef, {
        fechaCarga: serverTimestamp(),
        sec: String(datos.sec || ''),
        ean: String(datos.ean || ''),
        descripcion: String(datos.descripcion || ''),
        vencimiento: String(datos.vencimiento || datos.fechaVencimiento || ''),
        estadoAsignado: String(datos.estado || ''),
        operador: operador?.nombre || 'Sin nombre',
    });
}

export function copiarEAN(ean, event) {
    event.stopPropagation();
    const btn = event.currentTarget;
    const originalHTML = btn.innerHTML;

    navigator.clipboard.writeText(ean).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = `
            <svg class="copy-icon" viewBox="0 0 24 24" fill="none"
                    stroke="white" stroke-width="3"
                    stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>`;
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = originalHTML;
        }, 2000);
    });
}

export async function ejecutarCargaCompleta(item, tipo) {
    const sec = parseInt(item.sec || item.SEC);
    const ean = item.ean || item.EAN;
    const vto = item.vencimiento || item.VENCIMIENTO || item.fechaVencimiento;
    const desc = item.descripcion || item.DESCRIPCION || '';
    const descMin = desc.toLowerCase();
    const dias = obtenerDiasRestantes(vto);

    const FORMS = {
        PAS: { url: ENLACES_APP.formPas, id: 'entry.1279354663' },
        PFT: { url: ENLACES_APP.formPft, id: 'entry.849574475' },
        UM: { url: ENLACES_APP.ultimaMilla, idEan: 'entry.140972296', idDesc: 'entry.315963851' },
        S10: { url: ENLACES_APP.accEspeciales, id: 'entry.1275730876' },
        PCH: { url: ENLACES_APP.pch },
    };

    let urlAbrir = '';
    let nuevoEstado = 'CARGADO';

    if (tipo === 'UM') {
        urlAbrir = `${FORMS.UM.url}?usp=pp_url&${FORMS.UM.idEan}=${ean}&${FORMS.UM.idDesc}=${encodeURIComponent(desc)}`;
        nuevoEstado = 'CARGADO UM';
    } else {
        if (sec === 20 && dias >= 3 && dias <= 7) urlAbrir = FORMS.PCH.url;
        else if ([20, 21, 22, 23, 24, 26].includes(sec)) urlAbrir = FORMS.PFT.url;
        else if (descMin.includes('carrefour') || descMin.includes('bulnez'))
            urlAbrir = `${FORMS.S10.url}?usp=pp_url&${FORMS.S10.id}=${ean}`;
        else if ([10, 34].includes(sec)) urlAbrir = `${FORMS.S10.url}?usp=pp_url&${FORMS.S10.id}=${ean}`;
        else if (sec === 15) urlAbrir = `${FORMS.PAS.url}?usp=pp_url&${FORMS.PAS.id}=${ean}`;
        else if ([11, 14].includes(sec)) urlAbrir = FORMS.PCH.url;
    }

    if (urlAbrir) window.open(urlAbrir, '_blank');

    try {
        await actualizarEstadoFirestore(ean, vto, nuevoEstado);
        sumarCargaGamificacion();
        trackearEvento('carga_completada', { tipo_carga: tipo, ean_producto: ean });

        const p = productosEnMemoria.find(x =>
            (x.ean || x.EAN) === ean &&
            (x.vencimiento || x.VENCIMIENTO || x.fechaVencimiento) === vto
        );
        if (p) {
            p.estado = nuevoEstado;
            p.cargadoEl = new Date().toISOString();
        }

        renderizarTabla(
            document.getElementById('vdb-list'),
            document.getElementById('vdb-empty'),
            productosEnMemoria
        );
        window.dispatchEvent(new CustomEvent('veteo:productosActualizados', { detail: productosEnMemoria }));
    } catch (err) {
        console.error('[ejecutarCargaCompleta]:', err);
    }
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

function obtenerDiasRestantes(cadena) {
    const objetivo = parsearFecha(cadena);
    if (!objetivo) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((objetivo - hoy) / (1000 * 60 * 60 * 24));
}

function obtenerEtapa(dias) {
    if (dias === null) return { etiqueta: '?', claseCSS: 'venc-badge--unknown' };
    const etiqueta = dias < 0 ? `+${Math.abs(dias)}d` : `-${dias}d`;
    if (dias <= 7) return { etiqueta, claseCSS: 'venc-badge--7' };
    if (dias <= 30) return { etiqueta, claseCSS: 'venc-badge--30' };
    if (dias <= 60) return { etiqueta, claseCSS: 'venc-badge--60' };
    return { etiqueta, claseCSS: 'venc-badge--90' };
}

function formatearFecha(cadena) {
    const f = parsearFecha(cadena);
    if (!f) return cadena;
    return f.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escaparHTML(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderizarTabla(contenedor, elementoVacio, filas) {
    contenedor?.querySelectorAll('.vdb-row').forEach(el => el.remove());
    if (!filas?.length) { alternarEstadoVacio(elementoVacio, false); return; }

    const SECS_EXCLUIDOS = [30, 31, 32, 33, 65, 83];
    const filasFiltradas = filas
        .filter(item => !SECS_EXCLUIDOS.includes(parseInt(item.sec || item.SEC)))
        .sort((a, b) => {
            const va = item => item.vencimiento || item.VENCIMIENTO || item.fechaVencimiento;
            return obtenerDiasRestantes(va(a)) - obtenerDiasRestantes(va(b));
        });

    filasFiltradas.forEach(item => {
        const ean = item.ean || item.EAN || '';
        const vto = item.vencimiento || item.VENCIMIENTO || item.fechaVencimiento || '';
        const desc = item.descripcion || item.DESCRIPCION || '';
        const sec = parseInt(item.sec || item.SEC);
        const cantRaw = item.cantidad || item.CANTIDAD || 1;
        const cant = !isNaN(parseFloat(cantRaw))
            ? parseFloat(cantRaw).toString().replace('.', ',')
            : cantRaw;
        const estado = item.estado || item.ESTADO || 'PENDIENTE';
        const dias = obtenerDiasRestantes(vto);
        const etapa = obtenerEtapa(dias);

        const textoVence = dias === 0 ? 'Vence hoy' : `Vence el ${formatearFecha(vto)}`;
        const textoDias = dias < 0
            ? `Vencido hace ${Math.abs(dias)}d`
            : `${dias}d restantes`;

        const descMin = desc.toLowerCase();
        let labelPrincipal = '';

        if (sec === 20 && dias >= 3 && dias <= 7) labelPrincipal = 'PCH';
        else if ([20, 21, 22, 23, 24, 26].includes(sec)) labelPrincipal = 'PFT';
        else if (descMin.includes('carrefour') || descMin.includes('bulnez')) labelPrincipal = 'ACC';
        else if ([10, 34].includes(sec)) labelPrincipal = 'ACC';
        else if (sec === 15) labelPrincipal = 'PAS';
        else if ([11, 14].includes(sec)) labelPrincipal = 'PCH';

        const mostrarUM = [10, 14, 15].includes(sec) && dias >= 3 && dias <= 7;
        if (mostrarUM) labelPrincipal = '';

        const elemento = document.createElement('div');
        elemento.className = `vdb-row ${estado.includes('CARGADO') ? 'vdb-row--done' : ''}`;
        elemento.dataset.fecha = vto;
        elemento.dataset.vencido = dias < 0 ? 'true' : 'false';
        if (dias < 0) elemento.style.display = 'none';

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
                ${labelPrincipal
                ? `<button class="action-btn action-btn--main" data-action="${labelPrincipal}">${labelPrincipal}</button>`
                : ''}
                ${mostrarUM
                ? `<button class="action-btn action-btn--um">UM</button>`
                : ''}
            </div>`;

        elemento.querySelector('.copy-btn').onclick = e => copiarEAN(ean, e);

        const btnMain = elemento.querySelector('.action-btn--main');
        if (btnMain) btnMain.onclick = () => ejecutarCargaCompleta(item, 'PRINCIPAL');

        if (mostrarUM) {
            elemento.querySelector('.action-btn--um').onclick = () => ejecutarCargaCompleta(item, 'UM');
        }

        contenedor.appendChild(elemento);
    });

    const tieneVisibles = [...contenedor.querySelectorAll('.vdb-row')]
        .some(r => r.style.display !== 'none');
    alternarEstadoVacio(elementoVacio, tieneVisibles);

    const filtroActivo = contenedor.dataset.filtroActivo;
    if (filtroActivo && filtroActivo !== 'todos') {
        [...contenedor.querySelectorAll('.vdb-row')].forEach(r => {
            const esVencido = r.dataset.vencido === 'true';
            const botones = [...r.querySelectorAll('.action-btn')];
            const coincide = filtroActivo === 'vencidos'
                ? esVencido
                : !esVencido && botones.some(b => b.textContent.trim() === filtroActivo);
            r.style.display = coincide ? '' : 'none';
        });
    }

    recalcularGamificacionTotal();
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
        const tiendaId = obtenerTiendaId();
        if (!tiendaId) {
            renderizarTabla(contenedorLista, elementoVacio, []);
            if (elementoEstado) elementoEstado.textContent = 'Iniciá sesión para ver los datos.';
            return;
        }

        if (elementoEstado) elementoEstado.textContent = 'Cargando…';

        try {
            const { rows, cargasHoy } = await obtenerTodosFirestore();
            productosEnMemoria = rows;
            sincronizarImpacto(cargasHoy);
            renderizarTabla(contenedorLista, elementoVacio, productosEnMemoria);
            if (elementoEstado) {
                const vigentes = productosEnMemoria.filter(
                    item => obtenerDiasRestantes(item.vencimiento || item.VENCIMIENTO || item.fechaVencimiento) >= 0
                );
                elementoEstado.textContent = `${vigentes.length} productos vigentes · Tienda ${tiendaId}`;
            }
            window.dispatchEvent(new CustomEvent('veteo:productosActualizados', { detail: productosEnMemoria }));
        } catch (err) {
            console.error('[VDB]:', err);
            if (elementoEstado) elementoEstado.textContent = 'Error de conexión.';
        }
    }

    botonImportar?.addEventListener('click', () => {
        if (!obtenerTiendaId()) return;
        entradaArchivo?.click();
    });

    entradaArchivo?.addEventListener('change', async () => {
        const archivo = entradaArchivo.files[0];
        if (!archivo) return;

        botonImportar.disabled = true;
        botonImportar.textContent = 'Procesando…';

        const lector = new FileReader();
        lector.onload = async e => {
            try {
                const res = await importarTxtFirestore(e.target.result);
                if (res.ok) {
                    await cargarDatos();
                    trackearEvento('importacion_txt', { cantidad_productos: res.imported });
                }
            } catch (err) {
                console.error('[Importar TXT]:', err);
            } finally {
                botonImportar.disabled = false;
                botonImportar.textContent = '↑ Importar TXT';
                entradaArchivo.value = '';
            }
        };
        lector.readAsText(archivo, 'ISO-8859-1');
    });

    botonRefrescar?.addEventListener('click', cargarDatos);

    const tiendaId = obtenerTiendaId();
    if (tiendaId) {
        await cargarDatos();
    } else {
        renderizarTabla(contenedorLista, elementoVacio, []);
        window.addEventListener('veteo:login', () => cargarDatos(), { once: true });
    }
}