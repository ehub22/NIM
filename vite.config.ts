import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * GitHub Pages serves repository sites from `https://<user>.github.io/<repo>/`,
 * so every asset URL has to be prefixed with the repository name.
 *
 * The name is read from the environment so the same config works for forks
 * without editing any file:
 *   - `VITE_BASE`              -> wins when set (e.g. `VITE_BASE=/` for a custom domain)
 *   - `GITHUB_REPOSITORY_NAME` -> set by the deploy workflow
 *   - `REPO_NAME`              -> convenience alias for local `npm run build`
 *   - fallback                 -> the current repository name
 */
function resolveBase(): string {
  const explicit = process.env.VITE_BASE ?? process.env.GITHUB_REPOSITORY_NAME ?? process.env.REPO_NAME;
  if (!explicit) return '/NIM/';
  const trimmed = explicit.trim();
  if (trimmed === '' || trimmed === '/') return '/';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const withoutSlashes = trimmed.replace(/^\/+|\/+$/g, '');
  return `/${withoutSlashes}/`;
}

export default defineConfig(({ command }) => ({
  // A leading `/` during `vite dev` keeps local URLs clean; builds get the repo prefix.
  base: command === 'serve' ? '/' : resolveBase(),
  plugins: [react(), tailwindcss()],
  envPrefix: 'VITE_',
  server: {
    host: true,
    port: 5173,
    // Allow the sandboxed preview host (and localhost) without opening the dev
    // server to arbitrary origins.
    allowedHosts: ['localhost', '127.0.0.1', '.e2b.app'],
    proxy: {
      // NVIDIA's hosted endpoint does not send CORS headers, so the dev server
      // forwards requests server-side. See proxy/server.mjs for the deployed
      // equivalent and README.md -> "CORS and the optional proxy".
      '/nim-api': {
        target: 'https://integrate.api.nvidia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nim-api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing dependencies so repeat visits only
        // re-download the app chunk.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            {
              name: 'markdown',
              test: /node_modules[\\/](react-markdown|remark-|rehype-|unified|micromark|mdast-|hast-|lowlight|highlight\.js|devlop|vfile|bail|trough|unist-)/,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    restoreMocks: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    css: false,
  },
}));
