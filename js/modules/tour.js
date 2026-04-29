export function iniciarTour() {
    if (localStorage.getItem('veteo_tour_completado') === 'true') {
        return;
    }

    const driver = window.driver.js.driver({
        showProgress: true,
        progressText: '{{current}} de {{total}}',
        nextBtnText: 'Siguiente',
        prevBtnText: 'Anterior',
        doneBtnText: '¡Empezar!',
        allowClose: false,

        steps: [
            {
                popover: {
                    title: '¡Bienvenido a Veteo! 🚀',
                    description: 'Te vamos a guiar por las funciones principales de la plataforma. ¡Empecemos!'
                }
            },
            {
                element: '#usuario-info',
                popover: {
                    title: 'Menú de perfil 👤',
                    description: 'Desde acá podés ver tu cuenta y cerrar sesión cuando quieras.',
                    side: "left",
                    align: 'start'
                }

            },
            {
                element: '#vdb-import-btn',
                popover: {
                    title: 'Importar Vencimientos 📥',
                    description: 'Desde acá vas a poder subir el archivo TXT que descargás de GNX a través de FTP.',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '.vdb-row',
                popover: {
                    title: 'Listado de VTO 🔥',
                    description: 'Acá vas a ver todos los productos y podés cargarlos directamente o copiar su EAN a golpe de click',
                    side: "left",
                    align: 'start'
                }
            }
        ],
        onDestroyStarted: () => {
            if (!driver.hasNextStep() || confirm("¿Seguro que querés saltear el tutorial?")) {
                localStorage.setItem('veteo_tour_completado', 'true');
                driver.destroy();
            }
        }
    });

    driver.drive();
}