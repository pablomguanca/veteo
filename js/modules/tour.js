export function iniciarTour() {
    if (localStorage.getItem('veteo_tour_completado') === 'true') {
        return;
    }

    const driver = window.driver.js.driver({
        showProgress: true,
        progressText: '{{current}} de {{total}}',
        nextBtnText: 'Siguiente',
        prevBtnText: 'Anterior',
        doneBtnText: 'Empezar',
        allowClose: true,

        steps: [
            {
                popover: {
                    title: 'Bienvenido a Veteo 🚀',
                    description: 'Te muestro las funciones principales en un minuto.'
                }
            },
            {
                element: '#usuario-info',
                popover: {
                    title: 'Tu perfil',
                    description: 'Desde acá podés ver tu cuenta y cerrar sesión cuando quieras.',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '#today-msg',
                popover: {
                    title: 'Acá empieza tu día',
                    description: 'Revisá la sugerencia del día para empezar tu rutina.',
                    side: "right",
                    align: 'start'
                }
            },
            {
                element: '#quick-chips',
                popover: {
                    title: 'Enlaces rápidos',
                    description: 'Accedé a los links frecuentes que usamos a diario',
                    side: "left",
                    align: 'start'
                }
            },
            {
                element: '#daily-tracker',
                popover: {
                    title: 'Tu actividad del día',
                    description: 'Registro diario de actividad de tu tienda',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '#vdb-import-btn',
                popover: {
                    title: 'Importá tu listado 📄',
                    description: 'Subí el archivo (.TXT) que descargás del GNX por FTP. No hace falta filtrarlo ni ordenarlo.',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '#vdb-status',
                popover: {
                    title: 'Acá aparecen tus productos',
                    description: 'Acá van a listarse tus productos: ordenados por fecha, etiquetado con su etapa (7, 30, 60, 90) y listos para cargar en su form o copiar su EAN',
                    side: "right",
                    align: 'start'
                }
            },
            {
                element: '#add-venc-btn',
                popover: {
                    title: 'Agregá productos a mano',
                    description: 'Ingresá el EAN de cada producto crítico y agregá la info para registrarlo en tu base de datos',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '#btn-escanear',
                popover: {
                    title: 'Escaneá con la cámara',
                    description: 'Activá los permisos de la cámara y leé el código de barras al instante.',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '.stage',
                popover: {
                    title: 'Línea de tiempo',
                    description: 'Guiate con nuestra línea de tiempo operativa para gestionar mejor',
                    side: "left",
                    align: 'start'
                }
            },
            {
                element: '.lcard',
                popover: {
                    title: 'Estado de los formularios',
                    description: 'Observá la luz verde para saber si un form está abierto o cerrado',
                    side: "right",
                    align: 'start'
                }
            },
            {
                element: '#top-list',
                popover: {
                    title: 'Top de EAN más cargados',
                    description: 'Seguí los productos más cargados de la semana como apoyo en tu gestión',
                    side: "left",
                    align: 'start'
                }
            },
            {
                element: '#notif-enable-btn',
                popover: {
                    title: 'Avisos diarios 🛎️',
                    description: 'Activá las notificaciones para enviarte recordatorios todos los días',
                    side: "bottom",
                    align: 'start'
                }
            }
        ],
        onDestroyStarted: () => {
            localStorage.setItem('veteo_tour_completado', 'true');
            driver.destroy();
        }
    });

    driver.drive();
}