import { CONFIGURACION } from './config.js';

async function fetchTopProductos() {
    const params = new URLSearchParams({ action: 'getTopProductos' });
    const res = await fetch(`${CONFIGURACION.apiUrl}?${params}`, {
        method: 'GET',
        redirect: 'follow'
    });
    return res.json();
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
                <div class="top-item__desc">${item.desc}</div>
                <div class="top-item__meta">EAN ${item.ean} · SEC ${item.sec}</div>
            </div>
            <span class="top-item__total">${item.total} carga${item.total !== 1 ? 's' : ''}</span>
        `;
        contenedor.appendChild(el);
    });
}

export async function inicializarTopProductos() {
    const contenedor = document.getElementById('top-list');
    if (!contenedor) return;

    try {
        const datos = await fetchTopProductos();
        if (datos.ok) renderizarTop(datos.top);
    } catch (err) {
        console.error('[Top Productos]:', err);
    }
}