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

const NOMBRE_CACHE = 'veteo-v1';
const URLS_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './css/styles.css',
    './js/app.js',
    './js/modules/config.js',
    './js/modules/checklist.js',
    './js/modules/enlaces.js',
    './js/modules/estado-formularios.js',
    './js/modules/fecha.js',
    './js/modules/google-auth.js',
    './js/modules/mensaje-diario.js',
    './js/modules/notificaciones.js',
    './js/modules/sw-register.js',
    './js/modules/vencimientos.js',
    './js/modules/vencimientos-db.js',
    './assets/img/icon-192.png',
    './assets/img/icon-512.png'
];

self.addEventListener('install', (evento) => {
    evento.waitUntil(
        caches.open(NOMBRE_CACHE).then((cache) => cache.addAll(URLS_CACHE))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
    evento.waitUntil(
        caches.keys().then((claves) =>
            Promise.all(
                claves
                    .filter((clave) => clave !== NOMBRE_CACHE)
                    .map((clave) => caches.delete(clave))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (evento) => {
    if (evento.request.method !== 'GET') return;
    if (!evento.request.url.startsWith('http')) return;
    if (evento.request.url.includes('script.google.com')) return;

    evento.respondWith(
        caches.match(evento.request).then((cacheado) => {
            if (cacheado) return cacheado;

            return fetch(evento.request).then((respuesta) => {
                if (!respuesta || respuesta.status !== 200 || respuesta.type !== 'basic') {
                    return respuesta;
                }

                const clon = respuesta.clone();
                caches.open(NOMBRE_CACHE).then((cache) => cache.put(evento.request, clon));
                return respuesta;
            });
        })
    );
});

self.addEventListener('notificationclick', (evento) => {
    evento.notification.close();

    const urlDestino = evento.notification.data?.url || new URL('./', self.location.origin).href;

    evento.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientesVentana) => {
            for (let i = 0; i < clientesVentana.length; i++) {
                const cliente = clientesVentana[i];
                if (cliente.url === urlDestino && 'focus' in cliente) {
                    return cliente.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlDestino);
            }
        })
    );
});

mensajeria.onBackgroundMessage((cargaUtil) => {
    const titulo = cargaUtil.notification?.title || 'Veteo App';
    const opciones = {
        body: cargaUtil.notification?.body || 'Tienes una nueva notificación.',
        icon: './assets/img/icon-512.png'
    };
    self.registration.showNotification(titulo, opciones);
});