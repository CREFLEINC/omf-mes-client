/**
 * 배포 확인의 확인 항목 하나(일정 · 4M · 자재 · 단말기)의 결과. 목록의 확인 칸과 상세의 줄이 같은 값을 쓴다.
 *
 * - `ok` 이상 없음 · `warn` 확인 필요 · `none` 대상 없음(자재가 없는 공정) · `pending` 받는 중.
 * - 「확인 필요」는 배포를 막지 않는다. 막는 조건은 아래 바가 따로 말한다.
 */
export type CheckState = 'ok' | 'warn' | 'none' | 'pending';

/** 요약 한 칸 — 값만, 또는 「이름표 값」 쌍. 칸 사이는 간격으로 나눈다(가운뎃점 · 쉼표로 잇지 않는다). */
export type SummaryPart = string | readonly [label: string, value: string];

export interface SectionCheck {
  state: CheckState;
  /** 줄 제목 옆 한 줄 요약 — 접어 둔 채로도 값이 읽힌다. */
  summary: SummaryPart[];
  /** 확인이 필요한 까닭(「부족 1종」). 요약 뒤 경고 칩으로 보인다. */
  alerts?: string[];
}

export type CheckKey = 'plan' | 'assign' | 'material' | 'terminal';

export const CHECK_KEYS: readonly CheckKey[] = ['plan', 'assign', 'material', 'terminal'];

export const needsCheck = (checks: readonly (SectionCheck | undefined)[]): boolean =>
  checks.some((check) => check?.state === 'warn');
