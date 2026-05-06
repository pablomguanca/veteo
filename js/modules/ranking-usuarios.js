import { CONFIGURACION } from './config.js';

async function fetchRanking() {
    const params = new URLSearchParams({ action: 'getTopUsuarios' });
    const res = await fetch(`${CONFIGURACION.apiUrl}?${params}`, {
        method: 'GET',
        redirect: 'follow'
    });
    return res.json();
}

function renderizarRanking(datos) {
    const contenedor = document.getElementById('ranking-list');
    const elementoVacio = document.getElementById('ranking-empty');
    const elementoFecha = document.getElementById('ranking-fecha');
    if (!contenedor) return;

    if (elementoFecha) {
        const hoy = new Date();
        const hace7 = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fmt = d => d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
        elementoFecha.textContent = `${fmt(hace7)} - ${fmt(hoy)}`;
    }

    contenedor.querySelectorAll('.ranking-item').forEach(el => el.remove());

    if (!datos?.length) {
        if (elementoVacio) elementoVacio.hidden = false;
        return;
    }

    if (elementoVacio) elementoVacio.hidden = true;

    datos.forEach((usuario, i) => {
        const esTop = i === 0;
        const el = document.createElement('div');
        el.className = `ranking-item${esTop ? ' ranking-item--top' : ''}`;

        const iniciales = usuario.nombre
            .split(' ')
            .slice(0, 2)
            .map(p => p[0])
            .join('')
            .toUpperCase();

        el.innerHTML = `
            <span class="ranking-item__pos">#${i + 1}</span>
            <div class="ranking-item__avatar${esTop ? ' ranking-item__avatar--top' : ''}">
                ${usuario.foto
                ? `<img src="${usuario.foto}" alt="${usuario.nombre}" />`
                : `<span>${iniciales}</span>`
            }
            </div>
            <div class="ranking-item__info">
                <p class="ranking-item__nombre${esTop ? ' ranking-item__nombre--top' : ''}">${usuario.nombre}</p>
                <p class="ranking-item__email">${usuario.email}</p>
            </div>
            <span class="ranking-item__cargas">${usuario.cargas} carga${usuario.cargas !== 1 ? 's' : ''}</span>
        `;
        contenedor.appendChild(el);
    });
}

export async function inicializarRankingUsuarios() {
    const contenedor = document.getElementById('ranking-list');
    if (!contenedor) return;

    try {
        const datos = await fetchRanking();
        if (datos.ok) renderizarRanking(datos.top);
    } catch (err) {
        console.error('[Ranking Usuarios]:', err);
    }
}