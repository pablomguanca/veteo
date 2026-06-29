import { db, auth } from './firestore.js';
import {
    doc, getDoc, setDoc, serverTimestamp
} from 'firebase/firestore';

export async function verificarUsuarioPermitido(email) {
    const ref = doc(db, 'permitidos', email.toLowerCase().trim());
    const snap = await getDoc(ref);
    return snap.exists() && snap.data().habilitado === true;
}

export async function obtenerOCrearTienda(uid, email, tiendaId) {
    const usuarioRef = doc(db, 'usuarios', uid);
    const usuarioSnap = await getDoc(usuarioRef);

    if (usuarioSnap.exists()) {
        return usuarioSnap.data().tiendaId;
    }

    await setDoc(usuarioRef, {
        email: email.toLowerCase().trim(),
        tiendaId: tiendaId,
        nombre: '',
        foto: '',
        fcmToken: '',
        creadoEl: serverTimestamp(),
    });

    const tiendaRef = doc(db, 'tiendas', tiendaId);
    const tiendaSnap = await getDoc(tiendaRef);

    if (!tiendaSnap.exists()) {
        await setDoc(tiendaRef, {
            nombre: `Tienda ${tiendaId}`,
            creadaEl: serverTimestamp(),
        });
    }

    return tiendaId;
}

export async function actualizarPerfil(uid, nombre, foto) {
    const ref = doc(db, 'usuarios', uid);
    await setDoc(ref, { nombre, foto }, { merge: true });
}

export async function getTiendaId(uid) {
    const ref = doc(db, 'usuarios', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Usuario no registrado');
    return snap.data().tiendaId;
}