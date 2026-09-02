import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  failureReason,
  retryableIds,
  summarizeOutcomes,
  summaryMessage,
  toFailureKind,
  type ConfirmOutcome,
} from './confirm-run';

const t = messages.shipmentConfirm.result;

const ok = (id: number): ConfirmOutcome => ({
  shipmentId: id,
  shipmentNo: `SYNTH-SH-${String(id)}`,
  failure: null,
});
const fail = (id: number, failure: ConfirmOutcome['failure']): ConfirmOutcome => ({
  shipmentId: id,
  shipmentNo: `SYNTH-SH-${String(id)}`,
  failure,
});

describe('toFailureKind', () => {
  it('⭐ 구조화 코드를 본다 — `message` 원문을 파싱하지 않는다(A-9 ⓑ)', () => {
    expect(toFailureKind(409, 'ALREADY_CONFIRMED')).toBe('already-confirmed');
    expect(toFailureKind(409, 'CANCEL_IN_PROGRESS')).toBe('cancel-in-progress');
    expect(toFailureKind(409, 'VERSION_CONFLICT')).toBe('version-conflict');
  });

  it('코드가 없어도 412는 잠금 충돌이다 — 다시 조회하면 풀린다는 안내가 맞다', () => {
    expect(toFailureKind(412, undefined)).toBe('version-conflict');
  });

  /*
   * ⛔ **모르는 실패를 「이미 확정됨」으로 접지 않는다.** 접으면 사용자가 「그럼 됐네」로 읽고
   * 넘어가는데 실제로는 확정되지 않았다 — 되돌릴 수 없는 원장 위에서 가장 나쁜 오독이다.
   */
  it('⛔ 모르는 실패를 「이미 확정됨」으로 접지 않는다', () => {
    expect(toFailureKind(500, undefined)).toBe('unknown');
    expect(toFailureKind(409, 'SOMETHING_ELSE')).toBe('unknown');
  });
});

describe('summarizeOutcomes', () => {
  it('성공과 실패를 센다', () => {
    const summary = summarizeOutcomes([ok(1), fail(2, 'version-conflict'), ok(3)]);

    expect(summary.confirmed).toBe(2);
    expect(summary.failed).toBe(1);
  });

  it('아무것도 안 했으면 둘 다 0이다', () => {
    expect(summarizeOutcomes([])).toEqual({ outcomes: [], confirmed: 0, failed: 0 });
  });
});

describe('summaryMessage', () => {
  /*
   * ⭐ **성공분을 유지해 «보인다»**(§6). 건별 호출이라 함께 되돌리지 않고 확정을 되돌릴 경로도
   * 없다 — 「전부 실패」로 뭉뚱그리면 이미 확정된 건을 다시 확정하러 간다.
   */
  it('⭐ 일부만 실패하면 성공분을 함께 말한다', () => {
    expect(summaryMessage(summarizeOutcomes([ok(1), ok(2), fail(3, 'version-conflict')]))).toBe(
      t.partial(2, 1),
    );
  });

  it('전부 성공·전부 실패는 각각의 말이 있다', () => {
    expect(summaryMessage(summarizeOutcomes([ok(1), ok(2)]))).toBe(t.allConfirmed(2));
    expect(summaryMessage(summarizeOutcomes([fail(1, 'unknown')]))).toBe(t.allFailed(1));
  });
});

describe('retryableIds', () => {
  /*
   * ⛔ 이미 확정된 건을 다시 담으면 같은 409 가 돌아오고 **실패 목록이 안 줄어든다** —
   * 사용자는 무엇이 남았는지 알 수 없게 된다.
   */
  it('⛔ 이미 확정된 건은 다시 시도에 담지 않는다', () => {
    const summary = summarizeOutcomes([
      fail(1, 'already-confirmed'),
      fail(2, 'version-conflict'),
      ok(3),
    ]);

    expect(retryableIds(summary)).toEqual([2]);
  });

  it('조건이 바뀌면 풀리는 실패는 담는다', () => {
    const summary = summarizeOutcomes([
      fail(1, 'cancel-in-progress'),
      fail(2, 'lock-unavailable'),
      fail(3, 'unknown'),
    ]);

    expect(retryableIds(summary)).toEqual([1, 2, 3]);
  });

  it('성공만 있으면 담을 것이 없다', () => {
    expect(retryableIds(summarizeOutcomes([ok(1)]))).toEqual([]);
  });
});

describe('failureReason', () => {
  it('갈래마다 다른 말을 낸다 — 무엇을 할 수 있는지가 건마다 다르다', () => {
    const reasons = (
      [
        'already-confirmed',
        'cancel-in-progress',
        'version-conflict',
        'lock-unavailable',
        'unknown',
      ] as const
    ).map(failureReason);

    expect(new Set(reasons).size).toBe(reasons.length);
    expect(failureReason('version-conflict')).toBe(t.reasons.versionConflict);
  });
});
