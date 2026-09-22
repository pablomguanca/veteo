const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const XLSX = require('xlsx');

function inicializarAdmin() {
    if (getApps().length) return;

    const faltantes = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']
        .filter(nombre => !process.env[nombre]);

    if (faltantes.length) {
        throw new Error(`Faltan variables de entorno en el servidor: ${faltantes.join(', ')}`);
    }

    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

function numeroSeccion(valor) {
    const match = String(valor ?? '').trim().match(/^\D*(\d+)/);
    return match ? match[1] : '';
}

function parsearCosto(valor) {
    if (typeof valor === 'number') return isFinite(valor) ? valor : null;

    const crudo = String(valor ?? '').replace(/[^\d.,-]/g, '').trim();
    if (!crudo) return null;

    const tienePunto = crudo.includes('.');
    const tieneComa = crudo.includes(',');

    const normalizado = tienePunto && tieneComa
        ? crudo.replace(/\./g, '').replace(',', '.')
        : crudo.replace(',', '.');

    const numero = parseFloat(normalizado);
    return isFinite(numero) ? numero : null;
}

function emailsAutorizados() {
    return String(process.env.ADMIN_CATALOGO_EMAILS || '')
        .split(',')
        .map(email => email.trim().toLowerCase())
        .filter(Boolean);
}

async function autorizar(req) {
    const permitidos = emailsAutorizados();
    if (!permitidos.length) {
        return { ok: false, codigo: 503, error: 'La carga de catálogo no está habilitada.' };
    }

    const cabecera = String(req.headers.authorization || '');
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : '';
    if (!token) {
        return { ok: false, codigo: 401, error: 'Iniciá sesión para cargar el catálogo.' };
    }

    let getAuth;
    try {
        ({ getAuth } = require('firebase-admin/auth'));
    } catch (err) {
        throw new Error(
            /ES Module|ERR_REQUIRE_ESM/.test(err?.message || '')
                ? 'El servidor corre una versión de Node anterior a la 22 y firebase-admin/auth no puede cargarse. Subí la versión de Node en Vercel.'
                : `No se pudo cargar la verificación de sesión: ${err?.message || err}`
        );
    }

    let usuario;
    try {
        usuario = await getAuth().verifyIdToken(token);
    } catch {
        return { ok: false, codigo: 401, error: 'Tu sesión expiró. Volvé a iniciar sesión.' };
    }

    const email = String(usuario.email || '').toLowerCase();
    if (!email || !permitidos.includes(email)) {
        return { ok: false, codigo: 403, error: 'Esta cuenta no tiene permiso para cargar el catálogo.' };
    }

    return { ok: true, email };
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    try {
        inicializarAdmin();
        const db = getFirestore();

        const permiso = await autorizar(req);
        if (!permiso.ok) return res.status(permiso.codigo).json({ error: permiso.error });

        const {
            archivoBase64, nombreColumnaEan, nombreColumnaDesc,
            nombreColumnaSec, nombreColumnaCosto,
        } = req.body;

        if (!archivoBase64) {
            return res.status(400).json({ error: 'No se recibió el archivo.' });
        }

        const buffer = Buffer.from(archivoBase64, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(sheet, { defval: null });

        const colEan = nombreColumnaEan || 'EAN';
        const colDesc = nombreColumnaDesc || 'Descripción EAN';
        const colSec = nombreColumnaSec || null;
        const colCosto = nombreColumnaCosto || null;

        const BATCH_SIZE = 490;
        const CONCURRENCIA = 4;
        let procesados = 0;
        let errores = 0;
        const pendientes = [];
        let batch = db.batch();
        let enBatch = 0;

        for (const fila of filas) {
            const eanRaw = fila[colEan];
            const desc = fila[colDesc];

            if (!eanRaw || !desc) continue;

            const ean = String(Math.round(Number(eanRaw)));
            if (ean === 'NaN' || ean.length < 7) continue;

            const datos = {
                descripcion: String(desc).trim(),
                actualizadoEl: new Date().toISOString(),
            };

            if (colSec && fila[colSec]) {
                const seccion = numeroSeccion(fila[colSec]);
                if (seccion) datos.sec = seccion;
            }

            if (colCosto) {
                const costo = parsearCosto(fila[colCosto]);
                if (costo !== null) datos.costo = costo;
            }

            const ref = db.collection('catalogo').doc(ean);
            batch.set(ref, datos, { merge: true });
            enBatch++;
            procesados++;

            if (enBatch >= BATCH_SIZE) {
                pendientes.push(batch);
                batch = db.batch();
                enBatch = 0;
            }
        }

        if (enBatch > 0) pendientes.push(batch);

        for (let i = 0; i < pendientes.length; i += CONCURRENCIA) {
            await Promise.all(
                pendientes.slice(i, i + CONCURRENCIA).map(lote => lote.commit())
            );
        }

        return res.status(200).json({
            ok: true,
            procesados,
            errores,
        });

    } catch (error) {
        console.error('[cargar-catalogo]:', error);
        return res.status(500).json({
            error: `Error interno al cargar el catálogo: ${error?.message || error}`,
        });
    }
};