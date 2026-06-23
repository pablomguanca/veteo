const ExcelJS = require('exceljs');
const { GoogleGenAI } = require('@google/genai');

const PALETA = {
    NAVY: '1F3864',
    NAVY2: '2E5090',
    SILVER: 'D6DCE4',
    ZEBRA: 'EEF2F7',
    RED: 'FFCCCC',
    ORANGE: 'FFE0B2',
    BLUE_TOT: 'D9E1F2',
    GOLD: 'C9D9F0',
    WHITE: 'FFFFFFFF',
};

const thin = (color = 'AAAAAA') => ({ style: 'thin', color: { argb: 'FF' + color } });
const allBorders = (color) => ({ top: thin(color), left: thin(color), right: thin(color), bottom: thin(color) });

function styleHeader(cell, bgArgb = PALETA.NAVY, sz = 11) {
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

function styleTotal(cell) {
    cell.font = { name: 'Segoe UI', size: 10, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.BLUE_TOT } };
    cell.border = allBorders();
}

function styleSectionTitle(cell, text) {
    cell.value = text;
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF' + PALETA.NAVY } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.GOLD } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    cell.border = allBorders();
}

const UFMT = '#,##0;-#,##0';
const MFMT = '#,##0.00;-#,##0.00';

const fU = (v, det) => (!det || v === 0) ? '-' : v;
const fI = (v, det) => (!det || v === 0) ? '-' : v;

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
            INV_U: 0, INV_I: 0,
            VTO_U: 0, VTO_I: 0,
            REG_U: 0, REG_I: 0,
            ROT_U: 0, ROT_I: 0,
            ROB_U: 0, ROB_I: 0,
            OTROS_U: 0, OTROS_I: 0,
            TOTAL_U: 0, TOTAL_I: 0,
        };

        const movsDetectados = { INV: false, VTO: false, REG: false, ROT: false, ROB: false, OTROS: false };

        archivos.forEach(archivo => {
            archivo.contenido.split('\n').forEach(linea => {
                if (!regexFilaValida.test(linea)) return;

                const limpia = linea.replace(/\*/g, '').trim();
                const partes = limpia.split(/\s+/);
                const movIdx = partes.findIndex(p => ['INV', 'VTO', 'REG', 'ROB', 'ROT', 'AFT'].includes(p));

                if (movIdx === -1 || partes.length <= movIdx + 4) return;

                const mov = partes[movIdx];
                const sec = partes[movIdx - 1];

                let importe = parseFloat(partes[partes.length - 1].replace(/,/g, ''));
                let unidades = parseFloat(partes[partes.length - 2].replace(/,/g, ''));

                if (isNaN(unidades) || isNaN(importe)) return;

                if (unidades % 1 === 0) unidades = parseInt(unidades);
                if (importe % 1 === 0) importe = parseInt(importe);

                const sku = partes[movIdx + 1];
                const ean = partes[movIdx + 2];

                let partesDesc = partes.slice(movIdx + 3, partes.length - 2);
                if (partesDesc.length > 0 && /^(UNI|KIL|UM|UC|UN|CJA|KG)$/i.test(partesDesc[partesDesc.length - 1])) {
                    partesDesc.pop();
                }
                const descripcion = partesDesc.join(' ').trim();

                listaPlana.push({
                    'MOV': mov, 'Sector': sec, 'SKU': sku, 'Código EAN': ean,
                    'Descripción Producto': descripcion, 'Unidades': unidades, 'Importe ($)': importe,
                });

                totales.TOTAL_U += unidades;
                totales.TOTAL_I += importe;

                if (!mapaMaestro.has(ean)) {
                    mapaMaestro.set(ean, {
                        SEC: sec, SKU: sku, EAN: ean, Descripción: descripcion,
                        INV_U: 0, INV_I: 0, VTO_U: 0, VTO_I: 0,
                        REG_U: 0, REG_I: 0, ROT_U: 0, ROT_I: 0,
                        ROB_U: 0, ROB_I: 0, Otros_U: 0, Otros_I: 0,
                    });
                }

                const reg = mapaMaestro.get(ean);

                if (mov === 'INV') { reg.INV_U += unidades; reg.INV_I += importe; totales.INV_U += unidades; totales.INV_I += importe; movsDetectados.INV = true; }
                else if (mov === 'VTO') { reg.VTO_U += unidades; reg.VTO_I += importe; totales.VTO_U += unidades; totales.VTO_I += importe; movsDetectados.VTO = true; }
                else if (mov === 'REG') { reg.REG_U += unidades; reg.REG_I += importe; totales.REG_U += unidades; totales.REG_I += importe; movsDetectados.REG = true; }
                else if (mov === 'ROT') { reg.ROT_U += unidades; reg.ROT_I += importe; totales.ROT_U += totales.ROT_I += importe; movsDetectados.ROT = true; }
                else if (mov === 'ROB') { reg.ROB_U += unidades; reg.ROB_I += importe; totales.ROB_U += totales.ROB_I += importe; movsDetectados.ROB = true; }
                else { reg.Otros_U += unidades; reg.Otros_I += importe; totales.OTROS_U += unidades; totales.OTROS_I += importe; movsDetectados.OTROS = true; }
            });
        });

        const articulosOrdenados = Array.from(mapaMaestro.values())
            .map(item => ({
                ean: item.EAN,
                desc: item.Descripción,
                u: item.INV_U + item.VTO_U + item.REG_U + item.ROT_U + item.ROB_U + item.Otros_U,
                i: item.INV_I + item.VTO_I + item.REG_I + item.ROT_I + item.ROB_I + item.Otros_I,
            }))
            .sort((a, b) => a.i - b.i);

        const top5 = articulosOrdenados.slice(0, 5);

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Veteo App';
        wb.modified = new Date();

        const h1 = wb.addWorksheet('Mermas Generales Totales');
        h1.views = [{ showGridLines: true, state: 'frozen', ySplit: 4 }];
        h1.columns = [
            { key: 'concepto', width: 32 },
            { key: 'unidades', width: 18 },
            { key: 'importe', width: 22 },
        ];

        h1.mergeCells('A1:C1');
        styleTitle(h1.getCell('A1'), 14);
        h1.getCell('A1').value = 'VETEO APP — CONTROL DE MERMAS OPERATIVAS';
        h1.getRow(1).height = 26;

        h1.mergeCells('A2:C2');
        styleTitle(h1.getCell('A2'), 11);
        h1.getCell('A2').value = 'REPORTE CONSOLIDADO MENSUAL DE SUCURSAL';
        h1.getRow(2).height = 20;

        h1.addRow([]);

        const hdr1 = h1.addRow(['Concepto', 'Unidades Totales', 'Importe Total ($)']);
        hdr1.height = 20;
        hdr1.eachCell(c => styleHeader(c));

        const resumenRows = [
            ['Inventario (INV)', fU(totales.INV_U, movsDetectados.INV), fI(totales.INV_I, movsDetectados.INV)],
            ['Vencimientos (VTO)', fU(totales.VTO_U, movsDetectados.VTO), fI(totales.VTO_I, movsDetectados.VTO)],
            ['Regularizaciones (REG)', fU(totales.REG_U, movsDetectados.REG), fI(totales.REG_I, movsDetectados.REG)],
            ['Roturas (ROT)', fU(totales.ROT_U, movsDetectados.ROT), fI(totales.ROT_I, movsDetectados.ROT)],
            ['Robos (ROB)', fU(totales.ROB_U, movsDetectados.ROB), fI(totales.ROB_I, movsDetectados.ROB)],
            ['Ajustes (AFT/Otros)', fU(totales.OTROS_U, movsDetectados.OTROS), fI(totales.OTROS_I, movsDetectados.OTROS)],
        ];

        resumenRows.forEach((datos, i) => {
            const row = h1.addRow(datos);
            row.height = 18;
            row.eachCell((cell, ci) => {
                styleData(cell, i);
                if (ci === 2 && typeof cell.value === 'number') cell.numFmt = UFMT;
                if (ci === 3 && typeof cell.value === 'number') cell.numFmt = MFMT;
            });
        });

        const totRow = h1.addRow([
            'TOTAL GENERAL DE MERMA',
            totales.TOTAL_U,
            totales.TOTAL_I,
        ]);
        totRow.height = 20;
        totRow.eachCell((cell, ci) => {
            styleTotal(cell);
            if (ci === 2) cell.numFmt = UFMT;
            if (ci === 3) cell.numFmt = MFMT;
        });

        h1.addRow([]);
        h1.addRow([]);

        const secTop5Row = h1.addRow([]);
        h1.mergeCells(`A${secTop5Row.number}:C${secTop5Row.number}`);
        styleSectionTitle(secTop5Row.getCell(1), '▶   LOS 5 ARTÍCULOS MÁS CRÍTICOS — Consolidado histórico general (sin distinción de motivo)');
        secTop5Row.height = 20;

        const hdr1b = h1.addRow(['CÓDIGO EAN', 'DESCRIPCIÓN', 'CANTIDAD TOTAL', 'IMPORTE TOTAL (ARS)']);
        hdr1b.height = 20;
        hdr1b.eachCell(c => styleHeader(c));

        top5.forEach((art, i) => {
            const row = h1.addRow([art.ean, art.desc, art.u, art.i]);
            row.height = 18;
            row.eachCell((cell, ci) => {
                styleData(cell, i);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.RED } };
                if (ci === 3) cell.numFmt = UFMT;
                if (ci === 4) cell.numFmt = MFMT;
            });
        });

        const h2 = wb.addWorksheet('Mermas por Movimiento');
        h2.views = [{ showGridLines: true, state: 'frozen', ySplit: 2 }];
        h2.columns = [
            { key: 'mov', width: 8 },
            { key: 'sec', width: 7 },
            { key: 'sku', width: 10 },
            { key: 'ean', width: 16 },
            { key: 'desc', width: 50 },
            { key: 'unid', width: 12 },
            { key: 'imp', width: 18 },
        ];

        h2.mergeCells('A1:G1');
        styleTitle(h2.getCell('A1'), 13);
        h2.getCell('A1').value = 'MERMAS POR MOVIMIENTO — DETALLE COMPLETO ORDENADO POR PÉRDIDA';
        h2.getRow(1).height = 24;

        const hdr2 = h2.addRow(['MOV', 'Sector', 'SKU', 'Código EAN', 'Descripción Producto', 'Unidades', 'Importe ($)']);
        hdr2.height = 20;
        hdr2.eachCell(c => styleHeader(c));

        listaPlana.sort((a, b) => a['Importe ($)'] - b['Importe ($)']);

        listaPlana.forEach((rec, i) => {
            const row = h2.addRow([rec.MOV, rec.Sector, rec.SKU, rec['Código EAN'], rec['Descripción Producto'], rec.Unidades, rec['Importe ($)']]);
            row.height = 16;
            row.eachCell((cell, ci) => {
                styleData(cell, i);
                if (ci === 6) { cell.numFmt = UFMT; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
                if (ci === 7) {
                    cell.numFmt = MFMT;
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    if (typeof rec['Importe ($)'] === 'number' && rec['Importe ($)'] < -30000) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.RED } };
                    } else if (typeof rec['Importe ($)'] === 'number' && rec['Importe ($)'] < 0) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.ORANGE } };
                    }
                }
            });
        });

        const h3 = wb.addWorksheet('Consolidado Comparativo');
        h3.views = [{ showGridLines: true, state: 'frozen', ySplit: 4 }];
        h3.columns = [
            { key: 'sec', width: 7 },
            { key: 'sku', width: 10 },
            { key: 'ean', width: 16 },
            { key: 'desc', width: 48 },
            { key: 'inv_u', width: 12 },
            { key: 'inv_i', width: 18 },
            { key: 'vto_u', width: 12 },
            { key: 'vto_i', width: 18 },
            { key: 'reg_u', width: 12 },
            { key: 'reg_i', width: 18 },
            { key: 'rot_u', width: 12 },
            { key: 'rot_i', width: 18 },
            { key: 'rob_u', width: 12 },
            { key: 'rob_i', width: 18 },
            { key: 'tot_u', width: 14 },
            { key: 'tot_i', width: 18 },
            { key: 'obs', width: 34 },
        ];

        h3.mergeCells('A1:Q1');
        styleTitle(h3.getCell('A1'), 13);
        h3.getCell('A1').value = 'CRUCE DE INVENTARIOS Y CONTROL DE STOCK — COMPARATIVO ALINEADO POR ARTÍCULO';
        h3.getRow(1).height = 24;

        const grupos = [
            [5, 6, 'INVENTARIO', PALETA.NAVY],
            [7, 8, 'VENCIMIENTOS', '1A5276'],
            [9, 10, 'REGULARIZ.', '1D6A39'],
            [11, 12, 'ROTURAS', '7D6608'],
            [13, 14, 'ROBOS', '922B21'],
        ];

        const grupoRow = h3.getRow(2);
        grupoRow.height = 18;
        grupos.forEach(([c1, c2, label, color]) => {
            h3.mergeCells(2, c1, 2, c2);
            const cell = grupoRow.getCell(c1);
            cell.value = label;
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = allBorders();
        });
        h3.mergeCells('A2:D2');
        h3.mergeCells('O2:Q2');

        const hdr3a = h3.getRow(3);
        hdr3a.height = 20;
        ['Sector', 'SKU', 'EAN', 'Descripción',
            'U. Inv', '$ Inv', 'U. VTO', '$ VTO', 'U. REG', '$ REG', 'U. ROT', '$ ROT', 'U. ROB', '$ ROB',
            'Total U.', 'Total $', 'Observaciones']
            .forEach((h, i) => {
                const cell = hdr3a.getCell(i + 1);
                cell.value = h;
                styleHeader(cell);
            });

        const IMPORTE_COLS_H3 = [6, 8, 10, 12, 14, 16];
        const UNIDAD_COLS_H3 = [5, 7, 9, 11, 13, 15];

        Array.from(mapaMaestro.values())
            .sort((a, b) => {
                const tA = a.INV_I + a.VTO_I + a.REG_I + a.ROT_I + a.ROB_I + a.Otros_I;
                const tB = b.INV_I + b.VTO_I + b.REG_I + b.ROT_I + b.ROB_I + b.Otros_I;
                return tA - tB;
            })
            .forEach((item, i) => {
                const tU = item.INV_U + item.VTO_U + item.REG_U + item.ROT_U + item.ROB_U + item.Otros_U;
                const tI = item.INV_I + item.VTO_I + item.REG_I + item.ROT_I + item.ROB_I + item.Otros_I;
                const row = h3.addRow([
                    item.SEC, item.SKU, item.EAN, item.Descripción,
                    fU(item.INV_U, movsDetectados.INV), fI(item.INV_I, movsDetectados.INV),
                    fU(item.VTO_U, movsDetectados.VTO), fI(item.VTO_I, movsDetectados.VTO),
                    fU(item.REG_U, movsDetectados.REG), fI(item.REG_I, movsDetectados.REG),
                    fU(item.ROT_U, movsDetectados.ROT), fI(item.ROT_I, movsDetectados.ROT),
                    fU(item.ROB_U, movsDetectados.ROB), fI(item.ROB_I, movsDetectados.ROB),
                    tU, tI, '',
                ]);
                row.height = 16;
                row.eachCell((cell, ci) => {
                    styleData(cell, i);
                    if (UNIDAD_COLS_H3.includes(ci)) {
                        if (typeof cell.value === 'number') cell.numFmt = UFMT;
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    }
                    if (IMPORTE_COLS_H3.includes(ci)) {
                        if (typeof cell.value === 'number') cell.numFmt = MFMT;
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        const v = cell.value;
                        if (typeof v === 'number' && v < -30000) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.RED } };
                        } else if (typeof v === 'number' && v < 0) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETA.ORANGE } };
                        }
                    }
                });
            });

        const h4 = wb.addWorksheet('Plan de Acción');
        h4.views = [{ showGridLines: true, state: 'frozen', ySplit: 3 }];
        h4.columns = [
            { key: 'que', width: 30 },
            { key: 'como', width: 48 },
            { key: 'conque', width: 34 },
            { key: 'cuando', width: 20 },
            { key: 'quien', width: 20 },
        ];

        h4.mergeCells('A1:E1');
        styleTitle(h4.getCell('A1'), 13);
        h4.getCell('A1').value = 'PLAN DE ACCIÓN ESTRATÉGICO — CONTROL Y REDUCCIÓN DE MERMAS';
        h4.getRow(1).height = 26;

        h4.mergeCells('A2:E2');
        styleTitle(h4.getCell('A2'), 10);
        h4.getCell('A2').value = 'Estrategias de Mitigación y Asignación de Controles Inteligentes';
        h4.getRow(2).height = 18;

        const hdr4 = h4.addRow(['¿Qué? (Acción Estratégica)', '¿Cómo? (Metodología Operativa)', '¿Con Qué? (Recursos / Herramientas)', '¿Cuándo? (Plazo)', '¿Quién? (Responsable)']);
        hdr4.height = 36;
        hdr4.eachCell(c => styleHeader(c));

        const apiKey = process.env.GEMINI_API_KEY;
        let filasPlanDeAccion = [];

        if (apiKey && top5.length > 0) {
            try {
                const ai = new GoogleGenAI({ apiKey });
                const stringCriticos = top5.map(c => `- ${c.desc} (Pérdida: ${c.i} ARS, Cantidad: ${c.u} unidades)`).join('\n');

                const prompt = `Actúa como un experto Gerente de Operaciones y Control de Gestión de Retail. 
Analiza este top 5 de artículos con mayor pérdida en el supermercado:
${stringCriticos}

Genera exactamente 5 estrategias operativas reales y de alta efectividad para mitigar estas pérdidas en góndola.
Devuelve la respuesta ÚNICAMENTE como un array JSON válido de JavaScript (sin texto explicativo, sin markdown \`\`\`json, solo el string plano). El formato del array debe ser una matriz de strings de 5 columnas por cada fila:
[
  ["Acción estratégica corta", "Metodología detallada de implementación en tienda", "Recursos, checklists o herramientas específicas", "Plazo sugerido (Inmediato, 7 días, 15 días)", "Responsable (Jefe de Sector, Recepción, Cajas)"],
  ...
]`;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                });

                const textoLimpio = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                filasPlanDeAccion = JSON.parse(textoLimpio);
            } catch (aiError) {
                console.error("Fallo del core de IA:", aiError);
                filasPlanDeAccion = Array(5).fill(['Revisar Key de Gemini', 'Error al procesar la respuesta de la IA en Vercel.', '-', '-', '-']);
            }
        } else {

            filasPlanDeAccion = [
                ['[IA Inactiva] Configura GEMINI_API_KEY', 'La inteligencia artificial completará este plan de acción de forma automática.', 'Panel de control de Vercel', 'Inmediato', 'SaaS Admin'],
                ...Array(4).fill(['', '', '', '', ''])
            ];
        }

        while (filasPlanDeAccion.length < 5) {
            filasPlanDeAccion.push(['', '', '', '', '']);
        }

        filasPlanDeAccion.forEach((filaData, i) => {
            const row = h4.addRow(filaData);
            row.height = 60;
            row.eachCell(cell => {
                styleData(cell, i);
                cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
            });
        });

        const buffer = await wb.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Libro_Maestro_Mermas.xlsx');
        return res.status(200).send(buffer);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error interno al compilar el Libro Maestro.' });
    }
};