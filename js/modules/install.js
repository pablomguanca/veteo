let promptInstalacion = null;

export function inicializarInstaladorPWA() {
    const btnInstalar = document.getElementById('btn-install-pwa');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        promptInstalacion = e;
        if (btnInstalar) btnInstalar.hidden = false;
    });

    btnInstalar?.addEventListener('click', async () => {
        if (!promptInstalacion) return;

        promptInstalacion.prompt();
        const { outcome } = await promptInstalacion.userChoice;

        if (outcome === 'accepted') {
            btnInstalar.hidden = true;
        }
        promptInstalacion = null;
    });

    window.addEventListener('appinstalled', () => {
        if (btnInstalar) btnInstalar.hidden = true;
        promptInstalacion = null;
    });
}