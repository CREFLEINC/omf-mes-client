import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import { apiProxy } from './vite.api-proxy';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: apiProxy(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_PROXY_TARGET),
  },
}));
