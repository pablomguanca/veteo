import '../../sass/main.scss';
import { onAuthStateChanged } from 'firebase/auth';
import { inicializarFirebase } from '../firebase/firebase.js';

let usuarioActual = null;

async function inicializarAccesoAdmin() {
    const cuerpo = document.getElementById('admin-cuerpo');
    const pie = document.getElementById('admin-pie');
    const bloqueo = document.getElementById('admin-bloqueo');

    const { auth } = await inicializarFirebase();

    onAuthStateChanged(auth, user => {
        usuarioActual = user;
        const habilitado = Boolean(user);

        if (cuerpo) cuerpo.hidden = !habilitado;
        if (pie) pie.hidden = !habilitado;
        if (bloqueo) bloqueo.hidden = habilitado;
    });
}

export function inicializarAdminCatalogo() {
    const inputArchivo = document.getElementById('archivo-excel');
    const labelArchivo = document.getElementById('label-archivo');
    const btnCargar = document.getElementById('btn-cargar');
    const resultado = document.getElementById('resultado');

    if (!inputArchivo || !btnCargar) return;

    inputArchivo.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            labelArchivo.textContent = `✓ ${e.target.files[0].name}`;
            inputArchivo.classList.add('loaded');
            btnCargar.disabled = false;
        }
    });

    btnCargar.addEventListener('click', async () => {
        const archivo = inputArchivo.files[0];
        const colEan = document.getElementById('col-ean').value.trim();
        const colDesc = document.getElementById('col-desc').value.trim();
        const colSec = document.getElementById('col-sec').value.trim();
        const colCosto = document.getElementById('col-costo').value.trim();

        if (!archivo || !colEan || !colDesc) {
            Swal.fire({
                icon: 'warning',
                title: 'Faltan datos',
                text: 'El archivo, la columna EAN y la columna Descripción son obligatorios.',
            });
            return;
        }

        const confirm = await Swal.fire({
            title: '¿Cargar catálogo?',
            html: `<p>Archivo: <strong>${archivo.name}</strong></p>
                                <p>Los productos existentes se actualizarán, los nuevos se agregarán.</p>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cargar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#6ee7b7',
        });

        if (!confirm.isConfirmed) return;

        btnCargar.disabled = true;
        btnCargar.textContent = 'Cargando...';
        resultado.hidden = true;
        resultado.className = 'admin-result';

        Swal.fire({
            title: 'Procesando...',
            html: 'Subiendo productos al catálogo de Firestore.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
        });

        try {
            const archivoBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result.split(',')[1]);
                reader.readAsDataURL(archivo);
            });

            if (!usuarioActual) throw new Error('Iniciá sesión para cargar el catálogo.');
            const token = await usuarioActual.getIdToken();

            const res = await fetch('/api/cargar-catalogo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    archivoBase64,
                    nombreColumnaEan: colEan,
                    nombreColumnaDesc: colDesc,
                    nombreColumnaSec: colSec || null,
                    nombreColumnaCosto: colCosto || null,
                }),
            });

            const data = await res.json();
            Swal.close();

            if (data.ok) {
                resultado.textContent = `✓ ${data.procesados} productos cargados correctamente al catálogo.`;
                resultado.classList.add('admin-result--ok');
                resultado.hidden = false;
                Swal.fire({
                    icon: 'success',
                    title: 'Catálogo cargado',
                    text: `${data.procesados} productos procesados.`,
                    confirmButtonColor: '#6ee7b7',
                });
            } else {
                throw new Error(data.error || 'Error desconocido');
            }

        } catch (err) {
            Swal.close();
            resultado.textContent = `Error: ${err.message}`;
            resultado.classList.add('admin-result--error');
            resultado.hidden = false;
        } finally {
            btnCargar.disabled = false;
            btnCargar.textContent = 'Cargar al catálogo';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    inicializarAccesoAdmin();
    inicializarAdminCatalogo();
});