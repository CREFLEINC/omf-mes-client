import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, searchForWorkspaceRoot } from 'vite';
import { fileURLToPath } from 'node:url';

import { apiProxy } from './vite.api-proxy';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        fileURLToPath(
          new URL('./foundation/fonts/', import.meta.resolve('@crefle/web-ui/styles/index.css')),
        ),
      ],
    },
    proxy: apiProxy(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_PROXY_TARGET),
  },
}));
