function obtenerDias(fecha) {
    const objetivo = new Date((fecha || '').replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1') + 'T00:00:00');
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const diff = Math.round((objetivo - hoy) / 86400000);
    return isNaN(diff) ? 999 : diff;
}

const REGLAS_FILTRO = {
    PFT: (sec) => [20, 21, 22, 23, 24, 26].includes(sec),
    ACC: (sec, desc) => [10, 34].includes(sec) || desc.toLowerCase().includes('carrefour'),
    PAS: (sec) => sec === 15,
    PCH: (sec) => [11, 14].includes(sec),
    UM: (sec, desc, dias) => [10, 14, 15].includes(sec) && dias >= 3 && dias <= 7,
};

function resolverForm(sec, desc, dias) {
    for (const [form, fn] of Object.entries(REGLAS_FILTRO)) {
        if (fn(sec, desc, dias)) return form;
    }
    return null;
}

function filtrarRows(rows, filtro) {
    if (filtro === 'todos') return rows;
    return rows.filter(row => {
        const meta = row.querySelector('.vdb-row__meta')?.textContent || '';
        const secMatch = meta.match(/SEC\s+(\d+)/);
        const sec = secMatch ? parseInt(secMatch[1]) : 0;
        const desc = row.querySelector('.vdb-row__name')?.textContent || '';
        const diasMatch = meta.match(/(\d+)d restantes/);
        const dias = diasMatch ? parseInt(diasMatch[1]) : 999;
        return resolverForm(sec, desc, dias) === filtro;
    });
}

function aplicarFiltroUI(target, filtro) {
    const contenedorId = target === 'venc' ? 'venc-list' : 'vdb-list';
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    const todasLasRows = [...contenedor.querySelectorAll('.vdb-row')];
    const visibles = filtrarRows(todasLasRows, filtro);
    const ocultas = todasLasRows.filter(r => !visibles.includes(r));

    visibles.forEach(r => r.style.display = '');
    ocultas.forEach(r => r.style.display = 'none');
}

function generarPDF(target) {
    const contenedorId = target === 'venc' ? 'venc-list' : 'vdb-list';
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    const titulo = target === 'venc' ? 'Vencimientos Cargados' : 'Vencimientos Importados';
    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

    const rows = [...contenedor.querySelectorAll('.vdb-row')].filter(r => r.style.display !== 'none');
    const filas = rows.map(row => {
        const nombre = row.querySelector('.vdb-row__name')?.textContent || '';
        const meta = row.querySelector('.vdb-row__meta')?.textContent || '';
        const badge = row.querySelector('.venc-badge')?.textContent || '';
        return `<tr>
            <td>${badge}</td>
            <td>${nombre}</td>
            <td>${meta}</td>
        </tr>`;
    }).join('');

    const html = `
    <!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8"/>
    <title>${titulo} · ${fecha}</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 24px; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        .sub { color: #666; font-size: 10px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f0f0f0; text-align: left; padding: 6px 8px; font-size: 10px; border-bottom: 2px solid #ccc; }
        td { padding: 5px 8px; border-bottom: 1px solid #e8e8e8; vertical-align: top; }
        td:first-child { font-weight: bold; white-space: nowrap; width: 60px; }
        tr:nth-child(even) td { background: #fafafa; }
    </style>
    </head><body>
    <h1>${titulo}</h1>
    <div class="sub">Generado el ${fecha} · Veteo App</div>
    <table>
        <thead><tr><th>Etapa</th><th>Producto</th><th>Detalle</th></tr></thead>
        <tbody>${filas}</tbody>
    </table>
    </body></html>`;

    const ventana = window.open('', '_blank');
    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => ventana.print(), 400);
}

export function inicializarFiltros() {

    [
        { toggleId: 'filtros-toggle-venc', barraId: 'filtros-venc' },
        { toggleId: 'filtros-toggle-vdb', barraId: 'filtros-vdb' },
    ].forEach(({ toggleId, barraId }) => {
        const btn = document.getElementById(toggleId);
        const barra = document.getElementById(barraId);
        if (!btn || !barra) return;

        btn.addEventListener('click', () => {
            const abierto = !barra.hidden;
            barra.hidden = abierto;
            btn.setAttribute('aria-expanded', String(!abierto));
            btn.classList.toggle('filtros-toggle--active', !abierto);
        });
    });

    document.querySelectorAll('.filtro-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const target = chip.dataset.target;
            const filtro = chip.dataset.filtro;
            if (!filtro) return;

            const barraId = target === 'venc' ? 'filtros-venc' : 'filtros-vdb';
            const toggleId = target === 'venc' ? 'filtros-toggle-venc' : 'filtros-toggle-vdb';
            const toggle = document.getElementById(toggleId);

            document.querySelectorAll(`#${barraId} .filtro-chip`).forEach(c => {
                c.classList.toggle('filtro-chip--active', c === chip);
            });

            toggle?.classList.toggle('filtros-toggle--active--filtrado', filtro !== 'todos');

            aplicarFiltroUI(target, filtro);
        });
    });

    document.getElementById('print-venc-btn')?.addEventListener('click', () => generarPDF('venc'));
    document.getElementById('print-vdb-btn')?.addEventListener('click', () => generarPDF('vdb'));
}