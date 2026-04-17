export function inicializarFecha() {
    const elementoFecha = document.getElementById('live-date');
    if (!elementoFecha) return;

    function mostrarFecha() {
        const ahora = new Date();
        elementoFecha.textContent = ahora.toLocaleDateString('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    }

    mostrarFecha();

    function programarActualizacionMedianoche() {
        const ahora = new Date();
        const medianoche = new Date(ahora);
        medianoche.setHours(24, 0, 0, 0);
        const milisegundosFaltantes = medianoche - ahora;

        setTimeout(() => {
            mostrarFecha();
            setInterval(mostrarFecha, 24 * 60 * 60 * 1000);
        }, milisegundosFaltantes);
    }

    programarActualizacionMedianoche();
}