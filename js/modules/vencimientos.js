import { obtenerUsuarioActual } from './google-auth.js';
import { CONFIGURACION } from './config.js';
import { alternarEstadoVacio } from '../utils/ui.js';
import { copiarEAN } from './vencimientos-db.js';
import { ejecutarCargaCompleta } from './vencimientos-db.js';
import { sumarCargaGamificacion } from './checklist.js';

const CLAVE_ALMACENAMIENTO_VENCIMIENTOS = 'veteo_vencimientos_v1';

const NIVELES_ETAPA = [
    { clave: '-7', etiqueta: '−7d', dias: 7, claseCSS: 'venc-item__badge--7' },
    { clave: '-30', etiqueta: '−30d', dias: 30, claseCSS: 'venc-item__badge--30' },
    { clave: '-60', etiqueta: '−60d', dias: 60, claseCSS: 'venc-item__badge--60' },
    { clave: '-90', etiqueta: '−90d', dias: 90, claseCSS: 'venc-item__badge--90' },
];

function cargarItems() {
    try {
        return JSON.parse(localStorage.getItem(CLAVE_ALMACENAMIENTO_VENCIMIENTOS)) || [];
    } catch {
        return [];
    }
}

function guardarItems(items) {
    localStorage.setItem(CLAVE_ALMACENAMIENTO_VENCIMIENTOS, JSON.stringify(items));
}

function obtenerDiasRestantes(cadenaFecha) {
    const objetivo = new Date(cadenaFecha);
    objetivo.setHours(0, 0, 0, 0);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((objetivo - hoy) / (1000 * 60 * 60 * 24));
}

function resolverEtapa(claveEtapa, cadenaFecha) {
    if (claveEtapa !== 'auto') {
        return NIVELES_ETAPA.find(nivel => nivel.clave === claveEtapa) || NIVELES_ETAPA[0];
    }

    const diasRestantes = obtenerDiasRestantes(cadenaFecha);
    if (diasRestantes <= 7) return NIVELES_ETAPA[0];
    if (diasRestantes <= 30) return NIVELES_ETAPA[1];
    if (diasRestantes <= 60) return NIVELES_ETAPA[2];
    return NIVELES_ETAPA[3];
}

function formatearFecha(cadenaFecha) {
    const fecha = new Date(cadenaFecha + 'T00:00:00');
    return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function obtenerConfiguracionBotones(sec, desc, dias) {
    let labelPrincipal = "";
    const descMinuscula = desc.toLowerCase();
    const esPFT = [20, 21, 22, 23, 24, 26].includes(sec);

    if (esPFT) {
        labelPrincipal = "PFT";
    } else if (descMinuscula.includes("carrefour")) {
        labelPrincipal = "ACC";
    } else if ([10, 34].includes(sec)) {
        labelPrincipal = "ACC";
    } else if (sec === 15) {
        labelPrincipal = "PAS";
    } else if (sec === 14) {
        labelPrincipal = "PCH";
    }

    const mostrarUM = (sec === 14 || sec === 15 || sec === 10) && (dias >= 3 && dias <= 7);

    if (mostrarUM) {
        labelPrincipal = "";
    }

    return { labelPrincipal, mostrarUM };
}

function renderizarItems(contenedor, elementoVacio, items, onEliminar) {
    contenedor.querySelectorAll('.venc-item').forEach(elemento => elemento.remove());

    const itemsFiltradosSectores = items.filter(item => {
        const sec = parseInt(item.sec);
        return ![30, 31, 32, 33].includes(sec);
    });

    const itemsFinales = itemsFiltradosSectores
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    itemsFinales.forEach(item => {
        const sec = parseInt(item.sec);
        const dias = obtenerDiasRestantes(item.fecha);
        const etapa = resolverEtapa(item.etapa, item.fecha);
        const config = obtenerConfiguracionBotones(sec, item.producto, dias);
        const cantRaw = item.cantidad || 1;
        const cant = !isNaN(parseFloat(cantRaw)) ? parseFloat(cantRaw).toString().replace('.', ',') : cantRaw;
        const textoVence = dias === 0 ? 'Vence hoy' : `Vence el ${formatearFecha(item.fecha)}`;
        const textoDias = dias < 0 ? `Vencido hace ${Math.abs(dias)}d` : `${dias}d restantes`;

        const estado = item.estado || 'PENDIENTE';

        const elemento = document.createElement('div');

        elemento.className = `venc-item vdb-row ${estado.includes('CARGADO') ? 'vdb-row--done' : ''}`;

        elemento.dataset.id = item.id;
        elemento.dataset.fecha = item.fecha;
        elemento.dataset.vencido = dias < 0 ? 'true' : 'false';

        if (dias < 0) {
            elemento.style.display = 'none';
        }

        elemento.innerHTML = `
            <div class="vdb-row__left">
                <span class="venc-badge ${etapa.claseCSS}">${etapa.etiqueta}</span>
            </div>
            <div class="vdb-row__info">
                <div class="vdb-row__name">${escaparHTML(item.producto)}</div>
                <div class="vdb-row__meta">
                    EAN ${escaparHTML(item.ean || 'N/A')} · SEC ${sec} · ${textoVence} · ${textoDias} · Cant: ${cant}
                </div>
            </div>
            <div class="vdb-row__actions">
                <button class="copy-btn" title="Copiar EAN">
                    <div class="copy-icon"></div>
                </button>
                <button class="venc-item__delete" aria-label="Eliminar" data-id="${item.id}">✕</button>
                ${config.labelPrincipal ? `<button class="action-btn action-btn--main" data-action="${config.labelPrincipal}">${config.labelPrincipal}</button>` : ''}
                ${config.mostrarUM ? `<button class="action-btn action-btn--um">UM</button>` : ''}
            </div>
        `;

        elemento.querySelector('.copy-btn').onclick = (e) => copiarEAN(item.ean || '', e);

        const procesarCargaManual = (tipo, label) => {
            const itemFormateado = { ...item, descripcion: item.producto, vencimiento: item.fecha };

            ejecutarCargaCompleta(itemFormateado, tipo);

            const todosLosItems = cargarItems();
            const index = todosLosItems.findIndex(i => i.id === item.id);
            if (index !== -1) {
                todosLosItems[index].estado = `CARGADO ${label}`;
                guardarItems(todosLosItems);
                renderizarItems(contenedor, elementoVacio, todosLosItems, onEliminar);
            }

            sumarCargaGamificacion();
        };

        const btnMain = elemento.querySelector('.action-btn--main');
        if (btnMain) {
            btnMain.onclick = () => procesarCargaManual('PRINCIPAL', config.labelPrincipal);
        }

        if (config.mostrarUM) {
            elemento.querySelector('.action-btn--um').onclick = () => procesarCargaManual('UM', 'UM');
        }

        elemento.querySelector('.venc-item__delete').onclick = async () => {
            const itemsActualizados = cargarItems().filter(i => i.id !== item.id);
            guardarItems(itemsActualizados);
            renderizarItems(contenedor, elementoVacio, itemsActualizados, onEliminar);
            if (onEliminar) await onEliminar(item);
        };

        contenedor.appendChild(elemento);
    });

    const tieneVisibles = [...contenedor.querySelectorAll('.vdb-row')].some(r => r.style.display !== 'none');
    alternarEstadoVacio(elementoVacio, tieneVisibles);
}

function escaparHTML(cadena) {
    return String(cadena)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function abrirModal(fondoModal) {
    fondoModal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
        fondoModal.querySelector('#f-producto')?.focus();
    }, 50);
}

function cerrarModal(fondoModal, formulario) {
    fondoModal.hidden = true;
    document.body.style.overflow = '';
    formulario?.reset();
}

export function inicializarVencimientos() {
    const botonAgregar = document.getElementById('add-venc-btn');
    const fondoModal = document.getElementById('modal-backdrop');
    const botonCerrar = document.getElementById('modal-close');
    const botonCancelar = document.getElementById('modal-cancel');
    const botonGuardar = document.getElementById('modal-save');
    const listaVencimientos = document.getElementById('venc-list');
    const elementoVacio = document.getElementById('venc-empty');

    if (!botonAgregar || !fondoModal || !listaVencimientos) return;

    const entradaFecha = document.getElementById('f-fecha');
    if (entradaFecha) {
        entradaFecha.min = new Date().toISOString().split('T')[0];
    }

    renderizarItems(listaVencimientos, elementoVacio, cargarItems(), eliminarVencimientoNube);

    botonAgregar.addEventListener('click', () => abrirModal(fondoModal));

    [botonCerrar, botonCancelar].forEach(boton => {
        boton?.addEventListener('click', () => cerrarModal(fondoModal, document.getElementById('modal-backdrop')));
    });

    fondoModal.addEventListener('click', evento => {
        if (evento.target === fondoModal) cerrarModal(fondoModal, fondoModal);
    });

    document.addEventListener('keydown', evento => {
        if (evento.key === 'Escape' && !fondoModal.hidden) cerrarModal(fondoModal, fondoModal);
    });

    botonGuardar?.addEventListener('click', () => {
        const eanValor = document.getElementById('f-producto')?.value.trim();
        const descValor = document.getElementById('f-descripcion')?.value.trim();
        const secValor = document.getElementById('f-sec')?.value.trim();
        const cantValor = parseFloat(document.getElementById('f-cantidad')?.value) || 0;
        const fechaValor = document.getElementById('f-fecha')?.value;
        const etapaValor = document.getElementById('f-etapa')?.value || 'auto';
        const notaValor = document.getElementById('f-nota')?.value.trim();

        if (!eanValor || !descValor || !fechaValor || !secValor || cantValor <= 0) {
            if (!eanValor) document.getElementById('f-producto')?.classList.add('field__input--error');
            if (!descValor) document.getElementById('f-descripcion')?.classList.add('field__input--error');
            if (!fechaValor) document.getElementById('f-fecha')?.classList.add('field__input--error');
            if (!secValor) document.getElementById('f-sec')?.classList.add('field__input--error');
            if (cantValor <= 0) document.getElementById('f-cantidad')?.classList.add('field__input--error');
            return;
        }

        const nuevoItem = {
            id: `v_${Date.now()}`,
            producto: descValor,
            fecha: fechaValor,
            etapa: etapaValor,
            nota: notaValor,
            createdAt: new Date().toISOString(),
            ean: eanValor,
            descripcion: descValor,
            sec: secValor,
            cantidad: cantValor
        };

        const itemsActuales = cargarItems();
        itemsActuales.push(nuevoItem);
        guardarItems(itemsActuales);
        renderizarItems(listaVencimientos, elementoVacio, itemsActuales, eliminarVencimientoNube);
        cerrarModal(fondoModal, document.getElementById('venc-form'));
        enviarVencimientoNube(nuevoItem);
    });

    ['f-producto', 'f-sec', 'f-cantidad'].forEach(idControl => {
        document.getElementById(idControl)?.addEventListener('input', evento => {
            evento.target.value = evento.target.value.replace(/[^0-9]/g, '');
        });
    });
}

export async function enviarVencimientoNube(datosItem) {
    const usuario = obtenerUsuarioActual();

    if (!usuario) {
        console.error("No se puede guardar en la nube: No hay usuario logueado.");
        return;
    }

    const payload = {
        action: 'saveVencimiento',
        email: usuario.email,
        datos: {
            sec: datosItem.sec || '',
            ean: datosItem.ean || '',
            descripcion: datosItem.producto,
            cantidad: datosItem.cantidad || 1,
            fecha_vencimiento: datosItem.fecha,
            nota: datosItem.nota || '',
        }
    };

    try {
        const respuesta = await fetch(CONFIGURACION.apiUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const resultado = await respuesta.json();

        if (resultado.ok) {
            console.log(`Producto "${datosItem.producto}" guardado en la hoja de ${usuario.email}`);
        } else {
            console.error("Error del script de Google:", resultado.error);
        }
    } catch (error) {
        console.error("Error de red al enviar a Google:", error);
    }
}

export async function eliminarVencimientoNube(datosItem) {
    const usuario = obtenerUsuarioActual();

    if (!usuario) {
        return { success: false, error: 'Usuario no autenticado' };
    }

    const payload = {
        action: 'deleteVencimiento',
        email: usuario.email,
        datos: {
            ean: datosItem?.ean || '',
            fecha_vencimiento: datosItem?.fecha || datosItem?.vencimiento || ''
        }
    };

    try {
        const respuesta = await fetch(CONFIGURACION.apiUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!respuesta.ok) {
            return { success: false, error: `HTTP ${respuesta.status}` };
        }

        const resultado = await respuesta.json();

        if (!resultado.ok) {
            return { success: false, error: resultado.error || 'Error al eliminar' };
        }

        return { success: true };

    } catch (error) {
        return { success: false, error: error?.message || 'Error de red' };
    }
}