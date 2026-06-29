import { db } from './firestore.js';
import {
    collection, getDocs, query,
    where, orderBy, limit, Timestamp
} from 'firebase/firestore';

export async function obtenerTopUsuarios() {
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    const tsLimite = Timestamp.fromDate(hace7Dias);
    const usuariosSnap = await getDocs(collection(db, 'usuarios'));
    const ranking = [];

    for (const usuDoc of usuariosSnap.docs) {
        const { tiendaId, nombre, foto, email } = usuDoc.data();
        if (!tiendaId) continue;

        const histRef = collection(db, 'tiendas', tiendaId, 'historial');
        const q = query(histRef, where('fechaCarga', '>=', tsLimite));
        const histSnap = await getDocs(q);

        if (histSnap.size > 0) {
            ranking.push({
                email,
                nombre: nombre || email,
                foto: foto || '',
                cargas: histSnap.size,
            });
        }
    }

    return ranking.sort((a, b) => b.cargas - a.cargas);
}

export async function obtenerTopProductos() {
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    const tsLimite = Timestamp.fromDate(hace7Dias);

    const tiendasSnap = await getDocs(collection(db, 'tiendas'));
    const conteo = {};

    for (const tiendaDoc of tiendasSnap.docs) {
        const histRef = collection(db, 'tiendas', tiendaDoc.id, 'historial');
        const q = query(histRef, where('fechaCarga', '>=', tsLimite));
        const histSnap = await getDocs(q);

        histSnap.forEach(d => {
            const { ean, descripcion, sec } = d.data();
            if (!ean) return;
            if (!conteo[ean]) conteo[ean] = { ean, descripcion, sec, total: 0 };
            conteo[ean].total++;
        });
    }

    return Object.values(conteo)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
}