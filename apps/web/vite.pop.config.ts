import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * POP 셸 전용 빌드 — 진입 문서가 `pop.html`이고 산출물이 `dist-pop`이다.
 *
 * ⛔ **관리웹 빌드(`vite.config.ts`)와 산출물을 가른다.** 한 벌로 두면 `apps/pop`이 싣는
 * 것이 관리웹 번들이 되어, 설치본이 켜질 때 관리웹 화면이 먼저 서고 단말이 쓰지 않는 화면이
 * 함께 실린다(`src/app/pop-main.tsx` 머리말).
 *
 * ⚠ 관리웹 빌드는 이 파일을 읽지 않는다 — `pnpm build`의 동작은 그대로다.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-pop',
    emptyOutDir: true,
    rollupOptions: {
      input: 'pop.html',
    },
  },
});
