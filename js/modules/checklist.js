const CLAVE_ALMACENAMIENTO = 'veteo_checklist_v1';
const TOTAL_ITEMS = 3;

export function inicializarChecklist() {
    const elementoRelleno = document.getElementById('prog-fill');
    const elementoTexto = document.getElementById('prog-txt');
    const barraProgreso = document.getElementById('prog-bar');
    const items = document.querySelectorAll('.ci');
    const botonReinicio = document.getElementById('reset-btn');

    if (!elementoRelleno || !items.length) return;

    function cargarEstado() {
        try {
            const datosCrudos = localStorage.getItem(CLAVE_ALMACENAMIENTO);
            return datosCrudos ? JSON.parse(datosCrudos) : {};
        } catch {
            return {};
        }
    }

    function guardarEstado(estado) {
        localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(estado));
    }

    function verificarReinicioDiario() {
        const hoy = new Date().toDateString();
        const ultimaVisita = localStorage.getItem('veteo_ultima_visita');
        if (ultimaVisita !== hoy) {
            localStorage.removeItem(CLAVE_ALMACENAMIENTO);
            localStorage.setItem('veteo_ultima_visita', hoy);
            return true;
        }
        return false;
    }

    function contarSeleccionados() {
        return [...document.querySelectorAll('.ci input')].filter(checkbox => checkbox.checked).length;
    }

    function actualizarBarra(cantidad) {
        const porcentaje = (cantidad / TOTAL_ITEMS) * 100;
        elementoRelleno.style.width = `${porcentaje}%`;
        elementoTexto.textContent = `${cantidad} / ${TOTAL_ITEMS}`;
        if (barraProgreso) {
            barraProgreso.setAttribute('aria-valuenow', cantidad);
        }
    }

    function limpiarTodo() {
        items.forEach(item => {
            item.querySelector('input').checked = false;
        });
        localStorage.removeItem(CLAVE_ALMACENAMIENTO);
        actualizarBarra(0);
    }

    const fueReiniciado = verificarReinicioDiario();
    const estadoActual = fueReiniciado ? {} : cargarEstado();
    let cantidadSeleccionada = 0;

    items.forEach(item => {
        const checkbox = item.querySelector('input');
        const identificador = item.dataset.id;

        if (estadoActual[identificador]) {
            checkbox.checked = true;
            cantidadSeleccionada++;
        }

        checkbox.addEventListener('change', () => {
            const estado = cargarEstado();
            estado[identificador] = checkbox.checked;
            guardarEstado(estado);
            actualizarBarra(contarSeleccionados());
        });
    });

    actualizarBarra(cantidadSeleccionada);
    botonReinicio?.addEventListener('click', limpiarTodo);
}