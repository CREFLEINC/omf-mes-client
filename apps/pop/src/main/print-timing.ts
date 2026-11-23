/**
 * 인쇄 시간 기록 — **어느 걸음이 느린지 숫자로 본다**(사용자 지시 2026-11-23 「출력 속도 개선 0번」).
 *
 * ⭐ 한 작업(라벨 묶음)마다 한 줄, 탭으로 가른 `이름=값`. 셸 줄(파일 · 프린터 고르기 · 용지 확인 · 전송)과
 *   화면 줄(발행 기록 · 라벨 짜기 · 셸 왕복 · 결과 보고)이 같은 `label` 로 짝을 맞춘다.
 * ⚠ 실패 사유를 적는 `print.log` 와 따로 둔다 — 그쪽은 실패를 찾으려고 읽는 파일이다.
 */

/** 화면이 보낸 값 — 짧은 글 · 수만 받는다(줄바꿈 · 탭은 걷는다). */
export const sanitizeTimingFields = (fields: unknown): [string, string][] => {
  if (fields === null || typeof fields !== 'object') return [];

  return Object.entries(fields as Record<string, unknown>)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .slice(0, 24)
    .map(([key, value]) => [
      key.replace(/[\t\r\n=]/gu, ' ').slice(0, 40),
      String(value)
        .replace(/[\t\r\n]/gu, ' ')
        .slice(0, 200),
    ]);
};

/** 한 줄로 — `at \t 쪽 \t 이름=값 …`. */
export const formatTimingLine = (
  at: string,
  side: 'shell' | 'screen',
  fields: readonly (readonly [string, string | number])[],
): string =>
  `${[at, side, ...fields.map(([key, value]) => `${key}=${String(value)}`)].join('\t')}\n`;

/** 지난 시간(ms) — 정수로. */
export const since = (start: number, now: number = performance.now()): number =>
  Math.round(now - start);
