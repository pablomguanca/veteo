const ExcelJS = require('exceljs');

const PALETA = {
    NAVY: '1F3864',
    NAVY2: '2E5090',
    SILVER: 'D6DCE4',
    ZEBRA: 'EEF2F7',
    RED_BG: 'FFC7CE',
    RED_TXT: '9C0006',
    GREEN_BG: 'C6EFCE',
    GREEN_TXT: '006100'
};

const thin = (color = 'AAAAAA') => ({ style: 'thin', color: { argb: 'FF' + color } });
const allBorders = (color) => ({ top: thin(color), left: thin(color), right: thin(color), bottom: thin(color) });

function styleHeader(cell, bgArgb = PALETA.NAVY, sz = 10) {
    cell.font = { name: 'Segoe UI', size: sz, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgArgb } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = allBorders();
}

function styleTitle(cell, sz = 13) {
    cell.font = { name: 'Segoe UI', size: sz, bold: true, color: { argb: 'FF' + PALETA.NAVY } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.SILVER } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = allBorders();
}

function styleData(cell, rowIdx) {
    const bg = rowIdx % 2 === 0 ? PALETA.ZEBRA : 'FFFFFF';
    cell.font = { name: 'Segoe UI', size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
    cell.border = allBorders('BBBBBB');
    cell.alignment = { vertical: 'middle' };
}

const UFMT = '#,##0;-#,##0';
const MFMT = '#,##0.00;-#,##0.00';

function extraerMes(texto) {
    const match = texto.match(/^\s*\d{2}\/(\d{2})\/\d{2}/m);
    if (match) {
        const mesIdx = parseInt(match[1], 10) - 1;
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return meses[mesIdx] || 'Período';
    }
    return 'Período';
}

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

        const mes1 = extraerMes(inventarioPeriodo1);
        const mes2 = extraerMes(inventarioPeriodo2);

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
                        let importe = parseFloat(partes[partes.length - 1].replace(/,/g, ''));
                        let unidades = parseFloat(partes[partes.length - 2].replace(/,/g, ''));

                        if (isNaN(unidades) || isNaN(importe)) return;

                        if (unidades % 1 === 0) unidades = parseInt(unidades);
                        if (importe % 1 === 0) importe = parseInt(importe);

                        let partesDesc = partes.slice(movIdx + 3, partes.length - 2);
                        if (partesDesc.length > 0 && /^(UNI|KIL|UM|UC|UN|CJA|KG)$/i.test(partesDesc[partesDesc.length - 1])) {
                            partesDesc.pop();
                        }
                        const descripcion = partesDesc.join(' ').trim();

                        registrosLimpios.push({
                            mov: partes[movIdx], sec: partes[movIdx - 1], sku: partes[movIdx + 1], ean: partes[movIdx + 2],
                            descripcion: descripcion, unidades: unidades, importe: importe
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
                MOV: item.mov, SEC: item.sec, SKU: item.sku, EAN: item.ean, Descripción: item.descripcion,
                U_P1: item.unidades, I_P1: item.importe, U_P2: 0, I_P2: 0
            });
        });

        datosP2.forEach(item => {
            if (mapaConsolidado.has(item.ean)) {
                const ext = mapaConsolidado.get(item.ean);
                ext.U_P2 = item.unidades; ext.I_P2 = item.importe;
                ext.MOV = item.mov; 
            } else {
                mapaConsolidado.set(item.ean, {
                    MOV: item.mov, SEC: item.sec, SKU: item.sku, EAN: item.ean, Descripción: item.descripcion,
                    U_P1: 0, I_P1: 0, U_P2: item.unidades, I_P2: item.importe
                });
            }
        });

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Veteo App';
        const h1 = wb.addWorksheet('Cruce Consolidado');

        h1.views = [{ showGridLines: true, state: 'frozen', ySplit: 3 }];
        h1.columns = [
            { key: 'mov', width: 8 },
            { key: 'sec', width: 7 },
            { key: 'sku', width: 10 },
            { key: 'ean', width: 16 },
            { key: 'desc', width: 45 },
            { key: 'up1', width: 14 },
            { key: 'ip1', width: 18 },
            { key: 'up2', width: 14 },
            { key: 'ip2', width: 18 },
            { key: 'difU', width: 16 },
            { key: 'difI', width: 18 }
        ];

        h1.mergeCells('A1:K1');
        styleTitle(h1.getCell('A1'), 13);
        h1.getCell('A1').value = `VETEO APP — CRUCE RÁPIDO DE INVENTARIOS`;
        h1.getRow(1).height = 24;

        h1.mergeCells('A2:K2');
        styleTitle(h1.getCell('A2'), 11);
        h1.getCell('A2').value = `Comparativo Directo Alineado por EAN: ${mes1} vs ${mes2}`;
        h1.getRow(2).height = 18;

        const hdr = h1.addRow(['MOV', 'Sector', 'SKU', 'Código EAN', 'Descripción', `Unidades ${mes1}`, `$ Importe ${mes1}`, `Unidades ${mes2}`, `$ Importe ${mes2}`, 'Diferencia (U.)', 'Diferencia ($)']);
        hdr.height = 22;
        hdr.eachCell(c => styleHeader(c));

        const dataArray = Array.from(mapaConsolidado.values());
        
        dataArray.sort((a, b) => a.I_P1 - b.I_P1);

        dataArray.forEach((item, i) => {
            const difUnidades = item.U_P2 - item.U_P1;
            const difImporte = item.I_P2 - item.I_P1;
            
            const row = h1.addRow([
                item.MOV, item.SEC, item.SKU, item.EAN, item.Descripción,
                item.U_P1, item.I_P1, item.U_P2, item.I_P2, difUnidades, difImporte
            ]);
            
            row.height = 16;
            row.eachCell((cell, ci) => {
                styleData(cell, i);
                
                if ([6, 8, 10].includes(ci)) { 
                    cell.numFmt = UFMT; 
                    cell.alignment = { horizontal: 'right', vertical: 'middle' }; 
                }
                if ([7, 9, 11].includes(ci)) { 
                    cell.numFmt = MFMT; 
                    cell.alignment = { horizontal: 'right', vertical: 'middle' }; 
                }
                
                if (ci === 10 || ci === 11) {
                    const valorDeReferencia = ci === 10 ? difUnidades : difImporte;
                    
                    if (valorDeReferencia < 0) {
                        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: PALETA.RED_TXT } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETA.RED_BG } };
                    } else if (valorDeReferencia > 0) {
                        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: PALETA.GREEN_TXT } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETA.GREEN_BG } };
                    } else {
                        cell.font = { name: 'Segoe UI', size: 10, bold: false, color: { argb: 'FF7F7F7F' } };
                    }
                }
            });
        });

        const buffer = await wb.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Cruce_Inventarios_${mes1}_vs_${mes2}.xlsx`);
        return res.status(200).send(buffer);

    } catch (error) {
        console.error("Error crítico en cruce rápido:", error);
        return res.status(500).json({ error: 'Error interno en el servidor.' });
    }
};