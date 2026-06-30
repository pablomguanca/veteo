import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { obtenerConfiguracion } from '../modules/config.js';

let _auth = null;
let _db = null;

export async function inicializarFirebase() {
    if (_auth && _db) return { auth: _auth, db: _db };

    const config = await obtenerConfiguracion();

    const app = getApps().length === 0
        ? initializeApp(config.firebase)
        : getApps()[0];

    _auth = getAuth(app);
    _db = getFirestore(app);

    return { auth: _auth, db: _db };
}

export function getAuthInstance() { return _auth; }
export function getFirestoreInstance() { return _db; }