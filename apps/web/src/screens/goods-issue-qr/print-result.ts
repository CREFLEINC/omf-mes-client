import type { PrintReport } from './mutations';

/**
 * 인쇄 걸음이 **어디까지 갔는가.** 화면이 한 문장으로 말할 상태를 여기서 하나로 정한다.
 *
 * ⛔ **갈래를 접지 않는다.** 「찍혔다」와 「찍혔는데 서버가 그 사실을 모른다」는 다른 상태다 —
 * 뒤쪽은 종이가 나왔으므로 사용자에게는 성공이지만, 서버 기록은 아직 대기 중이라 **다음 회차가
 * 「안 찍었나」로 읽는다.** 재발행 판단의 근거가 거기서 흐려진다.
 *
 * ⚠ **셸 통로가 없는 것은 결과가 아니다**(`none`). 인쇄를 시도하지 않았으므로 성공도 실패도
 * 아니고, 그 사정은 화면이 상시 안내로 따로 말한다.
 */
export type PrintResult =
  | { kind: 'none' }
  | { kind: 'printed' }
  /** 찍혔는데 그 결과를 서버에 남기지 못했다. */
  | { kind: 'printedUnreported' }
  | { kind: 'failed' }
  /** 찍히지 않았고 그 사실도 서버에 남기지 못했다. */
  | { kind: 'failedUnreported' };

/**
 * 여러 건을 한 번에 찍으므로 **가장 나쁜 것이 화면의 말이 된다** — 하나라도 안 나왔으면
 * 「마쳤습니다」라고 말할 수 없다.
 */
export const printResult = (reports: readonly PrintReport[]): PrintResult => {
  const attempted = reports.filter((report) => report.attempt.kind !== 'noBridge');

  if (attempted.length === 0) return { kind: 'none' };

  const failures = attempted.filter((report) => report.attempt.kind === 'failed');

  if (failures.length > 0) {
    return failures.some((report) => !report.reported)
      ? { kind: 'failedUnreported' }
      : { kind: 'failed' };
  }

  return attempted.some((report) => !report.reported)
    ? { kind: 'printedUnreported' }
    : { kind: 'printed' };
};
