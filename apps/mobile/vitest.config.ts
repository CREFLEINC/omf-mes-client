import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// vitest.config.ts 는 vite.config.ts 와 병합되지 않고 대체하므로 플러그인을 다시 지정한다.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // findBy 의 기다림(5초)보다 위여야 한다. 같으면 기다리다 시험이 먼저 끊겨,
    // 무엇을 못 찾았는지 대신 시간 초과만 남는다.
    testTimeout: 15000,
  },
});
