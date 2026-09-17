import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MARCADOR = '__VETEO_BUILD__';

function sellarServiceWorker() {
    const idDesarrollo = `dev-${Date.now().toString(36)}`;
    let huella = null;
    let directorioSalida = 'dist';

    return {
        name: 'veteo-sellar-sw',

        configureServer(servidor) {
            servidor.middlewares.use((peticion, respuesta, siguiente) => {
                if (!peticion.url?.split('?')[0].endsWith('/sw.js')) return siguiente();

                const origen = resolve(servidor.config.publicDir, 'sw.js');
                if (!existsSync(origen)) return siguiente();

                respuesta.setHeader('Content-Type', 'application/javascript');
                respuesta.setHeader('Cache-Control', 'no-cache');
                respuesta.end(readFileSync(origen, 'utf8').replaceAll(MARCADOR, idDesarrollo));
            });
        },

        generateBundle(opciones, paquete) {
            directorioSalida = opciones.dir || directorioSalida;
            huella = createHash('sha256')
                .update(Object.keys(paquete).sort().join('|'))
                .digest('hex')
                .slice(0, 12);
        },

        closeBundle() {
            if (!huella) return;

            const destino = resolve(directorioSalida, 'sw.js');
            if (!existsSync(destino)) return;

            const contenido = readFileSync(destino, 'utf8');
            if (!contenido.includes(MARCADOR)) return;

            writeFileSync(destino, contenido.replaceAll(MARCADOR, huella));
            this.info(`sw.js sellado con la versión ${huella}`);
        },
    };
}

export default defineConfig({
    root: '.',
    publicDir: 'public',
    plugins: [sellarServiceWorker()],
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main:          'index.html',
                reportes:      'reportes.html',
                adminCatalogo: 'admin-catalogo.html',
                instructivo:   'instructivo.html',
            }
        }
    },
    server: {
        port: 3000,
    }
});
