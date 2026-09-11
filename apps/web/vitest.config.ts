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
    // findBy 의 기다림(5초)보다 위여야 한다. 같으면 기다리다 시험이 먼저 끊겨,
    // 무엇을 못 찾았는지 대신 시간 초과만 남는다. (#1072 · @omf-mes/mobile 과 같은 값)
    //
    // 이미지 빌드(Dockerfile:23)가 같은 값을 명령줄로 주고 있었다 — 여기 두어야 로컬 실행이
    // CI 와 같은 조건이 된다. 다르면 로컬이 초록인데 빌드만 떨어지는 일이 계속 생긴다.
    testTimeout: 15000,
  },
});
