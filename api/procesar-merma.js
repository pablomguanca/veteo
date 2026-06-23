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
        const listaPlana = [];

        const totales = {
            VTO_U: 0, VTO_I: 0, REG_U: 0, REG_I: 0,
            ROT_U: 0, ROT_I: 0, ROB_U: 0, ROB_I: 0,
            OTROS_U: 0, OTROS_I: 0, TOTAL_U: 0, TOTAL_I: 0
        };

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
                        const endIndex = partes.length - 2;
                        const cleanDescriptionParts = [];
                        for (let i = movIdx + 3; i < endIndex; i++) {
                            const p = partes[i];
                            if (i >= partes.length - 5 && /^(UNI|KIL|UM|UC|UN|CJA|KG)$/i.test(p)) {
                                continue;
                            }
                            cleanDescriptionParts.push(p);
                        }
                        const descripcion = cleanDescriptionParts.join(' ');

                        const unidades = parseFloat(partes[partes.length - 2].replace(/,/g, ''));
                        const importe = parseFloat(partes[partes.length - 1].replace(/,/g, ''));

                        listaPlana.push({
                            'MOV': mov, 'Sector': sec, 'SKU': sku, 'Código EAN': ean,
                            'Descripción Producto': descripcion, 'Unidades': unidades, 'Importe ($)': importe
                        });

                        totales.TOTAL_U += unidades; totales.TOTAL_I += importe;

                        if (!mapaMaestro.has(ean)) {
                            mapaMaestro.set(ean, {
                                SEC: sec, SKU: sku, EAN: ean, Descripción: descripcion,
                                VTO_Unidades: 0, VTO_Importe: 0, REG_Unidades: 0, REG_Importe: 0,
                                ROT_Unidades: 0, ROT_Importe: 0, ROB_Unidades: 0, ROB_Importe: 0,
                                Otros_Unidades: 0, Otros_Importe: 0
                            });
                        }

                        const registro = mapaMaestro.get(ean);

                        if (mov === 'VTO') {
                            registro.VTO_Unidades += unidades; registro.VTO_Importe += importe;
                            totales.VTO_U += unidades; totales.VTO_I += importe;
                        } else if (mov === 'REG') {
                            registro.REG_Unidades += unidades; registro.REG_Importe += importe;
                            totales.REG_U += unidades; totales.REG_I += importe;
                        } else if (mov === 'ROT') {
                            registro.ROT_Unidades += unidades; registro.ROT_Importe += importe;
                            totales.ROT_U += unidades; totales.ROT_I += importe;
                        } else if (mov === 'ROB') {
                            registro.ROB_Unidades += unidades; registro.ROB_Importe += importe;
                            totales.ROB_U += unidades; totales.ROB_I += importe;
                        } else {
                            registro.Otros_Unidades += unidades; registro.Otros_Importe += importe;
                            totales.OTROS_U += unidades; totales.OTROS_I += importe;
                        }
                    }
                }
            });
        });

        const libroTrabajo = XLSX.utils.book_new();

        const filasTotales = [
            { 'Concepto': 'Vencimientos (VTO)', 'Unidades Totales': totales.VTO_U, 'Importe Total ($)': totales.VTO_I },
            { 'Concepto': 'Regularizaciones (REG)', 'Unidades Totales': totales.REG_U, 'Importe Total ($)': totales.REG_I },
            { 'Concepto': 'Roturas (ROT)', 'Unidades Totales': totales.ROT_U, 'Importe Total ($)': totales.ROT_I },
            { 'Concepto': 'Robos (ROB)', 'Unidades Totales': totales.ROB_U, 'Importe Total ($)': totales.ROB_I },
            { 'Concepto': 'Ajustes (AFT/Otros)', 'Unidades Totales': totales.OTROS_U, 'Importe Total ($)': totales.OTROS_I },
            { 'Concepto': 'TOTAL MERMA', 'Unidades Totales': totales.TOTAL_U, 'Importe Total ($)': totales.TOTAL_I }
        ];
        XLSX.utils.book_append_sheet(libroTrabajo, XLSX.utils.json_to_sheet(filasTotales), 'Mermas Generales Totales');

        listaPlana.sort((a, b) => a['Importe ($)'] - b['Importe ($)']);
        XLSX.utils.book_append_sheet(libroTrabajo, XLSX.utils.json_to_sheet(listaPlana), 'Mermas por Movimiento');

        const listaConsolidada = Array.from(mapaMaestro.values()).sort((a, b) => {
            const peorA = Math.min(a.VTO_Importe, a.REG_Importe, a.ROT_Importe, a.ROB_Importe);
            const peorB = Math.min(b.VTO_Importe, b.REG_Importe, b.ROT_Importe, b.ROB_Importe);
            return peorA - peorB;
        });

        const filasConsolidado = listaConsolidada.map(item => ({
            'Sector': item.SEC, 'SKU': item.SKU, 'EAN': item.EAN, 'Descripción': item.Descripción,
            'U. Vencimiento': item.VTO_Unidades, '$ Vencimiento': item.VTO_Importe,
            'U. Regularización': item.REG_Unidades, '$ Regularización': item.REG_Importe,
            'U. Roturas': item.ROT_Unidades, '$ Roturas': item.ROT_Importe,
            'U. Robos': item.ROB_Unidades, '$ Robos': item.ROB_Importe,
            'Total Unidades': (item.VTO_Unidades + item.REG_Unidades + item.ROT_Unidades + item.ROB_Unidades + item.Otros_Unidades),
            'Total Importe': (item.VTO_Importe + item.REG_Importe + item.ROT_Importe + item.ROB_Importe + item.Otros_Importe),
            'Observaciones': ''
        }));
        XLSX.utils.book_append_sheet(libroTrabajo, XLSX.utils.json_to_sheet(filasConsolidado), 'Consolidado Comparativo');

        const filasPlan = Array(15).fill({
            'Sector': '', 'Foco de Merma': '', 'Causa Raíz': '', 'Acción a Implementar': '',
            'Responsable': '', 'Fecha Límite': '', 'Estado': ''
        });
        XLSX.utils.book_append_sheet(libroTrabajo, XLSX.utils.json_to_sheet(filasPlan), 'Plan de Acción');

        const bufferExcel = XLSX.write(libroTrabajo, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Libro_Maestro_Mermas.xlsx');

        return res.status(200).send(bufferExcel);

    } catch (error) {
        console.error("Error crítico en Serverless Function:", error);
        return res.status(500).json({ error: 'Error interno al compilar el Libro Maestro.' });
    }
};