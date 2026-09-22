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
import {
    parsearFecha, formatearVencimiento as formatearFecha,
    normalizarVencimiento,
} from '../utils/fecha-vencimiento.js';
import { getAuthInstance } from '../firebase/firebase.js';
import {
    collection, doc, getDoc, getDocs, setDoc,
    deleteDoc, writeBatch, serverTimestamp,
    query, where, orderBy,
} from 'firebase/firestore';

const DIAS_RETENCION_VENCIDOS = 7;

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

function claveProducto(ean, vencimiento) {
    const eanLimpio = String(ean || '').trim();
    const fecha = normalizarVencimiento(vencimiento);
    if (!eanLimpio || !fecha) return '';
    return `${eanLimpio}__${fecha.replace(/\//g, '-')}`;
}

async function eliminarEnLotes(referencias) {
    for (let i = 0; i < referencias.length; i += 490) {
        const batch = writeBatch(getFirestoreInstance());
        referencias.slice(i, i + 490).forEach(ref => batch.delete(ref));
        await batch.commit();
    }
    return referencias.length;
}

async function buscarEscaneados(tiendaId, ean, vencimiento) {
    const eanLimpio = String(ean || '').trim();
    const fecha = normalizarVencimiento(vencimiento);
    if (!eanLimpio || !fecha) return [];

    const snap = await getDocs(query(refEscaneados(tiendaId), where('ean', '==', eanLimpio)));
    return snap.docs.filter(d => normalizarVencimiento(d.data().fechaVencimiento) === fecha);
}

async function barrerEscaneados(tiendaId, clavesDelArchivo) {
    const snap = await getDocs(refEscaneados(tiendaId));
    const aEliminar = [];
    const estadosHeredados = {};

    snap.forEach(d => {
        const data = d.data();
        const vencimiento = data.fechaVencimiento || data.vencimiento || '';
        const clave = claveProducto(data.ean, vencimiento);

        if (clave && clavesDelArchivo.has(clave)) {
            if (String(data.estado || '').includes('CARGADO')) {
                estadosHeredados[clave] = {
                    estado: data.estado,
                    cargadoEl: data.cargadoEl || null,
                };
            }
            aEliminar.push(d.ref);
            return;
        }

        const dias = obtenerDiasRestantes(vencimiento);
        if (dias !== null && dias < -DIAS_RETENCION_VENCIDOS) aEliminar.push(d.ref);
    });

    const eliminados = await eliminarEnLotes(aEliminar);
    return { eliminados, estadosHeredados };
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
        filas.map(fila => claveProducto(fila.ean, fila.vencimiento)).filter(Boolean)
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

    await eliminarEnLotes(clavesAEliminar.map(clave => doc(vencRef, clave)));

    const { eliminados: escaneadosBarridos, estadosHeredados } =
        await barrerEscaneados(tiendaId, clavesDelArchivo);

    for (const [clave, estado] of Object.entries(estadosHeredados)) {
        if (!mapaEstados[clave]) mapaEstados[clave] = estado;
    }

    const chunks = [];
    for (let i = 0; i < filas.length; i += 490) {
        chunks.push(filas.slice(i, i + 490));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(getFirestoreInstance());
        chunk.forEach(fila => {
            const clave = claveProducto(fila.ean, fila.vencimiento);
            if (!clave) return;
            const previo = mapaEstados[clave];
            const docRef = doc(vencRef, clave);

            batch.set(docRef, {
                po: fila.po || '',
                sec: fila.sec || '',
                ean: String(fila.ean || '').trim(),
                descripcion: fila.descripcion || '',
                stock: fila.stock || '',
                cantidad: fila.cantidad || '',
                vencimiento: normalizarVencimiento(fila.vencimiento),
                estado: previo ? previo.estado : 'PENDIENTE',
                importadoEl: hoy,
                cargadoEl: previo ? previo.cargadoEl : null,
            });
        });
        await batch.commit();
    }

    return { ok: true, imported: filas.length, escaneadosBarridos };
}

export async function obtenerTodosFirestore() {
    const tiendaId = obtenerTiendaId();
    if (!tiendaId) return { rows: [], cargasHoy: 0 };

    const snapVenc = await getDocs(refVencimientos(tiendaId));
    const vencimientos = [];
    snapVenc.forEach(d => {
        const data = d.data();
        vencimientos.push({
            id: d.id,
            fuente: 'venc',
            ...data,
            vencimiento: normalizarVencimiento(data.vencimiento) || data.vencimiento || '',
        });
    });

    const snapEsc = await getDocs(refEscaneados(tiendaId));
    const escaneados = [];
    snapEsc.forEach(d => {
        const data = d.data();
        escaneados.push({
            id: d.id,
            fuente: 'esc',
            ...data,
            fechaVencimiento: normalizarVencimiento(data.fechaVencimiento) || data.fechaVencimiento || '',
        });
    });
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

    const clave = claveProducto(ean, vencimiento);

    if (clave) {
        const docRef = doc(refVencimientos(tiendaId), clave);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            await setDoc(docRef, {
                estado,
                cargadoEl: serverTimestamp(),
            }, { merge: true });

            await registrarHistorial(tiendaId, { ...snap.data(), estado });
            return { ok: true };
        }
    }

    const escaneados = await buscarEscaneados(tiendaId, ean, vencimiento);

    if (escaneados.length) {
        const batch = writeBatch(getFirestoreInstance());
        escaneados.forEach(d => batch.set(d.ref, {
            estado,
            cargadoEl: serverTimestamp(),
        }, { merge: true }));
        await batch.commit();

        await registrarHistorial(tiendaId, { ...escaneados[0].data(), estado });
        return { ok: true };
    }

    throw new Error('Producto no encontrado');
}

export async function guardarEscaneadoFirestore(datos) {
    const tiendaId = obtenerTiendaId();
    if (!tiendaId) throw new Error('No hay tienda activa');

    const ean = String(datos.ean || '').trim();
    const vencimiento = normalizarVencimiento(datos.fecha_vencimiento);
    if (!vencimiento) throw new Error('La fecha de vencimiento no es válida');

    const clave = claveProducto(ean, vencimiento);
    const destino = clave
        ? doc(refEscaneados(tiendaId), clave)
        : doc(refEscaneados(tiendaId));

    const existentes = clave ? await buscarEscaneados(tiendaId, ean, vencimiento) : [];
    const anterior = existentes.find(d => (d.data().estado || '').includes('CARGADO')) || existentes[0];
    const previo = anterior?.data() || {};

    await setDoc(destino, {
        sec: datos.sec || previo.sec || '',
        ean,
        descripcion: datos.descripcion || 'Ingreso manual',
        cantidad: datos.cantidad || 1,
        fechaVencimiento: vencimiento,
        nota: datos.nota || '',
        estado: previo.estado || 'PENDIENTE',
        cargadoEl: previo.cargadoEl || null,
        creadoEl: previo.creadoEl || serverTimestamp(),
    });

    await eliminarEnLotes(
        existentes.filter(d => d.id !== destino.id).map(d => d.ref)
    );

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

    const existentes = await buscarEscaneados(tiendaId, ean, fechaVencimiento);
    if (!existentes.length) throw new Error('No se encontró el registro');

    await eliminarEnLotes(existentes.map(d => d.ref));

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

function obtenerDiasRestantes(cadena) {
    const objetivo = parsearFecha(cadena);
    if (!objetivo) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((objetivo - hoy) / (1000 * 60 * 60 * 24));
}

function obtenerEtapa(dias) {
    if (dias === null) return { etiqueta: '?', claseCSS: 'venc-badge--unknown' };
    const etiqueta = dias < 0 ? 'Vencido' : dias <= 7 ? '−7' : dias <= 30 ? '−30' : dias <= 60 ? '−60' : '−90';
    if (dias <= 7) return { etiqueta, claseCSS: 'venc-badge--7' };
    if (dias <= 30) return { etiqueta, claseCSS: 'venc-badge--30' };
    if (dias <= 60) return { etiqueta, claseCSS: 'venc-badge--60' };
    return { etiqueta, claseCSS: 'venc-badge--90' };
}

function sinStock(item) {
    const crudo = String(item.stock ?? '').trim();
    if (!crudo) return false;
    const numero = parseFloat(crudo.replace(',', '.'));
    return isFinite(numero) && numero <= 0;
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

        const agotado = sinStock(item);

        const elemento = document.createElement('div');
        elemento.className = `venc-row ${estado.includes('CARGADO') ? 'venc-row--done' : ''}`;
        elemento.dataset.fecha = vto;
        elemento.dataset.vencido = dias < 0 ? 'true' : 'false';
        elemento.dataset.sinStock = agotado ? 'true' : 'false';
        if (dias < 0) elemento.style.display = 'none';

        elemento.innerHTML = `
            <span class="venc-badge ${etapa.claseCSS}">${etapa.etiqueta}</span>
            <div class="venc-row__info">
                <div class="venc-row__name">${escaparHTML(desc)}</div>
                <div class="venc-row__meta">
                    <span class="venc-row__urgency ${claseUrgencia(dias)}">${textoUrgencia(dias)}</span>
                    ${agotado ? '<span class="venc-row__sin-stock">Sin stock</span>' : ''}
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
                esEscaneado ? 'tus cargas manuales' : 'el listado importado de GNX'
            );
            if (!confirmado) return;

            try {
                if (esEscaneado) {
                    await eliminarEscaneadoFirestore(ean, vto);
                } else {
                    await eliminarImportadoFirestore(item.id);
                }
                productosEnMemoria = productosEnMemoria.filter(p => {
                    if (p.id === item.id) return false;
                    if (!esEscaneado || p.fuente !== 'esc') return true;
                    return claveProducto(p.ean, p.fechaVencimiento) !== claveProducto(ean, vto);
                });
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
            if (elementoEstado) elementoEstado.textContent = 'No pudimos traer los datos. Tocá ↺ Actualizar.';
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
                    if (res.escaneadosBarridos && elementoEstado) {
                        elementoEstado.textContent +=
                            ` · ${res.escaneadosBarridos} carga${res.escaneadosBarridos > 1 ? 's' : ''} manual${res.escaneadosBarridos > 1 ? 'es' : ''} dada${res.escaneadosBarridos > 1 ? 's' : ''} de baja`;
                    }
                    trackearEvento('importacion_txt', {
                        cantidad_productos: res.imported,
                        escaneados_barridos: res.escaneadosBarridos || 0,
                    });
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