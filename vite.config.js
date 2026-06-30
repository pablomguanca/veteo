import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: 'index.html',
                reportes: 'reportes.html',
                adminCatalogo: 'admin-catalogo.html',
            }
        }
    },
    server: {
        port: 3000,
    }
});