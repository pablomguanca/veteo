const XLSX = require('xlsx');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    try {
        const { inventarioPeriodo1, inventarioPeriodo2 } = req.body;

        if (!inventarioPeriodo1 || !inventarioPeriodo2) {
            return res.status(400).json({ error: 'Faltan los archivos de inventario base.' });
        }

        const regexFilaValida = /^\s*(\d{2}\/\d{2}\/\d{2})/;

        const parsearTxt = (textoCrudo) => {
            const lineas = textoCrudo.split('\n');
            const registrosLimpios = [];

            lineas.forEach(linea => {
                if (regexFilaValida.test(linea)) {
                    const limpia = linea.replace(/\*/g, '').trim();
                    const partes = limpia.split(/\s+/);

                    const movIdx = partes.findIndex(p => ['INV', 'VTO', 'REG', 'ROB', 'ROT', 'AFT'].includes(p));

                    if (movIdx !== -1 && partes.length > movIdx + 4) {
                        registrosLimpios.push({
                            mov: partes[movIdx],
                            sec: partes[movIdx - 1],
                            sku: partes[movIdx + 1],
                            ean: partes[movIdx + 2],
                            descripcion: partes.slice(movIdx + 3, partes.length - 3).join(' ').replace(/\s(UNI|KIL)\s?$/i, '').trim(),
                            unidades: parseFloat(partes[partes.length - 2].replace(/,/g, '')),
                            importe: parseFloat(partes[partes.length - 1].replace(/,/g, ''))
                        });
                    }
                }
            });
            return registrosLimpios;
        };

        const datosP1 = parsearTxt(inventarioPeriodo1);
        const datosP2 = parsearTxt(inventarioPeriodo2);
        const mapaConsolidado = new Map();

        datosP1.forEach(item => {
            mapaConsolidado.set(item.ean, {
                MOV: item.mov,
                SEC: item.sec,
                SKU: item.sku,
                EAN: item.ean,
                Descripción: item.descripcion,
                Unidades_P1: item.unidades,
                Importe_P1: item.importe,
                Unidades_P2: 0,
                Importe_P2: 0
            });
        });

        datosP2.forEach(item => {
            if (mapaConsolidado.has(item.ean)) {
                const ext = mapaConsolidado.get(item.ean);
                ext.Unidades_P2 = item.unidades;
                ext.Importe_P2 = item.importe;
            } else {
                mapaConsolidado.set(item.ean, {
                    MOV: item.mov,
                    SEC: item.sec,
                    SKU: item.sku,
                    EAN: item.ean,
                    Descripción: item.descripcion,
                    Unidades_P1: 0,
                    Importe_P1: 0,
                    Unidades_P2: item.unidades,
                    Importe_P2: item.importe
                });
            }
        });

        const libroAbierto = XLSX.utils.book_new();

        const filasSolapa1 = Array.from(mapaConsolidado.values()).map(item => ({
            'MOV': item.MOV,
            'SEC': item.SEC,
            'SKU': item.SKU,
            'EAN': item.EAN,
            'Descripción': item.Descripción,
            'Unidades Período 1': item.Unidades_P1,
            'Importe Período 1': item.Importe_P1,
            'Unidades Período 2': item.Unidades_P2,
            'Importe Período 2': item.Importe_P2
        }));

        XLSX.utils.book_append_sheet(libroAbierto, XLSX.utils.json_to_sheet(filasSolapa1), 'Cruce Puro');

        const bufferExcel = XLSX.write(libroAbierto, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Cruce_de_Inventarios.xlsx');

        return res.status(200).send(bufferExcel);

    } catch (error) {
        console.error("Error crítico en cruce rápido:", error);
        return res.status(500).json({ error: 'Error interno en el servidor.' });
    }
};