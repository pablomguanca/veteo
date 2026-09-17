import { guardarEscaneadoFirestore } from './vencimientos-db.js';
import { trackearEvento } from './analytics.js';
import { getFirestoreInstance } from '../firebase/firebase.js';
import { collection, getDocs } from 'firebase/firestore';
import { obtenerTiendaId as getTiendaId } from './auth.js';

async function cargarEscaneadosFirestore() {
    const tiendaId = getTiendaId();
    if (!tiendaId) return [];

    const ref = collection(getFirestoreInstance(), 'tiendas', tiendaId, 'escaneados');
    const snap = await getDocs(ref);
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    return items;
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
    const formulario = document.getElementById('venc-form');

    if (!botonAgregar || !fondoModal) return;

    const entradaFecha = document.getElementById('f-fecha');
    if (entradaFecha) entradaFecha.min = new Date().toISOString().split('T')[0];

    botonAgregar.addEventListener('click', () => abrirModal(fondoModal));

    [botonCerrar, botonCancelar].forEach(btn => {
        btn?.addEventListener('click', () => cerrarModal(fondoModal, formulario));
    });

    fondoModal.addEventListener('click', e => {
        if (e.target === fondoModal) cerrarModal(fondoModal, formulario);
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !fondoModal.hidden) cerrarModal(fondoModal, formulario);
    });

    botonGuardar?.addEventListener('click', async () => {
        const eanValor = document.getElementById('f-producto')?.value.trim();
        const descValor = document.getElementById('f-descripcion')?.value.trim();
        const secValor = document.getElementById('f-sec')?.value.trim();
        const cantValor = parseFloat(document.getElementById('f-cantidad')?.value) || 0;
        const fechaValor = document.getElementById('f-fecha')?.value;
        const notaValor = document.getElementById('f-nota')?.value.trim();

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
            });

            cerrarModal(fondoModal, formulario);
            trackearEvento('ingreso_manual', {
                tiene_ean: eanValor ? 'si' : 'no',
            });

            window.dispatchEvent(new CustomEvent('veteo:refrescarVencimientos'));

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
