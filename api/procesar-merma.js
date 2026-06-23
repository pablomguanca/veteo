const XLSX = require('xlsx');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    try {
        const { archivos } = req.body;

        if (!archivos || !Array.isArray(archivos) || archivos.length === 0) {
            return res.status(400).json({ error: 'No se recibieron archivos para procesar.' });
        }

        const regexFilaValida = /^\s*(\d{2}\/\d{2}\/\d{2})/;
        const mapaMaestro = new Map();

        archivos.forEach(archivo => {
            const lineas = archivo.contenido.split('\n');

            lineas.forEach(linea => {
                if (regexFilaValida.test(linea)) {
                    const limpia = linea.replace(/\*/g, '').trim();
                    const partes = limpia.split(/\s+/);

                    const movIdx = partes.findIndex(p => ['INV', 'VTO', 'REG', 'ROB', 'ROT', 'AFT'].includes(p));

                    if (movIdx !== -1 && partes.length > movIdx + 4) {
                        const mov = partes[movIdx];
                        const sec = partes[movIdx - 1];
                        const sku = partes[movIdx + 1];
                        const ean = partes[movIdx + 2];

                        const descCompleta = partes.slice(movIdx + 3, partes.length - 3).join(' ');
                        const descripcion = descCompleta.replace(/\s(UNI|KIL)\s?$/i, '').trim();

                        const unidades = parseFloat(partes[partes.length - 2].replace(/,/g, ''));
                        const importe = parseFloat(partes[partes.length - 1].replace(/,/g, ''));

                        if (!mapaMaestro.has(ean)) {
                            mapaMaestro.set(ean, {
                                SEC: sec, SKU: sku, EAN: ean, Descripción: descripcion,
                                VTO_Unidades: 0, VTO_Importe: 0,
                                REG_Unidades: 0, REG_Importe: 0,
                                ROT_Unidades: 0, ROT_Importe: 0,
                                ROB_Unidades: 0, ROB_Importe: 0,
                                Otros_Unidades: 0, Otros_Importe: 0
                            });
                        }

                        const registro = mapaMaestro.get(ean);

                        if (mov === 'VTO') {
                            registro.VTO_Unidades += unidades; registro.VTO_Importe += importe;
                        } else if (mov === 'REG') {
                            registro.REG_Unidades += unidades; registro.REG_Importe += importe;
                        } else if (mov === 'ROT') {
                            registro.ROT_Unidades += unidades; registro.ROT_Importe += importe;
                        } else if (mov === 'ROB') {
                            registro.ROB_Unidades += unidades; registro.ROB_Importe += importe;
                        } else {
                            registro.Otros_Unidades += unidades; registro.Otros_Importe += importe;
                        }
                    }
                }
            });
        });

        const listaConsolidada = Array.from(mapaMaestro.values()).sort((a, b) => {
            const peorA = Math.min(a.VTO_Importe, a.REG_Importe, a.ROT_Importe, a.ROB_Importe);
            const peorB = Math.min(b.VTO_Importe, b.REG_Importe, b.ROT_Importe, b.ROB_Importe);
            return peorA - peorB;
        });

        const libroTrabajo = XLSX.utils.book_new();

        const filasExcel = listaConsolidada.map(item => ({
            'Sector': item.SEC, 'SKU': item.SKU, 'Código EAN': item.EAN, 'Descripción Producto': item.Descripción,
            'U. Vencimiento': item.VTO_Unidades, '$ Vencimiento': item.VTO_Importe,
            'U. Regularización': item.REG_Unidades, '$ Regularización': item.REG_Importe,
            'U. Roturas': item.ROT_Unidades, '$ Roturas': item.ROT_Importe,
            'U. Robos': item.ROB_Unidades, '$ Robos': item.ROB_Importe,
            'Observaciones': ''
        }));

        const hojaMaestra = XLSX.utils.json_to_sheet(filasExcel);
        XLSX.utils.book_append_sheet(libroTrabajo, hojaMaestra, 'Consolidado General Mermas');

        const bufferExcel = XLSX.write(libroTrabajo, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Libro_Maestro_Mermas.xlsx');

        return res.status(200).send(bufferExcel);

    } catch (error) {
        console.error("Error crítico en Serverless Function:", error);
        return res.status(500).json({ error: 'Error interno al procesar el lote.' });
    }
};