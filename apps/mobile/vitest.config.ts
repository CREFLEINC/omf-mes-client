import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// vitest.config.ts 는 vite.config.ts 와 병합되지 않고 대체하므로 플러그인을 다시 지정한다.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
