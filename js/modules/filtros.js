function filtrarRows(rows, filtro) {
    if (filtro === 'todos') return rows;
    return rows.filter(row => {
        if (filtro === 'PCH') {
            const meta = row.querySelector('.vdb-row__meta')?.textContent || '';
            const secMatch = meta.match(/SEC\s+(\d+)/);
            const sec = secMatch ? parseInt(secMatch[1]) : 0;
            return [11, 14].includes(sec);
        }
        const botones = [...row.querySelectorAll('.action-btn')];
        return botones.some(btn => btn.textContent.trim() === filtro);
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
    const contenedor   = document.getElementById(contenedorId);
    if (!contenedor) return;

    const titulo = target === 'venc' ? 'Vencimientos Cargados' : 'Vencimientos Importados';
    const fecha  = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const cssUrl = new URL('/css/styles.css', window.location.origin).href;

    const rows  = [...contenedor.querySelectorAll('.vdb-row')].filter(r => r.style.display !== 'none');
    const filas = rows.map(row => {
        const meta = row.querySelector('.vdb-row__meta')?.textContent || '';
        const desc = row.querySelector('.vdb-row__name')?.textContent.trim() || '—';

        const secMatch  = meta.match(/SEC\s+(\d+)/);
        const eanMatch  = meta.match(/EAN\s+(\d+)/);
        const cantMatch = meta.match(/Cant:\s*([\d,]+)/);

        const sec  = secMatch  ? secMatch[1]  : '—';
        const ean  = eanMatch  ? eanMatch[1]  : '—';
        const cant = cantMatch ? cantMatch[1] : '—';

        const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        let fechaTexto = hoy;
        if (!meta.includes('Vence hoy')) {
            const fechaMatch = meta.match(/Vence el\s+(.+?)\s+·/);
            if (fechaMatch) {
                const d = new Date(fechaMatch[1]);
                fechaTexto = isNaN(d)
                    ? fechaMatch[1]
                    : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            }
        }

        return `<tr>
            <td>${sec}</td>
            <td>${ean}</td>
            <td>${desc}</td>
            <td>${cant}</td>
            <td>${fechaTexto}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8"/>
    <title>${titulo} · ${fecha}</title>
    <link rel="stylesheet" href="${cssUrl}"/>
</head>
<body class="pdf-body">
    <header class="pdf-header">
        <div class="pdf-header__brand">Veteo App</div>
        <div class="pdf-header__meta">
            ${titulo}<br/>
            Generado el ${fecha}
        </div>
    </header>
    <table class="pdf-table">
        <thead>
            <tr>
                <th>Sección</th>
                <th>EAN</th>
                <th>Descripción</th>
                <th>Unidades a vencer</th>
                <th>Fecha de vencimiento</th>
            </tr>
        </thead>
        <tbody>${filas}</tbody>
    </table>
    <footer class="pdf-footer">
        <p>Desarrollado por Pablo M. Guanca</p>
    </footer>
</body>
</html>`;

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