import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// vitest.config.ts가 있으면 vite.config.ts와 병합되지 않고 대체된다.
// 따라서 react 플러그인을 여기서 다시 지정해야 JSX 변환이 동작한다.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
