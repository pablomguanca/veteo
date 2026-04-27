let lector = null;
let escaneando = false;

async function iniciarEscaneo() {
    if (escaneando) return;

    const contenedor = document.getElementById('modal-escaner');
    const videoEscaner = document.getElementById('video-camara');
    const botonEscanear = document.getElementById('btn-escanear');

    escaneando = true;
    contenedor.hidden = false;
    if (botonEscanear) botonEscanear.disabled = true;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                advanced: [{ focusMode: "continuous" }]
            }
        });

        videoEscaner.srcObject = stream;
        await videoEscaner.play();

        if ('BarcodeDetector' in window) {
            const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });

            const bucleEscaneo = async () => {
                if (!escaneando) return;
                try {
                    const codigos = await detector.detect(videoEscaner);
                    if (codigos.length > 0) {
                        detenerEscaneo();
                        abrirModalConEAN(codigos[0].rawValue);
                        return;
                    }
                } catch (e) {
                }
                requestAnimationFrame(bucleEscaneo);
            };

            bucleEscaneo();

        } else {
            if (!lector) lector = new window.ZXing.BrowserMultiFormatReader();
            lector.decodeFromVideoDevice(null, videoEscaner, (resultado, error) => {
                if (resultado) {
                    detenerEscaneo();
                    abrirModalConEAN(resultado.text);
                }
            });
        }

    } catch (error) {
        console.error(error);
        detenerEscaneo();
    }
}

function detenerEscaneo() {
    const contenedor = document.getElementById('modal-escaner');
    const videoEscaner = document.getElementById('video-camara');
    const botonEscanear = document.getElementById('btn-escanear');

    escaneando = false;

    if (videoEscaner && videoEscaner.srcObject) {
        videoEscaner.srcObject.getTracks().forEach(track => track.stop());
        videoEscaner.srcObject = null;
    }

    if (lector) lector.reset();

    contenedor.hidden = true;
    if (botonEscanear) botonEscanear.disabled = false;
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