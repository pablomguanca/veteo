const ExcelJS = require('exceljs');

const PALETA = {
    GRIS_HDR: '414141',
    AZUL_COL: '1F4E79',
    FONDO_COL: 'F2F4F7',
    ZEBRA: 'EEF2F7',
    WHITE: 'FFFFFFFF',
    NAVY: '1F3864',
    SILVER: 'D6DCE4',
    BLUE_TOT: 'D9E1F2',
    RED: 'FFCCCC',
    ORANGE: 'FFE0B2',
};

const thin = () => ({ style: 'thin', color: { argb: 'FFCCCCCC' } });
const borders = () => ({ top: thin(), left: thin(), right: thin(), bottom: thin() });

const UFMT = '#,##0;-#,##0';
const MFMT = '#,##0.00;-#,##0.00';
const FONT = 'Quattrocento Sans';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    try {
        const { inventarioPeriodo1, inventarioPeriodo2, labelPeriodo1, labelPeriodo2 } = req.body;

        if (!inventarioPeriodo1 || !inventarioPeriodo2) {
            return res.status(400).json({ error: 'Faltan los archivos de inventario base.' });
        }

        const P1_LABEL = labelPeriodo1 || 'Período 1';
        const P2_LABEL = labelPeriodo2 || 'Período 2';
        const parsearTxt = (textoCrudo) => {
            const MOV_VALIDOS = new Set(['INV', 'VTO', 'REG', 'ROB', 'ROT', 'AFT']);
            const registros = [];

            textoCrudo.split('\n').forEach(linea => {
                if (!/^\s*\d{2}\/\d{2}\/\d{2}/.test(linea)) return;

                const partes = linea.replace(/\*/g, '').trim().split(/\s+/);
                const movIdx = partes.findIndex(p => MOV_VALIDOS.has(p));
                if (movIdx === -1 || partes.length < movIdx + 8) return;

                const unidades = parseFloat(partes[partes.length - 4].replace(/,/g, ''));
                const importe = parseFloat(partes[partes.length - 3].replace(/,/g, ''));
                if (isNaN(unidades) || isNaN(importe)) return;

                registros.push({
                    mov: partes[movIdx],
                    sec: partes[movIdx - 1],
                    ean: partes[movIdx + 2],
                    desc: partes.slice(movIdx + 3, partes.length - 6).join(' ').trim(),
                    unidades: unidades % 1 === 0 ? parseInt(unidades) : unidades,
                    importe: importe,
                });
            });

            return registros;
        };

        const datosP1 = parsearTxt(inventarioPeriodo1);
        const datosP2 = parsearTxt(inventarioPeriodo2);
        const mapa = new Map();

        datosP1.forEach(item => {
            if (!mapa.has(item.ean)) {
                mapa.set(item.ean, {
                    mov: item.mov, sec: item.sec, ean: item.ean, desc: item.desc,
                    u1: 0, i1: 0.0, u2: 0, i2: 0.0,
                });
            }
            const r = mapa.get(item.ean);
            r.u1 += item.unidades;
            r.i1 += item.importe;
        });

        datosP2.forEach(item => {
            if (!mapa.has(item.ean)) {
                mapa.set(item.ean, {
                    mov: item.mov, sec: item.sec, ean: item.ean, desc: item.desc,
                    u1: 0, i1: 0.0, u2: 0, i2: 0.0,
                });
            }
            const r = mapa.get(item.ean);
            if (!r.desc) r.desc = item.desc;
            r.u2 += item.unidades;
            r.i2 += item.importe;
        });

        const filas = Array.from(mapa.values())
            .sort((a, b) => (a.i1 + a.i2) - (b.i1 + b.i2));

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Veteo App';

        const ws = wb.addWorksheet('Comparativo de Pérdidas');
        ws.views = [{ showGridLines: true, state: 'frozen', ySplit: 5 }];

        ws.columns = [
            { key: 'mov', width: 7 },
            { key: 'sec', width: 7 },
            { key: 'ean', width: 17 },
            { key: 'desc', width: 36 },
            { key: 'u1', width: 13 },
            { key: 'i1', width: 18 },
            { key: 'u2', width: 13 },
            { key: 'i2', width: 18 },
            { key: 'obs', width: 59 },
        ];

        ws.mergeCells('A1:I1');
        const t1 = ws.getCell('A1');
        t1.value = `CRUCE DE INVENTARIOS PARA ANÁLISIS — TIENDA 656`;
        t1.font = { name: FONT, size: 13, bold: true, color: { argb: 'FF' + PALETA.NAVY } };
        t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.SILVER } };
        t1.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 22;
        ws.mergeCells('A2:I2');
        const t2 = ws.getCell('A2');
        t2.value = `Comparativo alineado por artículo: ${P1_LABEL} vs ${P2_LABEL} (Ordenado de mayor a menor pérdida)`;
        t2.font = { name: FONT, size: 10, color: { argb: 'FF' + PALETA.NAVY } };
        t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.SILVER } };
        t2.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(2).height = 16;
        ws.getRow(3).height = 6;
        ws.mergeCells('A4:D4');
        ws.mergeCells('E4:F4');
        ws.mergeCells('G4:H4');

        const grupoStyle = (cell, label) => {
            cell.value = label;
            cell.font = { name: FONT, size: 11, bold: true, color: { argb: PALETA.WHITE } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.GRIS_HDR } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = borders();
        };
        grupoStyle(ws.getCell('A4'), 'Detalle del Producto');
        grupoStyle(ws.getCell('E4'), P1_LABEL);
        grupoStyle(ws.getCell('G4'), P2_LABEL);
        ws.getCell('I4').value = 'Control';
        ws.getCell('I4').font = { name: FONT, size: 11, bold: true, color: { argb: PALETA.WHITE } };
        ws.getCell('I4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.GRIS_HDR } };
        ws.getCell('I4').alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getCell('I4').border = borders();
        ws.getRow(4).height = 20;

        const colHdrs = ['MOV', 'SEC', 'EAN', 'Descripción', 'Unidades', 'Importe', 'Unidades', 'Importe', 'Observaciones'];
        colHdrs.forEach((h, i) => {
            const cell = ws.getCell(5, i + 1);
            cell.value = h;
            cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF' + PALETA.AZUL_COL } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.FONDO_COL } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = borders();
        });
        ws.getRow(5).height = 18;

        filas.forEach((rec, idx) => {
            const rowNum = idx + 6;
            const bgArgb = idx % 2 === 0 ? 'FF' + PALETA.ZEBRA : PALETA.WHITE;

            const vals = [rec.mov, rec.sec, rec.ean, rec.desc, rec.u1, rec.i1, rec.u2, rec.i2, ''];
            vals.forEach((val, ci) => {
                const cell = ws.getCell(rowNum, ci + 1);
                cell.value = val;
                cell.font = { name: FONT, size: 10 };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
                cell.border = borders();

                if (ci === 4 || ci === 6) {
                    cell.numFmt = UFMT;
                    cell.alignment = { horizontal: 'right' };
                }
                if (ci === 5 || ci === 7) {
                    cell.numFmt = MFMT;
                    cell.alignment = { horizontal: 'right' };
                    const v = typeof val === 'number' ? val : 0;
                    if (v < -30000) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.RED } };
                    } else if (v < 0) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.ORANGE } };
                    }
                }
                if (ci === 8) {
                    cell.alignment = { wrapText: true, vertical: 'top' };
                }
            });

            if (rec.u1 === 0 && rec.i1 === 0) {
                [5, 6].forEach(ci => {
                    ws.getCell(rowNum, ci).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                });
            }
            if (rec.u2 === 0 && rec.i2 === 0) {
                [7, 8].forEach(ci => {
                    ws.getCell(rowNum, ci).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                });
            }
        });

        // Fila de totales
        const totRow = filas.length + 6;
        const totCell = ws.getCell(totRow, 4);
        totCell.value = 'TOTAL GENERAL';
        totCell.font = { name: FONT, size: 10, bold: true };
        totCell.border = borders();

        [[5, 'E'], [6, 'F'], [7, 'G'], [8, 'H']].forEach(([ci, col]) => {
            const cell = ws.getCell(totRow, ci);
            cell.value = `=SUM(${col}6:${col}${totRow - 1})`;
            cell.numFmt = ci === 5 || ci === 7 ? UFMT : MFMT;
            cell.font = { name: FONT, size: 10, bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.BLUE_TOT } };
            cell.border = borders();
            cell.alignment = { horizontal: 'right' };
        });

        ws.autoFilter = { from: 'A5', to: 'I5' };

        const buffer = await wb.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Cruce_de_Inventarios.xlsx');
        return res.status(200).send(buffer);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error interno en el servidor.' });
    }
};