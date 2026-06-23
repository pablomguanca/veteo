export async function enviarCruceRapido() {
    const inputP1 = document.getElementById('inv-periodo-1').files[0];
    const inputP2 = document.getElementById('inv-periodo-2').files[0];

    if (!inputP1 || !inputP2) {
        alert("Por favor, selecciona los dos inventarios base para realizar el cruce rápido.");
        return;
    }

    const leerTexto = (file) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsText(file, 'ISO-8859-1');
    });

    const textoPeriodo1 = await leerTexto(inputP1);
    const textoPeriodo2 = await leerTexto(inputP2);

    const payload = {
        inventarioPeriodo1: textoPeriodo1,
        inventarioPeriodo2: textoPeriodo2
    };

    try {
        if (typeof mostrarSpinner === 'function') mostrarSpinner(true);

        const respuesta = await fetch('/api/procesar-merma', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!respuesta.ok) throw new Error("Error en el servidor");

        const blobExcel = await respuesta.blob();
        const urlDescarga = window.URL.createObjectURL(blobExcel);
        const link = document.createElement('a');
        link.href = urlDescarga;
        link.download = `Cruce_de_Inventarios.xlsx`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(urlDescarga);

    } catch (error) {
        console.error("Error en cruce rápido:", error);
        alert("Hubo un problema al generar el cruce de inventarios.");
    } finally {
        if (typeof mostrarSpinner === 'function') mostrarSpinner(false);
    }
}

export async function enviarLoteMermas() {
    const inputLote = document.getElementById('analytics-lote');

    if (!inputLote || inputLote.files.length === 0) {
        alert("Por favor, selecciona o arrastra al menos un archivo .txt del GNX para mermas.");
        return;
    }

    const archivosPayload = [];

    const leerArchivoAsText = (file) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ nombre: file.name, contenido: e.target.result });
        reader.readAsText(file, 'ISO-8859-1');
    });

    for (const file of inputLote.files) {
        const archivoParseado = await leerArchivoAsText(file);
        archivosPayload.push(archivoParseado);
    }

    try {
        if (typeof mostrarSpinner === 'function') mostrarSpinner(true);

        const respuesta = await fetch('/api/procesar-merma', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archivos: archivosPayload })
        });

        if (!respuesta.ok) throw new Error("Error en el servidor");

        const blobExcel = await respuesta.blob();
        const urlDescarga = window.URL.createObjectURL(blobExcel);
        const link = document.createElement('a');
        link.href = urlDescarga;
        link.download = `Libro_Maestro_Mermas_Veteo.xlsx`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(urlDescarga);

    } catch (error) {
        console.error("Error al compilar lote:", error);
        alert("Hubo un error al procesar el lote en el servidor.");
    } finally {
        if (typeof mostrarSpinner === 'function') mostrarSpinner(false);
    }
}

export function inicializarReportes() {
    const btnCruce = document.getElementById('btn-procesar-cruce-rapido');
    if (btnCruce) {
        btnCruce.addEventListener('click', enviarCruceRapido);
    }

    const btnConsolidado = document.getElementById('btn-procesar-consolidado');
    if (btnConsolidado) {
        btnConsolidado.addEventListener('click', enviarLoteMermas);
    }
    const inputLote = document.getElementById('analytics-lote');
    const textDropzone = document.getElementById('dropzone-text');

    if (inputLote && textDropzone) {
        inputLote.addEventListener('change', (e) => {
            const total = e.target.files.length;

            if (total === 1) {
                textDropzone.innerHTML = `
            <div class="dashboard-reports__dropzone-result">
                <svg class="dashboard-reports__icon-file dashboard-reports__icon-file--violet" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span><strong>Archivo cargado:</strong> ${e.target.files[0].name}</span>
            </div>
        `;
            } else if (total > 1) {
                textDropzone.innerHTML = `
            <div class="dashboard-reports__dropzone-result">
                <svg class="dashboard-reports__icon-file dashboard-reports__icon-file--violet" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 21h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2" />
                    <path d="M14.5 7H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V12.5L14.5 7z"/>
                    <polyline points="14 7 14 13 20 13"/>
                </svg>
                <span><strong>Lote listo:</strong> ${total} archivos detectados</span>
            </div>
        `;
            } else {
                textDropzone.innerHTML = `
            <svg class="dashboard-reports__icon-dropzone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span class="dashboard-reports__dropzone-text">Arrastra múltiples archivos .txt o haz clic para buscarlos</span>
        `;
            }
        });
    }
}