import { describe, expect, it } from 'vitest';

import type { PrintReport } from './mutations';
import { printResult } from './print-result';

const report = (
  attempt: PrintReport['attempt'],
  reported: boolean,
  documentIssueLogId = 1,
): PrintReport => ({ documentIssueLogId, attempt, reported });

describe('printResult', () => {
  it('셸 통로가 없으면 결과가 아니다 — 성공도 실패도 아니다', () => {
    expect(printResult([report({ kind: 'noBridge' }, false)])).toEqual({ kind: 'none' });
  });

  it('찍히고 보고까지 됐으면 성공이다', () => {
    expect(printResult([report({ kind: 'printed' }, true)])).toEqual({ kind: 'printed' });
  });

  it('찍혔는데 보고를 못 했으면 성공으로 접지 않는다 — 서버 기록이 대기로 남는다', () => {
    expect(printResult([report({ kind: 'printed' }, false)])).toEqual({
      kind: 'printedUnreported',
    });
  });

  it('실패를 보고했으면 인쇄 실패다', () => {
    expect(printResult([report({ kind: 'failed', reason: '용지 걸림' }, true)])).toEqual({
      kind: 'failed',
    });
  });

  it('실패했는데 보고도 못 했으면 그것까지 말한다', () => {
    expect(printResult([report({ kind: 'failed', reason: '용지 걸림' }, false)])).toEqual({
      kind: 'failedUnreported',
    });
  });

  it('여러 건이면 가장 나쁜 것이 화면의 말이 된다', () => {
    expect(
      printResult([
        report({ kind: 'printed' }, true, 1),
        report({ kind: 'failed', reason: '용지 걸림' }, true, 2),
      ]),
    ).toEqual({ kind: 'failed' });
  });

  it('시도한 건이 하나라도 있으면 통로 없는 건에 가려지지 않는다', () => {
    expect(
      printResult([report({ kind: 'noBridge' }, false, 1), report({ kind: 'printed' }, true, 2)]),
    ).toEqual({ kind: 'printed' });
  });
});
