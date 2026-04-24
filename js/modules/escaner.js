let lector = null;
let escaneando = false;

async function iniciarEscaneo() {
    if (escaneando) return;

    if (!lector) {
        const hints = new Map();
        const formatos = [
            window.ZXing.BarcodeFormat.EAN_13,
            window.ZXing.BarcodeFormat.EAN_8,
            window.ZXing.BarcodeFormat.UPC_A,
            window.ZXing.BarcodeFormat.UPC_E,
            window.ZXing.BarcodeFormat.CODE_128
        ];
        hints.set(window.ZXing.DecodeHintType.POSSIBLE_FORMATS, formatos);
        
        lector = new window.ZXing.BrowserMultiFormatReader(hints);
    }

    const contenedor = document.getElementById('modal-escaner');
    const videoEscaner = document.getElementById('video-camara');
    const botonEscanear = document.getElementById('btn-escanear');

    escaneando = true;
    contenedor.hidden = false;

    if (botonEscanear) {
        botonEscanear.disabled = true;
    }

    try {
        await lector.decodeFromConstraints(
            { 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    advanced: [{ focusMode: "continuous" }]
                } 
            },
            videoEscaner,
            (resultado, error) => {
                if (resultado) {
                    detenerEscaneo();
                    abrirModalConEAN(resultado.text);
                }
            }
        );
    } catch (error) {
        console.error(error);
        detenerEscaneo();
    }
}

function detenerEscaneo() {
    const contenedor = document.getElementById('modal-escaner');
    const videoEscaner = document.getElementById('video-camara');
    const botonEscanear = document.getElementById('btn-escanear');

    if (lector) {
        lector.reset();
    }

    if (videoEscaner && videoEscaner.srcObject) {
        videoEscaner.srcObject.getTracks().forEach(track => track.stop());
        videoEscaner.srcObject = null;
    }

    escaneando = false;
    contenedor.hidden = true;

    if (botonEscanear) {
        botonEscanear.disabled = false;
    }
}

function abrirModalConEAN(ean) {
    const inputProducto = document.getElementById('f-producto');

    const fondoModal = document.getElementById('modal-backdrop');

    if (inputProducto) {
        inputProducto.value = ean;
    }

    if (fondoModal) {
        fondoModal.hidden = false;
        document.body.style.overflow = 'hidden';

        inputProducto?.focus();
    }
}

export function inicializarEscaner() {
    const botonEscanear = document.getElementById('btn-escanear');
    const botonCerrar = document.getElementById('btn-cerrar-escaner');

    if (!botonEscanear || !botonCerrar) return;

    botonEscanear.addEventListener('click', iniciarEscaneo);
    botonCerrar.addEventListener('click', detenerEscaneo);
}