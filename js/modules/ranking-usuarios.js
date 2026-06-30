import { getFirestoreInstance } from '../firebase/firebase.js';
import { obtenerTiendaId } from './auth.js';
import { actualizarPosicionGamificacion } from './checklist.js';
import {
    collection, getDocs, query,
    where, Timestamp,
} from 'firebase/firestore';

async function fetchRankingFirestore() {
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    const tsLimite = Timestamp.fromDate(hace7Dias);
    const tiendasSnap = await getDocs(collection(getFirestoreInstance(), 'tiendas'));
    const ranking = [];

    for (const tiendaDoc of tiendasSnap.docs) {
        const tiendaId = tiendaDoc.id;
        const nombreTienda = tiendaDoc.data().nombre || `Tienda ${tiendaId}`;

        const histRef = collection(getFirestoreInstance(), 'tiendas', tiendaId, 'historial');
        const q = query(histRef, where('fechaCarga', '>=', tsLimite));
        const snap = await getDocs(q);

        if (snap.size > 0) {
            ranking.push({
                tiendaId,
                nombre: nombreTienda,
                cargas: snap.size,
            });
        }
    }

    return ranking.sort((a, b) => b.cargas - a.cargas);
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
        elementoFecha.textContent = `${fmt(hace7)} → ${fmt(hoy)}`;
    }

    contenedor.querySelectorAll('.ranking-item').forEach(el => el.remove());

    if (!datos?.length) {
        if (elementoVacio) elementoVacio.hidden = false;
        return;
    }
    if (elementoVacio) elementoVacio.hidden = true;

    const miTiendaId = obtenerTiendaId();
    const miPosicionEl = document.getElementById('ranking-mi-posicion');
    const miPosEl = document.getElementById('ranking-mi-pos');
    const miCargasEl = document.getElementById('ranking-mi-cargas');

    if (miTiendaId && miPosicionEl) {
        const miIndex = datos.findIndex(t => t.tiendaId === miTiendaId);
        const posicion = miIndex !== -1 ? miIndex + 1 : '-';
        actualizarPosicionGamificacion(posicion);
        const estaEnTop10 = miIndex !== -1 && miIndex < 10;

        if (!estaEnTop10 && miIndex !== -1) {
            miPosEl.textContent = `#${miIndex + 1}`;
            miCargasEl.textContent = `${datos[miIndex].cargas} carga${datos[miIndex].cargas !== 1 ? 's' : ''}`;
            miPosicionEl.hidden = false;
        } else {
            miPosicionEl.hidden = true;
        }
    }

    datos.slice(0, 10).forEach((tienda, i) => {
        const esTop = i === 0;
        const el = document.createElement('div');
        el.className = `ranking-item${esTop ? ' ranking-item--top' : ''}`;

        const iniciales = tienda.nombre
            .split(' ')
            .slice(0, 2)
            .map(p => p[0])
            .join('')
            .toUpperCase();

        el.innerHTML = `
            <span class="ranking-item__pos">#${i + 1}</span>
            <div class="ranking-item__avatar${esTop ? ' ranking-item__avatar--top' : ''}">
                <span>${iniciales}</span>
            </div>
            <div class="ranking-item__info">
                <p class="ranking-item__nombre${esTop ? ' ranking-item__nombre--top' : ''}">
                    ${esTop ? `<svg class="ranking-item__trofeo" xmlns="http://www.w3.org/2000/svg"
                        width="14" height="14" viewBox="0 0 24 24" fill="#fcd34d" stroke="none">
                        <path d="M12 15.5c-2.76 0-5-2.24-5-5V4h10v6.5c0 2.76-2.24 5-5 5zm0 1.5c1.1 0 2 .9 2 2v1H10v-1c0-1.1.9-2 2-2zm-4 3h8v1H8v-1zM5 4H3v3c0 1.66 1.34 3 3 3V8c-.55 0-1-.45-1-1V4zm16 0h-2v4c0 .55-.45 1-1 1v2c1.66 0 3-1.34 3-3V4z"/></svg>` : ''}
                    ${tienda.nombre}
                </p>
                <p class="ranking-item__email">Tienda ${tienda.tiendaId}</p>
            </div>
            <span class="ranking-item__cargas">
                ${tienda.cargas} carga${tienda.cargas !== 1 ? 's' : ''}
            </span>`;

        contenedor.appendChild(el);
    });
}

export async function inicializarRankingUsuarios() {
    const contenedor = document.getElementById('ranking-list');
    if (!contenedor) return;

    try {
        const datos = await fetchRankingFirestore();
        renderizarRanking(datos);
    } catch (err) {
        console.error('[Ranking]:', err);
    }
}