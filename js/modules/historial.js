import { getFirestoreInstance } from '../firebase/firebase.js';
import { obtenerTiendaId } from './auth.js';
import {
    collection, getDocs, query,
    where, orderBy, Timestamp
} from 'firebase/firestore';

function getLimite(periodo) {
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

    switch (periodo) {
        case 'hoy':
            return Timestamp.fromDate(hoy);
        case 'ayer': {
            const ayer = new Date(hoy);
            ayer.setDate(ayer.getDate() - 1);
            return { desde: Timestamp.fromDate(ayer), hasta: Timestamp.fromDate(hoy) };
        }
        case 'semana': {
            const semana = new Date(hoy);
            semana.setDate(semana.getDate() - 7);
            return Timestamp.fromDate(semana);
        }
        case 'mes': {
            const mes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            return Timestamp.fromDate(mes);
        }
        default:
            return Timestamp.fromDate(hoy);
    }
}

function formatearFechaHora(timestamp) {
    if (!timestamp?.toDate) return '—';
    return timestamp.toDate().toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function estadoBadgeClass(estado) {
    if (!estado) return 'historial-item__badge--pendiente';
    if (estado.includes('CARGADO')) return 'historial-item__badge--cargado';
    return 'historial-item__badge--pendiente';
}

function estadoEtiqueta(estado) {
    if (!estado) return 'Pendiente';
    if (estado === 'CARGADO UM') return 'Cargado UM';
    if (estado.includes('CARGADO')) return 'Cargado';
    return 'Pendiente';
}

async function fetchHistorial(periodo) {
    const tiendaId = obtenerTiendaId();
    if (!tiendaId) return [];

    const db = getFirestoreInstance();
    const ref = collection(db, 'tiendas', tiendaId, 'historial');
    const limite = getLimite(periodo);

    let q;
    if (periodo === 'ayer') {
        q = query(ref,
            where('fechaCarga', '>=', limite.desde),
            where('fechaCarga', '<', limite.hasta),
            orderBy('fechaCarga', 'desc')
        );
    } else {
        q = query(ref,
            where('fechaCarga', '>=', limite),
            orderBy('fechaCarga', 'desc')
        );
    }

    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    return rows;
}

function renderLista(rows) {
    const lista = document.getElementById('historial-lista');
    const vacio = document.getElementById('historial-vacio');

    lista.innerHTML = '';

    if (!rows.length) {
        vacio.hidden = false;
        return;
    }
    vacio.hidden = true;

    rows.forEach(row => {
        const li = document.createElement('li');
        li.className = 'historial-item';
        li.innerHTML = `
            <div class="historial-item__top">
                <span class="historial-item__desc">${row.descripcion || row.ean || '—'}</span>
                <span class="historial-item__badge ${estadoBadgeClass(row.estadoAsignado)}">
                    ${estadoEtiqueta(row.estadoAsignado)}
                </span>
            </div>
            <div class="historial-item__meta">
                <span class="historial-item__fecha">${formatearFechaHora(row.fechaCarga)}</span>
                ${row.operador ? `<span class="historial-item__operador">· ${row.operador}</span>` : ''}
                ${row.vencimiento ? `<span class="historial-item__vto">· VTO ${row.vencimiento}</span>` : ''}
            </div>
        `;
        lista.appendChild(li);
    });
}

async function cargarPeriodo(periodo) {
    const lista = document.getElementById('historial-lista');
    lista.innerHTML = '<li class="historial-item historial-item--loading">Cargando...</li>';
    document.getElementById('historial-vacio').hidden = true;

    const rows = await fetchHistorial(periodo);
    renderLista(rows);
}

export function inicializarHistorial() {
    const btnAbrir = document.getElementById('btn-ver-historial');
    const overlay = document.getElementById('historial-overlay');
    const btnCerrar = document.getElementById('btn-cerrar-historial');
    const tabs = document.querySelectorAll('.historial-tabs__tab');
    const sub = document.getElementById('historial-sub');

    if (!btnAbrir || !overlay) return;

    let periodoActivo = 'hoy';

    btnAbrir.addEventListener('click', async () => {
        const tiendaId = obtenerTiendaId();
        if (sub && tiendaId) sub.textContent = `Tienda ${tiendaId}`;
        overlay.hidden = false;
        document.body.style.overflow = 'hidden';
        await cargarPeriodo(periodoActivo);
    });

    btnCerrar.addEventListener('click', () => {
        overlay.hidden = true;
        document.body.style.overflow = '';
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.hidden = true;
            document.body.style.overflow = '';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.hidden) {
            overlay.hidden = true;
            document.body.style.overflow = '';
        }
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            tabs.forEach(t => t.classList.remove('historial-tabs__tab--active'));
            tab.classList.add('historial-tabs__tab--active');
            periodoActivo = tab.dataset.periodo;
            await cargarPeriodo(periodoActivo);
        });
    });
}