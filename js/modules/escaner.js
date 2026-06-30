import { getFirestoreInstance } from '../firebase/firebase.js';
import { doc, getDoc } from 'firebase/firestore';

let lector = null;
let escaneando = false;

async function buscarEnCatalogo(ean) {
    try {
        const snap = await getDoc(doc(getFirestoreInstance(), 'catalogo', ean));
        return snap.exists() ? snap.data() : null;
    } catch {
        return null;
    }
}

async function abrirModalConEAN(ean) {
    const inputEan = document.getElementById('f-producto');
    const inputDesc = document.getElementById('f-descripcion');
    const inputSec = document.getElementById('f-sec');
    const fondoModal = document.getElementById('modal-backdrop');

    if (inputEan) inputEan.value = ean;

    const producto = await buscarEnCatalogo(ean);
    if (producto) {
        if (inputDesc) inputDesc.value = producto.descripcion || '';
        if (inputSec && producto.sec) inputSec.value = producto.sec;
    } else {
        if (inputDesc) inputDesc.value = '';
        if (inputSec) inputSec.value = '';
    }

    if (fondoModal) {
        fondoModal.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    inputEan?.focus();
}

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
                advanced: [{ focusMode: 'continuous' }],
            },
        });

        videoEscaner.srcObject = stream;
        await videoEscaner.play();

        if ('BarcodeDetector' in window) {
            const detector = new window.BarcodeDetector({
                formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
            });

            const bucleEscaneo = async () => {
                if (!escaneando) return;
                try {
                    const codigos = await detector.detect(videoEscaner);
                    if (codigos.length > 0) {
                        detenerEscaneo();
                        await abrirModalConEAN(codigos[0].rawValue);
                        return;
                    }
                } catch { }
                requestAnimationFrame(bucleEscaneo);
            };

            bucleEscaneo();

        } else {
            if (!lector) lector = new window.ZXing.BrowserMultiFormatReader();
            lector.decodeFromVideoDevice(null, videoEscaner, async (resultado) => {
                if (resultado) {
                    detenerEscaneo();
                    await abrirModalConEAN(resultado.text);
                }
            });
        }

    } catch (error) {
        console.error('[Escaner]:', error);
        detenerEscaneo();
    }
}

function detenerEscaneo() {
    const contenedor = document.getElementById('modal-escaner');
    const videoEscaner = document.getElementById('video-camara');
    const botonEscanear = document.getElementById('btn-escanear');

    escaneando = false;

    if (videoEscaner?.srcObject) {
        videoEscaner.srcObject.getTracks().forEach(track => track.stop());
        videoEscaner.srcObject = null;
    }

    if (lector) lector.reset();

    contenedor.hidden = true;
    if (botonEscanear) botonEscanear.disabled = false;
}

export function inicializarEscaner() {
    const botonEscanear = document.getElementById('btn-escanear');
    const botonCerrar = document.getElementById('btn-cerrar-escaner');

    if (!botonEscanear || !botonCerrar) return;

    botonEscanear.addEventListener('click', iniciarEscaneo);
    botonCerrar.addEventListener('click', detenerEscaneo);
}