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
                    description: 'Te voy a guiar por las funciones principales de la plataforma. ¡Empecemos!'
                }
            },
            {
                element: '#usuario-info',
                popover: {
                    title: 'Menú de perfil 👤',
                    description: 'Desde acá podés ver tu cuenta y cerrar sesión cuando quieras.',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '#today-msg',
                popover: {
                    title: 'Aquí empieza tu día ☕',
                    description: 'Revisá la sugerencia del día para empezar tu rutina.',
                    side: "right",
                    align: 'start'
                }
            },
            {
                element: '#quick-chips',
                popover: {
                    title: 'Enlaces rápidos 🔗',
                    description: 'Accedé a los links frecuentes que usamos a diario',
                    side: "left",
                    align: 'start'
                }
            },
            {
                element: '#checklist',
                popover: {
                    title: 'Tu checklist personal ✅',
                    description: 'Registrá el paso a paso de tu recorrida',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '#vdb-import-btn',
                popover: {
                    title: 'Importá tu listado de Vencimientos 📄',
                    description: 'Subí el archivo (.TXT) que descargás del GNX a través de FTP ¡sin filtrar ni ordenar previamente!😉',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '.vdb-row',
                popover: {
                    title: 'Donde sucede la magia ✨',
                    description: 'Acá van a listarse tus productos: ordenados por fecha, etiquetado con su etapa (7, 30, 60, 90) y listos para cargar en su form o copiar su EAN',
                    side: "right",
                    align: 'start'
                }
            },
            {
                element: '#add-venc-btn',
                popover: {
                    title: 'Capturá productos críticos 📋',
                    description: 'Ingresá el EAN de cada producto crítico y agregá la info para registrarlo en tu base de datos',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '#btn-escanear',
                popover: {
                    title: 'Escaneá próximos a vencer 📸',
                    description: 'También podés usar el scanner: activá los permisos de la cámara y escaneá ⚡',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '.stage',
                popover: {
                    title: 'Línea de Tiempo ⏳',
                    description: 'Guiate con nuestra línea de tiempo operativa para gestionar mejor',
                    side: "left",
                    align: 'start'
                }
            },
            {
                element: '.lcard',
                popover: {
                    title: 'Conocé el estado de los formularios 🟢',
                    description: 'Observá la luz verde para saber si un form está abierto o cerrado',
                    side: "right",
                    align: 'start'
                }
            },
            {
                element: '#notif-enable-btn',
                popover: {
                    title: 'Recibí notificaciones diarias! 🛎️',
                    description: 'Activá las notificaciones para enviarte recordatorios todos los días',
                    side: "bottom",
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