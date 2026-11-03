/**
 * vite.config.ts
 *
 * Vite serves the React client on port 9000 and compiles TypeScript, JSX and
 * Tailwind (configured in src/css/wolfie_lists.css, there is no
 * tailwind.config.js).
 *
 * The proxy is what connects the client to the server, and it is the PROXY
 * pattern: the browser only ever talks to port 9000, and Vite forwards
 * anything under /api to the Express server and hands back the answer. To the
 * browser it is all one site, so the login cookie goes with every request and
 * the server needs no CORS setup.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// the end to end tests run their own server on another port and say so here
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    // @/ means src/, so an import never needs a string of ../../
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
        port: 9000,
        strictPort: true,
        proxy: { '/api': API_URL }
    },
    preview: {
        port: 9000,
        strictPort: true,
        proxy: { '/api': API_URL }
    }
});
