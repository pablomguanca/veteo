import { getFirestoreInstance } from '../firebase/firebase.js';
import { alternarEstadoVacio } from '../utils/ui.js';
import { obtenerTiendaId, obtenerOperador } from './auth.js';
import {
    sincronizarImpacto, sumarCargaGamificacion,
    recalcularGamificacionTotal
} from './checklist.js';
import { trackearEvento } from './analytics.js';
import { construirUrlFormulario, resolverAcciones } from './formularios.js';
import {
    botonesFila, claseUrgencia, textoUrgencia,
    confirmarEliminacion, ICONO_COPIADO
} from '../utils/fila-vencimiento.js';
import { getAuthInstance } from '../firebase/firebase.js';
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
    return collection(getFirestoreInstance(), 'tiendas', tiendaId, 'vencimientos');
}

function refEscaneados(tiendaId) {
    return collection(getFirestoreInstance(), 'tiendas', tiendaId, 'escaneados');
}

function refHistorial(tiendaId) {
    return collection(getFirestoreInstance(), 'tiendas', tiendaId, 'historial');
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

    const snapTodos = await getDocs(vencRef);

    const clavesDelArchivo = new Set(
        filas.map(fila => `${fila.ean}__${fila.vencimiento.replace(/\//g, '-')}`)
    );

    const mapaEstados = {};
    const clavesAEliminar = [];

    snapTodos.forEach(d => {
        const data = d.data();
        const sigueEnArchivo = clavesDelArchivo.has(d.id);

        if (!sigueEnArchivo) {
            clavesAEliminar.push(d.id);
            return;
        }

        if (data.estado === 'CARGADO' || data.estado === 'CARGADO UM') {
            mapaEstados[d.id] = {
                estado: data.estado,
                cargadoEl: data.cargadoEl || null,
            };
        }
    });

    const chunksEliminar = [];
    for (let i = 0; i < clavesAEliminar.length; i += 490) {
        chunksEliminar.push(clavesAEliminar.slice(i, i + 490));
    }
    for (const chunk of chunksEliminar) {
        const batch = writeBatch(getFirestoreInstance());
        chunk.forEach(clave => batch.delete(doc(vencRef, clave)));
        await batch.commit();
    }

    const chunks = [];
    for (let i = 0; i < filas.length; i += 490) {
        chunks.push(filas.slice(i, i + 490));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(getFirestoreInstance());
        chunk.forEach(fila => {
            const clave = `${fila.ean}__${fila.vencimiento.replace(/\//g, '-')}`;
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

    const clave = `${ean}__${vencimiento.replace(/\//g, '-')}`;
    const docRef = doc(getFirestoreInstance(), 'tiendas', tiendaId, 'vencimientos', clave);
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

export async function eliminarImportadoFirestore(idDocumento) {
    const tiendaId = obtenerTiendaId();
    if (!tiendaId) throw new Error('No hay tienda activa');
    if (!idDocumento) throw new Error('Falta el identificador del registro');

    await deleteDoc(doc(refVencimientos(tiendaId), idDocumento));

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

    const batch = writeBatch(getFirestoreInstance());
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
        btn.classList.add('is-copied');
        btn.innerHTML = ICONO_COPIADO;
        setTimeout(() => {
            btn.classList.remove('is-copied');
            btn.innerHTML = originalHTML;
        }, 2000);
    });
}

export async function ejecutarCargaCompleta(item, tipo) {
    const ean = item.ean || item.EAN;
    const vto = item.vencimiento || item.VENCIMIENTO || item.fechaVencimiento;

    const clave = tipo === 'UM' ? 'UM' : resolverAcciones(item).principal;
    const nuevoEstado = tipo === 'UM' ? 'CARGADO UM' : 'CARGADO';

    const urlAbrir = clave ? construirUrlFormulario(clave, item) : '';

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
    contenedor?.querySelectorAll('.venc-row').forEach(el => el.remove());
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

        const { etiquetaPrincipal: labelPrincipal, mostrarUM } = resolverAcciones(item);

        const elemento = document.createElement('div');
        elemento.className = `venc-row ${estado.includes('CARGADO') ? 'venc-row--done' : ''}`;
        elemento.dataset.fecha = vto;
        elemento.dataset.vencido = dias < 0 ? 'true' : 'false';
        if (dias < 0) elemento.style.display = 'none';

        elemento.innerHTML = `
            <span class="venc-badge ${etapa.claseCSS}">${etapa.etiqueta}</span>
            <div class="venc-row__info">
                <div class="venc-row__name">${escaparHTML(desc)}</div>
                <div class="venc-row__meta">
                    <span class="venc-row__urgency ${claseUrgencia(dias)}">${textoUrgencia(dias)}</span>
                    <span>${textoVence} · EAN ${escaparHTML(ean)} · SEC ${sec} · Cant: ${cant}</span>
                </div>
            </div>
            <div class="venc-row__actions">
                ${botonesFila({
            etiquetaPrincipal: labelPrincipal,
            mostrarUM,
            permiteEliminar: true,
        })}
            </div>`;

        elemento.querySelector('[data-accion="copiar"]').onclick = e => copiarEAN(ean, e);

        const btnMain = elemento.querySelector('[data-accion="principal"]');
        if (btnMain) btnMain.onclick = () => ejecutarCargaCompleta(item, 'PRINCIPAL');

        const btnUM = elemento.querySelector('[data-accion="um"]');
        if (btnUM) btnUM.onclick = () => ejecutarCargaCompleta(item, 'UM');

        const esEscaneado = item.fuente === 'esc';

        elemento.querySelector('[data-accion="eliminar"]').onclick = async () => {
            const confirmado = await confirmarEliminacion(
                desc,
                esEscaneado ? 'Vencimientos cargados' : 'Vencimientos Importados'
            );
            if (!confirmado) return;

            try {
                if (esEscaneado) {
                    await eliminarEscaneadoFirestore(ean, vto);
                } else {
                    await eliminarImportadoFirestore(item.id);
                }
                productosEnMemoria = productosEnMemoria.filter(p => p.id !== item.id);
                elemento.remove();
                const quedanVisibles = [...contenedor.querySelectorAll('.venc-row')]
                    .some(r => r.style.display !== 'none');
                alternarEstadoVacio(elementoVacio, quedanVisibles);
                window.dispatchEvent(new CustomEvent('veteo:productosActualizados', {
                    detail: productosEnMemoria,
                }));
            } catch (err) {
                console.error('[Eliminar importado]:', err);
            }
        };

        contenedor.appendChild(elemento);
    });

    const tieneVisibles = [...contenedor.querySelectorAll('.venc-row')]
        .some(r => r.style.display !== 'none');
    alternarEstadoVacio(elementoVacio, tieneVisibles);

    const filtroActivo = contenedor.dataset.filtroActivo;
    if (filtroActivo && filtroActivo !== 'todos') {
        [...contenedor.querySelectorAll('.venc-row')].forEach(r => {
            const esVencido = r.dataset.vencido === 'true';
            const botones = [...r.querySelectorAll('.venc-row__btn')];
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
    window.addEventListener('veteo:refrescarVencimientos', cargarDatos);

    const tiendaId = obtenerTiendaId();
    if (tiendaId) {
        await cargarDatos();
    } else {
        renderizarTabla(contenedorLista, elementoVacio, []);
        window.addEventListener('veteo:login', () => cargarDatos(), { once: true });
    }
}