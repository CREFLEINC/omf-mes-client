import type { CSSProperties } from 'react';

/**
 * 표의 행 번호 칸 폭 — 가장 큰 번호의 자릿수(두 자리 이상)를 `--row-no-digits` 로 표에 싣는다. 칸 폭은 각 표 CSS 가
 * `calc(var(--row-no-digits, 2) * 1ch + 8px)` 로 잰다.
 *
 * 26px 로 고정했을 때 세 자리(100번)부터 번호가 옆의 품목코드 · 품목명 칸으로 넘쳐 겹쳤다(사용자 지적 2026-11-23).
 * 줄이 적은 날은 지금처럼 좁게 두고, 많아지면 그만큼만 넓힌다.
 */
export const rowNumberStyle = (lastNo: number): CSSProperties =>
  ({
    '--row-no-digits': Math.max(2, String(Math.max(0, Math.trunc(lastNo))).length),
  }) as CSSProperties;
