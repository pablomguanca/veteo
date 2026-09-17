import { ENLACES_APP } from './enlaces.js';
import { obtenerTiendaId } from './auth.js';

export const FORMULARIOS = {
    PAS: {
        etiqueta: 'PAS',
        url: ENLACES_APP.formPas,
        campos: {
            sucursal: 'entry.922396326',
            ean: 'entry.1279354663',
            cantidad: 'entry.359875461',
            vencimiento: 'entry.1345342868',
        },
    },

    S10: {
        etiqueta: 'ACC',
        url: ENLACES_APP.accEspeciales,
        campos: {
            sucursal: 'entry.500586059',
            ean: 'entry.1275730876',
            cantidad: 'entry.75008582',
            vencimiento: 'entry.526084943',
        },
    },

    UM: {
        etiqueta: 'UM',
        url: ENLACES_APP.ultimaMilla,
        campos: {
            sucursal: 'entry.899659779',
            ean: 'entry.140972296',
            descripcion: 'entry.315963851',
            cantidad: 'entry.1129022501',
            vencimiento: 'entry.43131729',
            lote: 'entry.646240165',
        },
    },

    PFT: { etiqueta: 'PFT', url: ENLACES_APP.formPft, campos: {} },
    PCH: { etiqueta: 'PCH', url: ENLACES_APP.pch, campos: {} },
};

const REGLAS = [
    { destino: 'PCH', secciones: [20], diasDesde: 3, diasHasta: 7 },
    { destino: 'PFT', secciones: [20, 21, 22, 23, 24, 26] },
    { destino: 'S10', contiene: ['carrefour', 'bulnez'] },
    { destino: 'S10', secciones: [10, 34] },
    { destino: 'PAS', secciones: [15] },
    { destino: 'PCH', secciones: [11, 14] },
];

const REGLA_UM = { secciones: [10, 14, 15], diasDesde: 3, diasHasta: 7 };

function cumple(regla, { sec, descripcion, dias }) {
    if (regla.secciones && !regla.secciones.includes(sec)) return false;
    if (regla.contiene) {
        const texto = descripcion.toLowerCase();
        if (!regla.contiene.some(palabra => texto.includes(palabra))) return false;
    }
    if (regla.diasDesde !== undefined && !(dias >= regla.diasDesde)) return false;
    if (regla.diasHasta !== undefined && !(dias <= regla.diasHasta)) return false;
    return true;
}

export function resolverAcciones(item) {
    const datos = normalizarItem(item);
    const contexto = {
        sec: parseInt(datos.sec, 10),
        descripcion: datos.descripcion,
        dias: diasHastaVencimiento(datos.vencimiento),
    };

    const mostrarUM = cumple(REGLA_UM, contexto);
    const principal = mostrarUM
        ? ''
        : REGLAS.find(regla => cumple(regla, contexto))?.destino || '';

    return {
        principal,
        etiquetaPrincipal: FORMULARIOS[principal]?.etiqueta || '',
        mostrarUM,
    };
}

export function normalizarFecha(valor) {
    const cadena = String(valor || '').trim();
    if (!cadena) return '';

    const barras = cadena.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (barras) return `${barras[3]}-${barras[2]}-${barras[1]}`;

    const guiones = cadena.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (guiones) return `${guiones[1]}-${guiones[2]}-${guiones[3]}`;

    return '';
}

export function formatearCantidad(valor) {
    const crudo = String(valor ?? '').trim();
    if (!crudo) return '';
    const numero = parseFloat(crudo.replace(',', '.'));
    if (!isFinite(numero)) return crudo;
    return String(numero).replace('.', ',');
}

export function loteDesdeFecha(fechaNormalizada) {
    const partes = String(fechaNormalizada || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return partes ? `${partes[3]}${partes[2]}${partes[1]}` : '';
}

export function diasHastaVencimiento(fechaNormalizada) {
    if (!fechaNormalizada) return null;
    const objetivo = new Date(`${fechaNormalizada}T00:00:00`);
    if (isNaN(objetivo)) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((objetivo - hoy) / (1000 * 60 * 60 * 24));
}

export function normalizarItem(item = {}) {
    const vencimiento = normalizarFecha(
        item.vencimiento || item.VENCIMIENTO || item.fechaVencimiento
    );

    return {
        sucursal: String(obtenerTiendaId() || '').trim(),
        ean: String(item.ean || item.EAN || '').trim(),
        sec: String(item.sec || item.SEC || '').trim(),
        descripcion: String(item.descripcion || item.DESCRIPCION || '').trim(),
        cantidad: formatearCantidad(item.cantidad ?? item.CANTIDAD),
        stock: String(item.stock ?? '').trim(),
        po: String(item.po || '').trim(),
        nota: String(item.nota || '').trim(),
        vencimiento,
        lote: loteDesdeFecha(vencimiento),
    };
}

export function construirUrlFormulario(clave, item) {
    const formulario = FORMULARIOS[clave];
    if (!formulario?.url) return '';

    const campos = formulario.campos || {};
    const datos = normalizarItem(item);

    const parametros = new URLSearchParams();
    for (const [dato, idCampo] of Object.entries(campos)) {
        const valor = datos[dato];
        if (valor) parametros.set(idCampo, valor);
    }

    if (![...parametros].length) return formulario.url;

    const separador = formulario.url.includes('?') ? '&' : '?';
    return `${formulario.url}${separador}usp=pp_url&${parametros}`;
}
