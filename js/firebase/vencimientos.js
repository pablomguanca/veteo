import { db } from './firestore.js';
import {
    collection, doc, getDoc, getDocs,
    setDoc, writeBatch, serverTimestamp, query, where
} from 'firebase/firestore';

export async function importarVencimientos(tiendaId, filas) {
    if (!filas || filas.length === 0) throw new Error('No hay filas para importar');

    const vencimientosRef = collection(db, 'tiendas', tiendaId, 'vencimientos');
    const qCargados = query(vencimientosRef, where('estado', '==', 'CARGADO'));
    const snapCargados = await getDocs(qCargados);

    const mapaEstados = {};
    snapCargados.forEach(docSnap => {
        const d = docSnap.data();
        const clave = `${d.ean}__${d.vencimiento}`;
        mapaEstados[clave] = {
            estado: d.estado,
            cargadoEl: d.cargadoEl || null,
        };
    });

    const hoy = new Date().toISOString().split('T')[0];
    const chunks = chunkArray(filas, 490);

    for (const chunk of chunks) {
        const batch = writeBatch(db);

        chunk.forEach(fila => {
            const ean = String(fila.ean || '').trim();
            const vto = String(fila.vencimiento || '').trim();
            const clave = `${ean}__${vto}`;
            const estadoPrevio = mapaEstados[clave];
            const docRef = doc(vencimientosRef, clave);

            batch.set(docRef, {
                po: fila.po || '',
                sec: fila.sec || '',
                ean: ean,
                descripcion: fila.descripcion || '',
                stock: fila.stock || '',
                cantidad: fila.cantidad || '',
                vencimiento: vto,
                estado: estadoPrevio ? estadoPrevio.estado : 'PENDIENTE',
                importadoEl: hoy,
                cargadoEl: estadoPrevio ? estadoPrevio.cargadoEl : null,
            });
        });

        await batch.commit();
    }

    return { ok: true, imported: filas.length };
}

export async function obtenerVencimientos(tiendaId) {
    const vencimientosRef = collection(db, 'tiendas', tiendaId, 'vencimientos');
    const snap = await getDocs(vencimientosRef);

    const rows = [];
    snap.forEach(docSnap => rows.push({ id: docSnap.id, ...docSnap.data() }));

    return rows;
}

export async function actualizarEstado(tiendaId, ean, vencimiento, estado) {
    const clave = `${ean}__${vencimiento}`;
    const docRef = doc(db, 'tiendas', tiendaId, 'vencimientos', clave);
    const docSnap = await getDoc(docRef);

    const hoy = serverTimestamp();

    if (docSnap.exists()) {
        await setDoc(docRef, { estado, cargadoEl: hoy }, { merge: true });
        await registrarHistorial(tiendaId, { ...docSnap.data(), estado });
        return { ok: true };
    }

    const escRef = collection(db, 'tiendas', tiendaId, 'escaneados');
    const qEsc = query(escRef,
        where('ean', '==', ean),
        where('fechaVencimiento', '==', vencimiento)
    );
    const escSnap = await getDocs(qEsc);

    if (!escSnap.empty) {
        const escDoc = escSnap.docs[0];
        await setDoc(escDoc.ref, { estado, cargadoEl: hoy }, { merge: true });
        await registrarHistorial(tiendaId, { ...escDoc.data(), estado });
        return { ok: true };
    }

    throw new Error('Producto no encontrado en ninguna lista');
}

export async function guardarEscaneado(tiendaId, datos) {
    const escRef = collection(db, 'tiendas', tiendaId, 'escaneados');
    const nuevoDoc = doc(escRef);

    await setDoc(nuevoDoc, {
        sec: datos.sec || '',
        ean: datos.ean || '',
        descripcion: datos.descripcion || 'Ingreso manual',
        cantidad: datos.cantidad || 1,
        fechaVencimiento: String(datos.fecha_vencimiento || ''),
        nota: datos.nota || '',
        estado: 'PENDIENTE',
        cargadoEl: null,
    });

    return { ok: true };
}

export async function eliminarEscaneado(tiendaId, ean, fechaVencimiento) {
    const escRef = collection(db, 'tiendas', tiendaId, 'escaneados');
    const q = query(escRef,
        where('ean', '==', ean),
        where('fechaVencimiento', '==', fechaVencimiento)
    );
    const snap = await getDocs(q);

    if (snap.empty) throw new Error('No se encontró el registro para eliminar');

    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    return { ok: true };
}

async function registrarHistorial(tiendaId, datos) {
    const histRef = collection(db, 'tiendas', tiendaId, 'historial');
    const nuevoDoc = doc(histRef);

    await setDoc(nuevoDoc, {
        fechaCarga: serverTimestamp(),
        sec: String(datos.sec || ''),
        ean: String(datos.ean || ''),
        descripcion: String(datos.descripcion || ''),
        vencimiento: String(datos.vencimiento || datos.fechaVencimiento || ''),
        estadoAsignado: String(datos.estado || ''),
    });
}

function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}