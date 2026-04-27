import { obtenerUsuarioActual } from './google-auth.js';
import { CONFIGURACION } from './config.js';
import { alternarEstadoVacio } from '../utils/ui.js';

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

function renderizarItems(contenedor, elementoVacio, items) {
    contenedor.querySelectorAll('.venc-item').forEach(elemento => elemento.remove());

    const hayItems = items.length > 0;
    alternarEstadoVacio(elementoVacio, hayItems);

    if (!hayItems) return;

    const itemsFiltrados = items.filter(item => obtenerDiasRestantes(item.fecha) >= 0);
    const itemsOrdenados = itemsFiltrados.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    itemsOrdenados.forEach(item => {
        const etapa = resolverEtapa(item.etapa, item.fecha);
        const diasFaltantes = obtenerDiasRestantes(item.fecha);

        const textoDias = diasFaltantes < 0
            ? `Vencido hace ${Math.abs(diasFaltantes)} días`
            : diasFaltantes === 0
                ? 'Vence hoy'
                : `${diasFaltantes} día${diasFaltantes !== 1 ? 's' : ''} restante${diasFaltantes !== 1 ? 's' : ''}`;

        const elemento = document.createElement('div');
        elemento.className = 'venc-item';
        elemento.setAttribute('role', 'listitem');
        elemento.dataset.id = item.id;

        elemento.innerHTML = `
            <span class="venc-item__badge ${etapa.claseCSS}">${etapa.etiqueta}</span>
            <div class="venc-item__info">
                <div class="venc-item__name">${escaparHTML(item.producto)}</div>
                <div class="venc-item__meta">
                    ${formatearFecha(item.fecha)} · ${textoDias}${item.nota ? ' · ' + escaparHTML(item.nota) : ''}
                </div>
            </div>
            <button class="venc-item__delete" aria-label="Eliminar ${escaparHTML(item.producto)}" data-id="${item.id}">✕</button>
        `;

        contenedor.appendChild(elemento);
    });
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

    renderizarItems(listaVencimientos, elementoVacio, cargarItems());

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
        const cantValor = document.getElementById('f-cantidad')?.value || 1;
        const fechaValor = document.getElementById('f-fecha')?.value;
        const etapaValor = document.getElementById('f-etapa')?.value || 'auto';
        const notaValor = document.getElementById('f-nota')?.value.trim();

        if (!descValor || !fechaValor) {
            if (!descValor) document.getElementById('f-descripcion')?.classList.add('field__input--error');
            if (!fechaValor) document.getElementById('f-fecha')?.classList.add('field__input--error');
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
        renderizarItems(listaVencimientos, elementoVacio, itemsActuales);
        cerrarModal(fondoModal, document.getElementById('venc-form'));
        enviarVencimientoNube(nuevoItem);
    });

    ['f-producto', 'f-fecha'].forEach(idControl => {
        document.getElementById(idControl)?.addEventListener('input', evento => {
            evento.target.classList.remove('field__input--error');
        });
    });

    listaVencimientos.addEventListener('click', evento => {
        const botonEliminar = evento.target.closest('.venc-item__delete');
        if (!botonEliminar) return;
        const identificador = botonEliminar.dataset.id;
        const itemsActualizados = cargarItems().filter(item => item.id !== identificador);
        guardarItems(itemsActualizados);
        renderizarItems(listaVencimientos, elementoVacio, itemsActualizados);
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
        const respuesta = await fetch(CONFIGURACION.urlApiGoogle, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const resultado = await respuesta.json();

        if (resultado.ok) {
            console.log(`✅ Producto "${datosItem.producto}" guardado en la hoja de ${usuario.email}`);
        } else {
            console.error("❌ Error del script de Google:", resultado.error);
        }
    } catch (error) {
        console.error("❌ Error de red al enviar a Google:", error);
    }
}