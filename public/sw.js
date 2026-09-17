importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCWoRSWiOLPL8YJxMV2YDI43jTFBdTxKUA",
    authDomain: "veteo-app-d22d3.firebaseapp.com",
    projectId: "veteo-app-d22d3",
    storageBucket: "veteo-app-d22d3.firebasestorage.app",
    messagingSenderId: "674956796169",
    appId: "1:674956796169:web:848c97f9a1cc1674cb73d8"
});

const mensajeria = firebase.messaging();

const BUILD = '__VETEO_BUILD__';
const NOMBRE_CACHE = `veteo-${BUILD}`;
const URL_OFFLINE = './index.html';

const URLS_PRECACHE = [
    './',
    './index.html',
    './manifest.json',
    '/assets/img/icon-192.png',
    '/assets/img/icon-512.png',
];

function esAssetInmutable(url) {
    return url.pathname.startsWith('/assets/') && /-[A-Za-z0-9_-]{8,}\./.test(url.pathname);
}

async function respuestaDeRed(peticion) {
    const respuesta = await fetch(peticion);
    if (respuesta && respuesta.ok && respuesta.type === 'basic') {
        const cache = await caches.open(NOMBRE_CACHE);
        cache.put(peticion, respuesta.clone());
    }
    return respuesta;
}

async function redPrimero(peticion) {
    try {
        return await respuestaDeRed(peticion);
    } catch (error) {
        const cache = await caches.open(NOMBRE_CACHE);
        const cacheado = await cache.match(peticion);
        if (cacheado) return cacheado;

        if (peticion.mode === 'navigate') {
            const shell = await cache.match(URL_OFFLINE);
            if (shell) return shell;
        }

        throw error;
    }
}

async function cachePrimero(peticion) {
    const cache = await caches.open(NOMBRE_CACHE);
    const cacheado = await cache.match(peticion);
    if (cacheado) return cacheado;
    return respuestaDeRed(peticion);
}

async function revalidarEnSegundoPlano(peticion) {
    const cache = await caches.open(NOMBRE_CACHE);
    const cacheado = await cache.match(peticion);

    const enRed = respuestaDeRed(peticion).catch(() => null);
    if (cacheado) {
        return cacheado;
    }

    const respuesta = await enRed;
    if (respuesta) return respuesta;
    throw new Error('Sin red y sin caché');
}

self.addEventListener('install', (evento) => {
    evento.waitUntil(
        caches.open(NOMBRE_CACHE).then((cache) => cache.addAll(URLS_PRECACHE))
    );
});

self.addEventListener('activate', (evento) => {
    evento.waitUntil(
        caches.keys()
            .then((claves) => Promise.all(
                claves
                    .filter((clave) => clave !== NOMBRE_CACHE)
                    .map((clave) => caches.delete(clave))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (evento) => {
    const peticion = evento.request;

    if (peticion.method !== 'GET') return;
    if (!peticion.url.startsWith('http')) return;
    if (peticion.url.includes('script.google.com')) return;

    const url = new URL(peticion.url);

    if (url.origin !== self.location.origin) return;

    if (peticion.mode === 'navigate') {
        evento.respondWith(redPrimero(peticion));
        return;
    }

    if (esAssetInmutable(url)) {
        evento.respondWith(cachePrimero(peticion));
        return;
    }

    if (url.pathname.endsWith('.html')) {
        evento.respondWith(redPrimero(peticion));
        return;
    }

    evento.respondWith(revalidarEnSegundoPlano(peticion));
});

self.addEventListener('notificationclick', (evento) => {
    evento.notification.close();
    const urlDestino = evento.notification.data?.url || new URL('./', self.location.origin).href;
    evento.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientesVentana) => {
            for (let i = 0; i < clientesVentana.length; i++) {
                const cliente = clientesVentana[i];
                if (cliente.url === urlDestino && 'focus' in cliente) return cliente.focus();
            }
            if (clients.openWindow) return clients.openWindow(urlDestino);
        })
    );
});

mensajeria.onBackgroundMessage((cargaUtil) => {
    const titulo = cargaUtil.notification?.title || 'Veteo App';
    const opciones = {
        body: cargaUtil.notification?.body || 'Tienes una nueva notificación.',
        icon: '/assets/img/icon-512.png'
    };
    self.registration.showNotification(titulo, opciones);
});

self.addEventListener('message', (evento) => {
    if (evento.data && evento.data.type === 'SKIP_WAITING') self.skipWaiting();
});
