import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: 'index.html',
                reportes: 'reportes.html',
            }
        }
    },
    server: {
        port: 3000,
    }
});