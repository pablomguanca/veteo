let _config = null;

export async function obtenerConfiguracion() {
    if (_config) return _config;

    try {
        const res = await fetch('/api/get-config');
        _config = await res.json();
        return _config;
    } catch {
        _config = {
            firebase: {
                apiKey: "",
                authDomain: "",
                projectId: "",
                storageBucket: "",
                messagingSenderId: "",
                appId: "",
            },
            vapidKey: "",
        };
        return _config;
    }
}

export function obtenerConfiguracionSync() {
    return _config;
}

export const formatearEmailTienda = (id) => `tienda${id}@veteo.app`;
export const formatearPasswordTienda = (id) => `V-${id}APP`;