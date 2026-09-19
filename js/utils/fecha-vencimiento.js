export function parsearFecha(cadena) {
    if (!cadena) return null;
    const s = String(cadena).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [d, m, a] = s.split('/');
        return new Date(`${a}-${m}-${d}T00:00:00`);
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.slice(0, 10) + 'T00:00:00');
    const f = new Date(s);
    return isNaN(f) ? null : f;
}

export function formatearVencimiento(cadena) {
    const f = parsearFecha(cadena);
    if (!f) return cadena;
    return f.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatearVencimientoCorto(cadena) {
    const f = parsearFecha(cadena);
    if (!f) return cadena;
    return f.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
