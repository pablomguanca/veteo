function obtenerHoraActual() {
    const ahora = new Date();
    return {
        dia: ahora.getDay(),
        hora: ahora.getHours(),
        minuto: ahora.getMinutes(),
        minutosTotales: ahora.getHours() * 60 + ahora.getMinutes(),
    };
}

function calcularMinutos(horas, minutos = 0) {
    return horas * 60 + minutos;
}

const REGLAS_FORMULARIOS = {
    pch: ({ dia }) => dia >= 1 && dia <= 5,
    formPas: () => true,
    accEspeciales: ({ dia, minutosTotales }) => {
        if (dia === 6 || dia === 0) return true;
        if (dia === 5) return minutosTotales >= calcularMinutos(16, 0);
        if (dia === 1) return minutosTotales < calcularMinutos(9, 0);
        return false;
    },
    formPft: ({ dia, minutosTotales }) => {
        if (dia === 4) return minutosTotales < calcularMinutos(10, 0);
        return true;
    },
    formPftCarnes: () => true,
    ultimaMilla: ({ dia, minutosTotales }) => {
        const apertura = calcularMinutos(15, 0);
        const cierre = calcularMinutos(11, 0);
        if (dia === 6 || dia === 0) return true;
        if (dia >= 1 && dia <= 5) {
            return minutosTotales < cierre || minutosTotales >= apertura;
        }
        return false;
    },
    formCalidad: () => true,
    formMolinos: () => true,
    formLevex: () => true,
    rescates: ({ dia, minutosTotales }) => {
        const cierre = calcularMinutos(9, 0);
        if (dia === 5 || dia === 6 || dia === 0) return true;
        if (dia === 1) return minutosTotales < cierre;
        return false;
    },
};

function crearEtiqueta(activo) {
    const clasePunto = activo ? 'form-dot--active' : 'form-dot--inactive';
    const textoEtiqueta = activo ? 'Abierto' : 'Cerrado';
    return `<span class="form-status-badge">
    <span class="form-dot ${clasePunto}" aria-hidden="true"></span>
    <span class="form-status-label">${textoEtiqueta}</span>
    </span>`;
}

export function inicializarEstadoFormularios() {
    const mapeoFormularios = [
        { texto: 'PCH', regla: 'pch' },
        { texto: 'Form PAS', regla: 'formPas' },
        { texto: 'Form Acciones Especiales', regla: 'accEspeciales' },
        { texto: 'Form PFT', regla: 'formPft' },
        { texto: 'Form PFT Carnes', regla: 'formPftCarnes' },
        { texto: 'Última Milla', regla: 'ultimaMilla' },
        { texto: 'Form Calidad', regla: 'formCalidad' },
        { texto: 'Form Molinos', regla: 'formMolinos' },
        { texto: 'Form Levex', regla: 'formLevex' },
        { texto: 'Formulario Rescates', regla: 'rescates' },
    ];

    const tiempoInicial = obtenerHoraActual();

    document.querySelectorAll('.lcard').forEach(tarjeta => {
        const elementoFuerte = tarjeta.querySelector('strong');
        if (!elementoFuerte) return;

        const coincidencia = mapeoFormularios.find(mapa => elementoFuerte.textContent.trim() === mapa.texto);
        if (!coincidencia) return;

        const estaActivo = REGLAS_FORMULARIOS[coincidencia.regla]?.(tiempoInicial) ?? true;
        elementoFuerte.insertAdjacentHTML('beforeend', crearEtiqueta(estaActivo));
    });

    setInterval(() => {
        document.querySelectorAll('.lcard').forEach(tarjeta => {
            const etiqueta = tarjeta.querySelector('.form-status-badge');
            if (!etiqueta) return;

            const elementoFuerte = tarjeta.querySelector('strong');
            const coincidencia = mapeoFormularios.find(mapa => elementoFuerte?.textContent.trim() === mapa.texto);
            if (!coincidencia) return;

            const tiempoActualizado = obtenerHoraActual();
            const estaActivo = REGLAS_FORMULARIOS[coincidencia.regla]?.(tiempoActualizado) ?? true;

            const punto = etiqueta.querySelector('.form-dot');
            const textoLable = etiqueta.querySelector('.form-status-label');

            punto.className = `form-dot ${estaActivo ? 'form-dot--active' : 'form-dot--inactive'}`;
            textoLable.textContent = estaActivo ? 'Abierto' : 'Cerrado';
        });
    }, 60 * 1000);
}