import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/*
 * 부품에는 «화면이 없는» 시험(`qr-encode`·`appendDigit`)과 «화면을 세우는» 시험
 * (`marker-overlay`)이 함께 산다. 그래서 여기 환경은 jsdom 이고 react 플러그인이 필요하다 —
 * 플러그인이 없으면 JSX 가 변환되지 않아 시험이 구문 오류로 죽는다(@omf-mes/web 과 같은 사정).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    /* 부품의 동작만 잰다 — 스타일을 실어도 jsdom 은 배치를 계산하지 않아 얻는 것이 없다. */
    css: false,
  },
});
