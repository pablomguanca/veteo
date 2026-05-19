export function trackearEvento(nombreEvento, parametros = {}) {
    if (typeof window.gtag === 'function') {
        window.gtag('event', nombreEvento, parametros);
        console.log(`[Analytics] Evento enviado: ${nombreEvento}`, parametros);
    }
}