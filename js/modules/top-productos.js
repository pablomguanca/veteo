import { db } from '../firebase/firebase.js';
import {
    collection, getDocs, query,
    where, Timestamp,
} from 'firebase/firestore';

async function fetchTopProductosFirestore() {
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    const tsLimite = Timestamp.fromDate(hace7Dias);

    const tiendasSnap = await getDocs(collection(db, 'tiendas'));
    const conteo = {};

    for (const tiendaDoc of tiendasSnap.docs) {
        const histRef = collection(db, 'tiendas', tiendaDoc.id, 'historial');
        const q = query(histRef, where('fechaCarga', '>=', tsLimite));
        const snap = await getDocs(q);

        snap.forEach(d => {
            const { ean, descripcion, sec } = d.data();
            if (!ean) return;
            if (!conteo[ean]) conteo[ean] = { ean, desc: descripcion, sec, total: 0 };
            conteo[ean].total++;
        });
    }

    return Object.values(conteo)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
}

function renderizarTop(datos) {
    const contenedor = document.getElementById('top-list');
    const elementoVacio = document.getElementById('top-empty');
    const elementoFecha = document.getElementById('top-fecha');
    if (!contenedor) return;

    if (elementoFecha) {
        const hoy = new Date();
        const hace7 = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fmt = d => d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
        elementoFecha.textContent = `${fmt(hace7)} - ${fmt(hoy)}`;
    }

    contenedor.querySelectorAll('.top-item').forEach(el => el.remove());

    if (!datos?.length) {
        if (elementoVacio) elementoVacio.hidden = false;
        return;
    }
    if (elementoVacio) elementoVacio.hidden = true;

    datos.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = 'top-item';
        el.innerHTML = `
            <span class="top-item__rank">#${i + 1}</span>
            <div class="top-item__info">
                <div class="top-item__desc">${item.desc || '—'}</div>
                <div class="top-item__meta">EAN ${item.ean} · SEC ${item.sec || '—'}</div>
            </div>
            <span class="top-item__total">
                ${item.total} carga${item.total !== 1 ? 's' : ''}
            </span>`;
        contenedor.appendChild(el);
    });
}

export async function inicializarTopProductos() {
    const contenedor = document.getElementById('top-list');
    if (!contenedor) return;

    try {
        const datos = await fetchTopProductosFirestore();
        renderizarTop(datos);
    } catch (err) {
        console.error('[Top Productos]:', err);
    }
}