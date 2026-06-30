import { alternarEstadoVacio } from '../utils/ui.js';
import { obtenerTiendaId } from './auth.js';
import {
    copiarEAN, ejecutarCargaCompleta,
    guardarEscaneadoFirestore,
    eliminarEscaneadoFirestore,
    obtenerProductosEnMemoria
} from './vencimientos-db.js';
import {
    sincronizarImpacto, sumarCargaGamificacion,
    recalcularGamificacionTotal
} from './checklist.js';
import { trackearEvento } from './analytics.js';
import { getFirestoreInstance } from '../firebase/firebase.js';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { obtenerTiendaId as getTiendaId } from './auth.js';

const NIVELES_ETAPA = [
    { clave: '-7', etiqueta: '−7d', dias: 7, claseCSS: 'venc-item__badge--7' },
    { clave: '-30', etiqueta: '−30d', dias: 30, claseCSS: 'venc-item__badge--30' },
    { clave: '-60', etiqueta: '−60d', dias: 60, claseCSS: 'venc-item__badge--60' },
    { clave: '-90', etiqueta: '−90d', dias: 90, claseCSS: 'venc-item__badge--90' },
];

function obtenerDiasRestantes(cadenaFecha) {
    const objetivo = new Date(cadenaFecha + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((objetivo - hoy) / (1000 * 60 * 60 * 24));
}

function resolverEtapa(claveEtapa, cadenaFecha) {
    if (claveEtapa !== 'auto') {
        return NIVELES_ETAPA.find(n => n.clave === claveEtapa) || NIVELES_ETAPA[0];
    }
    const dias = obtenerDiasRestantes(cadenaFecha);
    if (dias <= 7) return NIVELES_ETAPA[0];
    if (dias <= 30) return NIVELES_ETAPA[1];
    if (dias <= 60) return NIVELES_ETAPA[2];
    return NIVELES_ETAPA[3];
}

function formatearFecha(cadenaFecha) {
    return new Date(cadenaFecha + 'T00:00:00')
        .toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escaparHTML(cadena) {
    return String(cadena)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function obtenerConfigBotones(sec, desc, dias) {
    const descMin = desc.toLowerCase();
    let labelPrincipal = '';

    if ([20, 21, 22, 23, 24, 26].includes(sec)) labelPrincipal = 'PFT';
    else if (descMin.includes('carrefour') || descMin.includes('bulnez')) labelPrincipal = 'ACC';
    else if ([10, 34].includes(sec)) labelPrincipal = 'ACC';
    else if (sec === 15) labelPrincipal = 'PAS';
    else if (sec === 14) labelPrincipal = 'PCH';

    const mostrarUM = [10, 14, 15].includes(sec) && dias >= 3 && dias <= 7;
    if (mostrarUM) labelPrincipal = '';

    return { labelPrincipal, mostrarUM };
}

async function cargarEscaneadosFirestore() {
    const tiendaId = getTiendaId();
    if (!tiendaId) return [];

    const ref = collection(getFirestoreInstance(), 'tiendas', tiendaId, 'escaneados');
    const snap = await getDocs(ref);
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    return items;
}

function renderizarItems(contenedor, elementoVacio, items, onEliminar) {
    contenedor.querySelectorAll('.venc-item').forEach(el => el.remove());

    const filtrados = items
        .filter(item => ![30, 31, 32, 33].includes(parseInt(item.sec)))
        .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));

    filtrados.forEach(item => {
        const sec = parseInt(item.sec);
        const fecha = item.fechaVencimiento || item.fecha || '';
        const dias = obtenerDiasRestantes(fecha);
        const etapa = resolverEtapa(item.etapa || 'auto', fecha);
        const config = obtenerConfigBotones(sec, item.descripcion || '', dias);
        const cantRaw = item.cantidad || 1;
        const cant = !isNaN(parseFloat(cantRaw))
            ? parseFloat(cantRaw).toString().replace('.', ',')
            : cantRaw;
        const textoVence = dias === 0 ? 'Vence hoy' : `Vence el ${formatearFecha(fecha)}`;
        const textoDias = dias < 0
            ? `Vencido hace ${Math.abs(dias)}d`
            : `${dias}d restantes`;
        const estado = item.estado || 'PENDIENTE';

        const elemento = document.createElement('div');
        elemento.className = `venc-item vdb-row ${estado.includes('CARGADO') ? 'vdb-row--done' : ''}`;
        elemento.dataset.id = item.id;
        elemento.dataset.fecha = fecha;
        elemento.dataset.vencido = dias < 0 ? 'true' : 'false';
        if (dias < 0) elemento.style.display = 'none';

        elemento.innerHTML = `
            <div class="vdb-row__left">
                <span class="venc-badge ${etapa.claseCSS}">${etapa.etiqueta}</span>
            </div>
            <div class="vdb-row__info">
                <div class="vdb-row__name">${escaparHTML(item.descripcion || '')}</div>
                <div class="vdb-row__meta">
                    EAN ${escaparHTML(item.ean || 'N/A')} · SEC ${sec} · ${textoVence} · ${textoDias} · Cant: ${cant}
                </div>
            </div>
            <div class="vdb-row__actions">
                <button class="copy-btn" title="Copiar EAN">
                    <div class="copy-icon"></div>
                </button>
                <button class="venc-item__delete" aria-label="Eliminar" data-id="${item.id}">✕</button>
                ${config.labelPrincipal
                ? `<button class="action-btn action-btn--main" data-action="${config.labelPrincipal}">${config.labelPrincipal}</button>`
                : ''}
                ${config.mostrarUM
                ? `<button class="action-btn action-btn--um">UM</button>`
                : ''}
            </div>`;

        elemento.querySelector('.copy-btn').onclick = e => copiarEAN(item.ean || '', e);

        const procesarCarga = async (tipo, label) => {
            const itemFormateado = {
                ...item,
                vencimiento: fecha,
            };
            await ejecutarCargaCompleta(itemFormateado, tipo);
            sumarCargaGamificacion();
        };

        const btnMain = elemento.querySelector('.action-btn--main');
        if (btnMain) btnMain.onclick = () => procesarCarga('PRINCIPAL', config.labelPrincipal);

        if (config.mostrarUM) {
            elemento.querySelector('.action-btn--um').onclick = () => procesarCarga('UM', 'UM');
        }

        elemento.querySelector('.venc-item__delete').onclick = async () => {
            try {
                await eliminarEscaneadoFirestore(item.ean, fecha);
                elemento.remove();
                const restantes = [...contenedor.querySelectorAll('.venc-item')];
                const tieneVisibles = restantes.some(r => r.style.display !== 'none');
                alternarEstadoVacio(elementoVacio, tieneVisibles);
                if (onEliminar) await onEliminar(item);
            } catch (err) {
                console.error('[Eliminar escaneado]:', err);
            }
        };

        contenedor.appendChild(elemento);
    });

    const tieneVisibles = [...contenedor.querySelectorAll('.vdb-row')]
        .some(r => r.style.display !== 'none');
    alternarEstadoVacio(elementoVacio, tieneVisibles);
}

function abrirModal(fondoModal) {
    fondoModal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => fondoModal.querySelector('#f-producto')?.focus(), 50);
}

function cerrarModal(fondoModal, formulario) {
    fondoModal.hidden = true;
    document.body.style.overflow = '';
    formulario?.reset();
}

export async function inicializarVencimientos() {
    const botonAgregar = document.getElementById('add-venc-btn');
    const fondoModal = document.getElementById('modal-backdrop');
    const botonCerrar = document.getElementById('modal-close');
    const botonCancelar = document.getElementById('modal-cancel');
    const botonGuardar = document.getElementById('modal-save');
    const listaVencimientos = document.getElementById('venc-list');
    const elementoVacio = document.getElementById('venc-empty');

    if (!botonAgregar || !fondoModal || !listaVencimientos) return;

    const entradaFecha = document.getElementById('f-fecha');
    if (entradaFecha) entradaFecha.min = new Date().toISOString().split('T')[0];

    async function cargar() {
        const items = await cargarEscaneadosFirestore();
        renderizarItems(listaVencimientos, elementoVacio, items, null);
    }

    const tiendaId = getTiendaId();
    if (tiendaId) {
        await cargar();
    } else {
        window.addEventListener('veteo:login', () => cargar(), { once: true });
    }

    botonAgregar.addEventListener('click', () => abrirModal(fondoModal));

    [botonCerrar, botonCancelar].forEach(btn => {
        btn?.addEventListener('click', () =>
            cerrarModal(fondoModal, document.getElementById('modal-backdrop'))
        );
    });

    fondoModal.addEventListener('click', e => {
        if (e.target === fondoModal) cerrarModal(fondoModal, fondoModal);
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !fondoModal.hidden) cerrarModal(fondoModal, fondoModal);
    });

    botonGuardar?.addEventListener('click', async () => {
        const eanValor = document.getElementById('f-producto')?.value.trim();
        const descValor = document.getElementById('f-descripcion')?.value.trim();
        const secValor = document.getElementById('f-sec')?.value.trim();
        const cantValor = parseFloat(document.getElementById('f-cantidad')?.value) || 0;
        const fechaValor = document.getElementById('f-fecha')?.value;
        const etapaValor = document.getElementById('f-etapa')?.value || 'auto';
        const notaValor = document.getElementById('f-nota')?.value.trim();

        // Validación
        const camposError = [
            !eanValor && 'f-producto',
            !descValor && 'f-descripcion',
            !fechaValor && 'f-fecha',
            !secValor && 'f-sec',
            cantValor <= 0 && 'f-cantidad',
        ].filter(Boolean);

        if (camposError.length) {
            camposError.forEach(id =>
                document.getElementById(id)?.classList.add('field__input--error')
            );
            return;
        }

        try {
            await guardarEscaneadoFirestore({
                sec: secValor,
                ean: eanValor,
                descripcion: descValor,
                cantidad: cantValor,
                fecha_vencimiento: fechaValor,
                nota: notaValor,
                etapa: etapaValor,
            });

            cerrarModal(fondoModal, document.getElementById('venc-form'));
            trackearEvento('ingreso_manual', {
                etapa: etapaValor,
                tiene_ean: eanValor ? 'si' : 'no',
            });

            await cargar();

        } catch (err) {
            console.error('[Guardar escaneado]:', err);
        }
    });

    ['f-producto', 'f-sec', 'f-cantidad'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', e => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    });
}

export async function obtenerEscaneadosParaNotificaciones() {
    return await cargarEscaneadosFirestore();
}