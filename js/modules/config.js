export async function obtenerConfiguracion() {
    let _config = null;
    if (_config) return _config;

    if (import.meta.env.VITE_FIREBASE_API_KEY) {
        _config = {
            firebase: {
                apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
                authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
                projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
                storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
                messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
                appId:             import.meta.env.VITE_FIREBASE_APP_ID,
            },
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        };
        return _config;
    }

    try {
        const res = await fetch('/api/get-config');
        _config = await res.json();
        return _config;
    } catch {
        _config = {
            firebase: {
                apiKey: '', authDomain: '', projectId: '',
                storageBucket: '', messagingSenderId: '', appId: '',
            },
            vapidKey: '',
        };
        return _config;
    }
}

export const formatearEmailTienda    = (id) => `tienda${id}@veteo.app`;
export const formatearPasswordTienda = (id) => `V-${id}APP`;