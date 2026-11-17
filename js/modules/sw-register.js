const INTERVALO_CHEQUEO_MS = 15 * 60 * 1000;

export async function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    if (!import.meta.env.PROD) {
        const registros = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registros.map(registro => registro.unregister()));
        const claves = await caches.keys();
        await Promise.all(claves.map(clave => caches.delete(clave)));
        return;
    }

    const habiaControlador = Boolean(navigator.serviceWorker.controller);
    let refrescando = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!habiaControlador || refrescando) return;
        refrescando = true;
        window.location.reload();
    });

    try {
        const registro = await navigator.serviceWorker.register('./sw.js', {
            scope: './',
            updateViaCache: 'none',
        });

        const activarSiEspera = (trabajador) => {
            if (trabajador && navigator.serviceWorker.controller) {
                trabajador.postMessage({ type: 'SKIP_WAITING' });
            }
        };

        activarSiEspera(registro.waiting);

        registro.addEventListener('updatefound', () => {
            const nuevoTrabajador = registro.installing;
            nuevoTrabajador?.addEventListener('statechange', () => {
                if (nuevoTrabajador.state === 'installed') activarSiEspera(nuevoTrabajador);
            });
        });

        let ultimoChequeo = 0;
        const buscarActualizacion = () => {
            if (!navigator.onLine) return;
            const ahora = Date.now();
            if (ahora - ultimoChequeo < 30 * 1000) return;
            ultimoChequeo = ahora;
            registro.update().catch(() => {});
        };

        buscarActualizacion();

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') buscarActualizacion();
        });
        window.addEventListener('focus', buscarActualizacion);
        window.addEventListener('online', buscarActualizacion);
        setInterval(buscarActualizacion, INTERVALO_CHEQUEO_MS);

        console.log('[Veteo] Service Worker registrado:', registro.scope);
    } catch (error) {
        console.warn('[Veteo] Error al registrar Service Worker:', error);
    }
}
