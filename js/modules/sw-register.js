export async function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    try {
        const registro = await navigator.serviceWorker.register('./sw.js', {
            scope: './',
        });

        let refrescando = false;

        navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => {
                if (!refrescando) {
                    window.location.reload();
                    refrescando = true;
                }
            }
        );

        registro.addEventListener('updatefound', () => {
            const nuevoTrabajador = registro.installing;

            nuevoTrabajador?.addEventListener('statechange', () => {
                if (
                    nuevoTrabajador.state === 'installed' &&
                    navigator.serviceWorker.controller
                ) {
                    console.log(
                        '[Veteo] Nueva versión disponible. Instalando automáticamente...'
                    );

                    nuevoTrabajador.postMessage({
                        type: 'SKIP_WAITING',
                    });
                }
            });
        });

        console.log(
            '[Veteo] Service Worker registrado:',
            registro.scope
        );
    } catch (error) {
        console.warn(
            '[Veteo] Error al registrar Service Worker:',
            error
        );
    }
}