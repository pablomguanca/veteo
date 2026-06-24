export async function enviarCruceRapido() {
    const inputP1 = document.getElementById('inv-periodo-1');
    const inputP2 = document.getElementById('inv-periodo-2');

    if (!inputP1.files[0] || !inputP2.files[0]) {
        Swal.fire({
            icon: 'warning',
            title: 'Faltan archivos',
            text: 'Por favor, selecciona los dos inventarios base para realizar el cruce rápido.',
            confirmButtonColor: '#1F3864'
        });
        return;
    }

    const leerTexto = (file) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsText(file, 'ISO-8859-1');
    });

    const textoPeriodo1 = await leerTexto(inputP1.files[0]);
    const textoPeriodo2 = await leerTexto(inputP2.files[0]);

    const payload = {
        inventarioPeriodo1: textoPeriodo1,
        inventarioPeriodo2: textoPeriodo2
    };

    try {
        Swal.fire({
            title: 'Cruzando inventarios...',
            text: 'Procesando miles de filas a la velocidad de la luz',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const respuesta = await fetch('/api/cruce-rapido', {
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

        Swal.fire({
            icon: 'success',
            title: '¡Cruce completado!',
            text: 'El Excel se ha descargado correctamente.',
            timer: 3000,
            showConfirmButton: false
        });

        inputP1.value = '';
        inputP2.value = '';
        const labelP1 = document.querySelector(`label[for="inv-periodo-1"]`);
        const labelP2 = document.querySelector(`label[for="inv-periodo-2"]`);
        if(labelP1) labelP1.innerHTML = 'Seleccionar Inventario Período 1';
        if(labelP2) labelP2.innerHTML = 'Seleccionar Inventario Período 2';

    } catch (error) {
        console.error("Error en cruce rápido:", error);
        Swal.fire({
            icon: 'error',
            title: 'Error del servidor',
            text: 'Hubo un problema al generar el cruce de inventarios.',
            confirmButtonColor: '#1F3864'
        });
    }
}

export async function enviarLoteMermas() {
    const inputLote = document.getElementById('analytics-lote');
    
    if (!inputLote || inputLote.files.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Lote vacío',
            text: 'Por favor, selecciona o arrastra al menos un archivo .txt del GNX para mermas.',
            confirmButtonColor: '#1F3864'
        });
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
        Swal.fire({
            title: 'Veteo AI Core trabajando...',
            html: 'Tabulando mermas y <b>Gemini</b> está redactando el Plan de Acción',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

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

        Swal.fire({
            icon: 'success',
            title: '¡Libro Maestro Generado!',
            text: 'Tu reporte inteligente con IA está listo.',
            confirmButtonColor: '#1F3864'
        });

        inputLote.value = '';
        const textDropzone = document.getElementById('dropzone-text');
        if(textDropzone) {
            textDropzone.innerHTML = `
                <svg class="dashboard-reports__icon-dropzone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span class="dashboard-reports__dropzone-text">Arrastra múltiples archivos .txt o haz clic para buscarlos</span>
            `;
        }

    } catch (error) {
        console.error("Error al compilar lote:", error);
        Swal.fire({
            icon: 'error',
            title: '¡Ups!',
            text: 'Hubo un error al compilar el Libro Maestro en el servidor.',
            confirmButtonColor: '#1F3864'
        });
    }
}

export function inicializarReportes() {
    // 1. Listeners de botones de ejecución
    const btnCruce = document.getElementById('btn-procesar-cruce-rapido');
    if (btnCruce) btnCruce.addEventListener('click', enviarCruceRapido);

    const btnConsolidado = document.getElementById('btn-procesar-consolidado');
    if (btnConsolidado) btnConsolidado.addEventListener('click', enviarLoteMermas);

    const actualizarEtiquetaCruce = (e) => {
        const input = e.target;
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label && input.files.length > 0) {
            label.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D6A39" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span style="color: #1D6A39; margin-left: 8px; vertical-align: middle;">Archivo cargado: <strong>${input.files[0].name}</strong></span>
            `;
        }
    };

    const inputP1 = document.getElementById('inv-periodo-1');
    const inputP2 = document.getElementById('inv-periodo-2');
    if (inputP1) inputP1.addEventListener('change', actualizarEtiquetaCruce);
    if (inputP2) inputP2.addEventListener('change', actualizarEtiquetaCruce);
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