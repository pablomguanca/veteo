import { alternarEstadoVacio } from '../utils/ui.js';
import { obtenerUsuarioActual } from './google-auth.js';
import { CONFIGURACION } from './config.js';

const ESTADOS_DISPONIBLES = ['PENDIENTE', 'CARGADO', 'DEPRECIADO'];

const CLASES_ESTADO = {
    PENDIENTE: 'estado--pendiente',
    CARGADO: 'estado--cargado',
    DEPRECIADO: 'estado--depreciado',
};

let productosEnMemoria = [];

export function obtenerProductosEnMemoria() {
    return productosEnMemoria;
}

function parsearTxt(contenido) {
    const filas = [];
    for (const linea of contenido.split('\n')) {
        const limpia = linea.trim();
        if (!/^\*\s+\d+/.test(limpia)) continue;

        const interior = limpia.replace(/^\*\s*/, '').replace(/\s*\*$/, '').trim();
        const partes = interior.split(/\s+/);

        if (partes.length < 7) continue;
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(partes[partes.length - 1])) continue;

        filas.push({
            po: partes[0],
            sec: partes[1],
            ean: partes[2],
            vencimiento: partes[partes.length - 1],
            cantidad: partes[partes.length - 2],
            stock: partes[partes.length - 3],
            descripcion: partes.slice(3, partes.length - 3).join(' '),
        });
    }
    return filas;
}

function parsearFecha(cadenaFecha) {
    if (!cadenaFecha) return null;
    const limpia = String(cadenaFecha).trim();

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(limpia)) {
        const [dia, mes, anio] = limpia.split('/');
        return new Date(`${anio}-${mes}-${dia}T00:00:00`);
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(limpia)) {
        return new Date(limpia.split('T')[0] + 'T00:00:00');
    }
    const fecha = new Date(limpia);
    return isNaN(fecha) ? null : fecha;
}

function obtenerDiasRestantes(cadenaFecha) {
    const objetivo = parsearFecha(cadenaFecha);
    if (!objetivo) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((objetivo - hoy) / (1000 * 60 * 60 * 24));
}

function obtenerEtapa(diasRestantes) {
    if (diasRestantes === null) return { etiqueta: '?', claseCSS: 'etapa--unknown' };
    const etiqueta = diasRestantes < 0 ? `+${Math.abs(diasRestantes)}d` : `-${diasRestantes}d`;
    if (diasRestantes <= 7) return { etiqueta, claseCSS: 'etapa--7' };
    if (diasRestantes <= 30) return { etiqueta, claseCSS: 'etapa--30' };
    if (diasRestantes <= 60) return { etiqueta, claseCSS: 'etapa--60' };
    return { etiqueta, claseCSS: 'etapa--90' };
}

function formatearFecha(cadenaFecha) {
    const fecha = parsearFecha(cadenaFecha);
    if (!fecha) return cadenaFecha;
    return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function apiObtenerTodo(usuario) {
    const parametros = new URLSearchParams({ action: 'getAll', email: usuario.email });
    const respuesta = await fetch(`${CONFIGURACION.apiUrl}?${parametros.toString()}`);
    return respuesta.json();
}

async function apiConfigurarHoja(usuario) {
    const respuesta = await fetch(CONFIGURACION.apiUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'setupSheet', email: usuario.email }),
    });
    return respuesta.json();
}

async function apiImportarTxt(filas, usuario) {
    const respuesta = await fetch(CONFIGURACION.apiUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'importTxt', rows: filas, email: usuario.email }),
    });
    return respuesta.json();
}

async function apiActualizarEstado(ean, vencimiento, estado, usuario) {
    const respuesta = await fetch(CONFIGURACION.apiUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'updateEstado', ean, vencimiento, estado, email: usuario.email }),
    });
    return respuesta.json();
}

function escaparHTML(cadena) {
    return String(cadena ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderizarTabla(contenedor, elementoVacio, filas) {
    contenedor.querySelectorAll('.vdb-row').forEach(elemento => elemento.remove());
    const hayFilas = filas?.length > 0;
    alternarEstadoVacio(elementoVacio, hayFilas);
    if (!hayFilas) return;

    const filasOrdenadas = [...filas].sort((a, b) => obtenerDiasRestantes(a.VENCIMIENTO) - obtenerDiasRestantes(b.VENCIMIENTO));

    filasOrdenadas.forEach(item => {
        const diasRestantes = obtenerDiasRestantes(item.VENCIMIENTO);
        const etapa = obtenerEtapa(diasRestantes);
        const estadoActual = item.ESTADO || 'PENDIENTE';
        const textoDias = diasRestantes === null ? '—'
            : diasRestantes < 0 ? `Vencido hace ${Math.abs(diasRestantes)}d`
                : diasRestantes === 0 ? 'Vence hoy'
                    : `${diasRestantes}d restantes`;

        const elemento = document.createElement('div');
        elemento.className = 'vdb-row';
        elemento.dataset.ean = item.EAN;
        elemento.dataset.vencimiento = item.VENCIMIENTO;

        elemento.innerHTML = `
            <div class="vdb-row__left">
                <span class="venc-badge ${etapa.claseCSS}">${etapa.etiqueta}</span>
            </div>
            <div class="vdb-row__info">
                <div class="vdb-row__name">${escaparHTML(item.DESCRIPCION)}</div>
                <div class="vdb-row__meta">
                    EAN ${escaparHTML(item.EAN)} · SEC ${escaparHTML(item.SEC)} ·
                    ${formatearFecha(item.VENCIMIENTO)} · ${textoDias} ·
                    Cant: ${escaparHTML(String(item.CANTIDAD))}
                </div>
            </div>
            <div class="vdb-row__right">
                <button class="estado-btn ${CLASES_ESTADO[estadoActual]}"
                    data-ean="${escaparHTML(item.EAN)}"
                    data-vencimiento="${escaparHTML(item.VENCIMIENTO)}">
                    ${estadoActual}
                </button>
            </div>
        `;
        contenedor.appendChild(elemento);
    });
}

function establecerCargando(boton, texto) { boton.disabled = true; boton.textContent = texto; }
function restablecerBoton(boton, texto) { boton.disabled = false; boton.textContent = texto; }

export async function inicializarBaseDatosVencimientos() {
    const seccionDb = document.getElementById('vdb-section');
    const entradaArchivo = document.getElementById('vdb-file-input');
    const botonImportar = document.getElementById('vdb-import-btn');
    const botonRefrescar = document.getElementById('vdb-refresh-btn');
    const contenedorLista = document.getElementById('vdb-list');
    const elementoVacio = document.getElementById('vdb-empty');
    const elementoEstado = document.getElementById('vdb-status');

    if (!seccionDb || !contenedorLista) return;

    function actualizarBotonImportar() {
        if (!botonImportar) return;
        const estaLogueado = !!obtenerUsuarioActual();
        botonImportar.disabled = !estaLogueado;
        botonImportar.title = estaLogueado
            ? 'Importar archivo TXT de vencimientos'
            : 'Iniciá sesión con Google para importar';
    }

    async function cargarDatos() {
        const usuario = obtenerUsuarioActual();
        if (!usuario) {
            renderizarTabla(contenedorLista, elementoVacio, []);
            if (elementoEstado) elementoEstado.textContent = 'Iniciá sesión con Google para ver o importar tus vencimientos.';
            return;
        }

        if (elementoEstado) elementoEstado.textContent = 'Conectando con tu base de datos…';

        try {
            const datosApi = await apiObtenerTodo(usuario);

            if (datosApi.needsSetup) {
                if (elementoEstado) elementoEstado.textContent = 'Primera vez — creando tu base de datos corporativa…';

                const registro = await apiConfigurarHoja(usuario);

                if (!registro.ok) throw new Error(registro.error || 'No se pudo registrar la hoja.');

                if (elementoEstado) elementoEstado.textContent = `Hoja creada y compartida con ${usuario.email}`;
                renderizarTabla(contenedorLista, elementoVacio, productosEnMemoria);
                return;
            }

            const filasDesdeHoja = datosApi.rows || [];

            if (filasDesdeHoja.length > 0) {
                productosEnMemoria = filasDesdeHoja;
                renderizarTabla(contenedorLista, elementoVacio, productosEnMemoria);

                if (elementoEstado) elementoEstado.textContent = construirEstado(usuario);

                window.dispatchEvent(new CustomEvent('veteo:productosActualizados', { detail: productosEnMemoria }));
            } else {
                renderizarTabla(contenedorLista, elementoVacio, productosEnMemoria);
                if (elementoEstado) elementoEstado.textContent = productosEnMemoria.length
                    ? construirEstado(usuario)
                    : `Sin productos cargados · ${usuario.email}`;
            }
        } catch (error) {
            console.error('[Veteo]', error);
            if (elementoEstado) elementoEstado.textContent = `Error: ${error.message || 'No se pudo conectar con la base de datos.'}`;
        }
    }

    function construirEstado(usuario) {
        const productosVigentes = productosEnMemoria.filter(item => {
            const dias = obtenerDiasRestantes(item.VENCIMIENTO);
            return dias !== null && dias >= 0;
        });
        return `${productosVigentes.length} producto${productosVigentes.length !== 1 ? 's' : ''} vigente${productosVigentes.length !== 1 ? 's' : ''} en memoria · ${usuario.email}`;
    }

    function iniciarFiltradoAutomatico() {
        setInterval(() => {
            const usuario = obtenerUsuarioActual();
            if (!productosEnMemoria.length) return;
            const cantidadPrevia = productosEnMemoria.length;
            productosEnMemoria = productosEnMemoria.filter(item => {
                const dias = obtenerDiasRestantes(item.VENCIMIENTO);
                return dias !== null && dias >= 0;
            });
            if (productosEnMemoria.length < cantidadPrevia) {
                renderizarTabla(contenedorLista, elementoVacio, productosEnMemoria);
                if (elementoEstado && usuario) elementoEstado.textContent = construirEstado(usuario);
                window.dispatchEvent(new CustomEvent('veteo:productosActualizados', { detail: productosEnMemoria }));
            }
        }, 60 * 1000);
    }

    botonImportar?.addEventListener('click', () => {
        const usuario = obtenerUsuarioActual();
        if (!usuario) {
            if (elementoEstado) elementoEstado.textContent = 'Iniciá sesión con Google para importar el archivo.';
            document.getElementById('google-btn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        entradaArchivo?.click();
    });

    entradaArchivo?.addEventListener('change', async () => {
        const usuario = obtenerUsuarioActual();
        if (!usuario) {
            if (elementoEstado) elementoEstado.textContent = 'Iniciá sesión con Google para importar el archivo.';
            entradaArchivo.value = '';
            return;
        }

        const archivo = entradaArchivo.files[0];
        if (!archivo) return;

        establecerCargando(botonImportar, 'Procesando…');
        if (elementoEstado) elementoEstado.textContent = 'Leyendo archivo…';

        const lector = new FileReader();
        lector.onload = async (evento) => {
            const filas = parsearTxt(evento.target.result);

            if (filas.length === 0) {
                if (elementoEstado) elementoEstado.textContent = 'No se encontraron productos en el archivo.';
                restablecerBoton(botonImportar, '↑ Importar TXT');
                entradaArchivo.value = '';
                return;
            }

            if (elementoEstado) elementoEstado.textContent = `${filas.length} productos encontrados. Enviando al Sheet de ${usuario.email}…`;

            try {
                const resultado = await apiImportarTxt(filas, usuario);
                if (resultado.ok) {
                    if (elementoEstado) elementoEstado.textContent = `✓ ${resultado.imported || filas.length} productos importados. Sincronizando…`;
                    await cargarDatos();
                } else {
                    if (elementoEstado) elementoEstado.textContent = `Error: ${resultado.error || 'No se pudo importar el archivo.'}`;
                }
            } catch {
                if (elementoEstado) elementoEstado.textContent = 'Error al conectar con el servidor.';
            }

            restablecerBoton(botonImportar, '↑ Importar TXT');
            entradaArchivo.value = '';
        };
        lector.readAsText(archivo);
    });

    botonRefrescar?.addEventListener('click', cargarDatos);

    contenedorLista.addEventListener('click', async (evento) => {
        const botonEstado = evento.target.closest('.estado-btn');
        if (!botonEstado) return;

        const usuario = obtenerUsuarioActual();
        if (!usuario) {
            if (elementoEstado) elementoEstado.textContent = 'Iniciá sesión con Google para modificar estados.';
            return;
        }

        const codigoEan = botonEstado.dataset.ean;
        const fechaVencimiento = botonEstado.dataset.vencimiento;
        const estadoActual = botonEstado.textContent.trim();
        const siguienteEstado = ESTADOS_DISPONIBLES[(ESTADOS_DISPONIBLES.indexOf(estadoActual) + 1) % ESTADOS_DISPONIBLES.length];

        botonEstado.textContent = '…';
        botonEstado.disabled = true;

        try {
            const resultado = await apiActualizarEstado(codigoEan, fechaVencimiento, siguienteEstado, usuario);
            if (resultado.ok) {
                const item = productosEnMemoria.find(
                    producto => String(producto.EAN) === String(codigoEan) && String(producto.VENCIMIENTO) === String(fechaVencimiento)
                );
                if (item) item.ESTADO = siguienteEstado;
                botonEstado.textContent = siguienteEstado;
                botonEstado.className = `estado-btn ${CLASES_ESTADO[siguienteEstado]}`;
            } else {
                botonEstado.textContent = estadoActual;
            }
        } catch {
            botonEstado.textContent = estadoActual;
        }
        botonEstado.disabled = false;
    });

    actualizarBotonImportar();

    const usuarioActual = obtenerUsuarioActual();
    if (usuarioActual) {
        await cargarDatos();
    } else {
        renderizarTabla(contenedorLista, elementoVacio, []);
        if (elementoEstado) elementoEstado.textContent = 'Iniciá sesión con Google para ver o importar tus vencimientos.';
        window.addEventListener('veteo:login', async () => {
            actualizarBotonImportar();
            await cargarDatos();
        }, { once: true });
    }

    iniciarFiltradoAutomatico();
}