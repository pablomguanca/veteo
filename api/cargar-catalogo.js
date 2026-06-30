const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const XLSX = require('xlsx');

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const db = getFirestore();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    try {
        const { archivoBase64, nombreColumnaEan, nombreColumnaDesc, nombreColumnaSec } = req.body;

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

        const BATCH_SIZE = 490;
        let procesados = 0;
        let errores = 0;
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
                datos.sec = String(fila[colSec]).trim();
            }

            const ref = db.collection('catalogo').doc(ean);
            batch.set(ref, datos, { merge: true });
            enBatch++;
            procesados++;

            if (enBatch >= BATCH_SIZE) {
                await batch.commit();
                batch = db.batch();
                enBatch = 0;
            }
        }

        if (enBatch > 0) await batch.commit();

        return res.status(200).json({
            ok: true,
            procesados,
            errores,
        });

    } catch (error) {
        console.error('[cargar-catalogo]:', error);
        return res.status(500).json({ error: 'Error interno al cargar el catálogo.' });
    }
};