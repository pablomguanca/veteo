import { actualizarTotalEnRiesgo } from './vencimientos-db.js';

function filtrarRows(rows, filtro) {
    if (filtro === 'vencidos') {
        return rows.filter(r => r.dataset.vencido === 'true');
    }

    return rows.filter(r => {
        const esVencido = r.dataset.vencido === 'true';
        if (esVencido) return false;

        if (filtro === 'todos') return true;

        const botones = [...r.querySelectorAll('.venc-row__btn')];
        return botones.some(btn => btn.textContent.trim() === filtro);
    });
}

function aplicarFiltroUI(target, filtro) {
    const contenedorId = 'vdb-list';
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    contenedor.dataset.filtroActivo = filtro;

    const todasLasRows = [...contenedor.querySelectorAll('.venc-row')];
    const visibles = filtrarRows(todasLasRows, filtro);
    const ocultas = todasLasRows.filter(r => !visibles.includes(r));

    visibles.forEach(r => r.style.display = '');
    ocultas.forEach(r => r.style.display = 'none');

    actualizarTotalEnRiesgo();
}

function generarPDF(target) {
    const contenedorId = 'vdb-list';
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    const titulo = 'Próximos a Vencer';
    const fecha = new Date().toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const cssUrl = new URL('/css/pdf.css', window.location.origin).href;

    const rows = [...contenedor.querySelectorAll('.venc-row')]
        .filter(r => r.style.display !== 'none' && r.dataset.sinStock !== 'true');

    const filas = rows.map(row => {
        const meta = row.querySelector('.venc-row__meta')?.textContent || '';
        const desc = row.querySelector('.venc-row__name')?.textContent.trim() || '—';

        const secMatch = meta.match(/SEC\s+(\d+)/);
        const eanMatch = meta.match(/EAN\s+(\d+)/);
        const cantMatch = meta.match(/Cant:\s*([\d,]+)/);

        const sec = secMatch ? secMatch[1] : '—';
        const ean = eanMatch ? eanMatch[1] : '—';
        const cant = cantMatch ? cantMatch[1] : '—';

        const fechaRaw = row.dataset.fecha || '';
        let fechaTexto = '—';

        const isoMatch = fechaRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        const dmaMatch = fechaRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);

        if (isoMatch) {
            fechaTexto = `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
        } else if (dmaMatch) {
            fechaTexto = fechaRaw;
        }

        return `<tr>
            <td>${sec}</td>
            <td>${ean}</td>
            <td>${desc}</td>
            <td>${cant}</td>
            <td>${fechaTexto}</td>
            <td><input type="checkbox"/></td>
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

        <div class="pdf-header__left">
            <img
                src="https://veteo.vercel.app/assets/img/icon-512.png"
                alt="Veteo"
                class="pdf-header__logo"
            />
            <div class="pdf-header__brand">
                Veteo
            </div>
        </div>

        <div class="pdf-header__center">
            <p class="pdf-header__subtitle">
                Listado de vencimientos a controlar
            </p>
        </div>

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
                <th>Controlado</th>
            </tr>
        </thead>

        <tbody>
            ${filas}
        </tbody>

    </table>

    <footer class="pdf-footer">
        <p>Veteo · Prevención de merma en tienda</p>
    </footer>

</body>
</html>`;

    const ventana = window.open('', '_blank');

    if (!ventana) {
        alert('No se pudo abrir la ventana para generar el PDF. Verificá que el navegador no esté bloqueando ventanas emergentes.');
        return;
    }

    ventana.document.write(html);
    ventana.document.close();

    ventana.onload = async () => {
        const imagenes = [...ventana.document.images];

        await Promise.all(
            imagenes.map(img => {
                if (img.complete) {
                    return Promise.resolve();
                }

                return new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            })
        );

        setTimeout(() => {
            ventana.focus();
            ventana.print();
        }, 300);
    };
}

async function generarExcelPCH(target) {
    const contenedorId = 'vdb-list';
    const contenedor = document.getElementById(contenedorId);

    if (!contenedor) return;

    const rows = [...contenedor.querySelectorAll('.venc-row')]
        .filter(r => r.style.display !== 'none' && r.dataset.sinStock !== 'true');

    if (rows.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Lista vacía',
            text: 'No hay productos para exportar.',
            background: '#17191f',
            color: '#fff',
            confirmButtonColor: '#93c5fd'
        });

        return;
    }

    const { value: tienda, isDismissed } = await Swal.fire({
        title: 'Exportar Reporte PCH',
        text: 'Ingresá tu número de sucursal',
        input: 'text',
        inputPlaceholder: 'Ej: 656',
        showCancelButton: true,
        confirmButtonText: 'Exportar Excel',
        cancelButtonText: 'Cancelar',
        background: '#17191f',
        color: '#ffffff',
        confirmButtonColor: '#93c5fd',
        cancelButtonColor: '#4b5563'
    });

    if (isDismissed) return;

    const tiendaFinal = tienda || "";

    const datosExcel = rows.map(row => {
        const meta = row.querySelector('.venc-row__meta')?.textContent || '';

        const eanMatch = meta.match(/EAN\s+(\d+)/);
        const cantMatch = meta.match(/Cant:\s*([\d,]+)/);

        const fechaRaw = row.dataset.fecha || '';
        let fechaTexto = '—';

        const isoMatch = fechaRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        const dmaMatch = fechaRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);

        if (isoMatch) {
            fechaTexto = `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
        } else if (dmaMatch) {
            fechaTexto = fechaRaw;
        }

        return {
            "Tienda": tiendaFinal,
            "Artículo": eanMatch ? eanMatch[1] : '—',
            "Stock a demarcar": cantMatch ? cantMatch[1] : '—',
            "Fecha de vencimiento": fechaTexto
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(datosExcel);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "PCH a demarcar");

    const fechaArmada = new Date()
        .toLocaleDateString('es-AR')
        .replace(/\//g, '-');

    const nombreArchivo =
        `PCH_Sucursal_${tiendaFinal || 'S-N'}_${fechaArmada}.xlsx`;

    XLSX.writeFile(workbook, nombreArchivo);
}

export function inicializarFiltros() {
    [
        {
            toggleId: 'filtros-toggle-vdb',
            barraId: 'filtros-vdb'
        },
    ].forEach(({ toggleId, barraId }) => {
        const btn = document.getElementById(toggleId);
        const barra = document.getElementById(barraId);

        if (!btn || !barra) return;

        btn.addEventListener('click', () => {
            const abierto = !barra.hidden;

            barra.hidden = abierto;

            btn.setAttribute(
                'aria-expanded',
                String(!abierto)
            );

            btn.classList.toggle(
                'filtros-toggle--active',
                !abierto
            );
        });
    });

    document.querySelectorAll('.filtro-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const target = chip.dataset.target;
            const filtro = chip.dataset.filtro;
            if (!filtro) return;
            if (chip.id.includes('print-') || chip.id.includes('excel-')) return;

            const btnExcel = document.getElementById(`excel-${target}-btn`);
            if (btnExcel) {
                btnExcel.style.display = filtro === 'PCH' ? 'inline-flex' : 'none';
            }

            const barraId = `filtros-${target}`;
            const toggleId = `filtros-toggle-${target}`;
            const toggle = document.getElementById(toggleId);

            document.querySelectorAll(`#${barraId} .filtro-chip:not(#print-${target}-btn):not(#excel-${target}-btn)`).forEach(c => {
                c.classList.toggle('filtro-chip--active', c === chip);
            });

            toggle?.classList.toggle('filtros-toggle--active--filtrado', filtro !== 'todos');
            
            aplicarFiltroUI(target, filtro);
        });
    });

    document.getElementById('print-vdb-btn')
        ?.addEventListener('click', () => generarPDF('vdb'));


    document.getElementById('excel-vdb-btn')
        ?.addEventListener('click', () => generarExcelPCH('vdb'));
}