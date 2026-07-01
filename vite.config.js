export default defineConfig({
    root: '.',
    publicDir: 'public',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: 'index.html',
                reportes: 'reportes.html',
                adminCatalogo: 'admin-catalogo.html',
                instructivo: 'instructivo.html',
            }
        }
    },
    server: {
        port: 3000,
    }
});