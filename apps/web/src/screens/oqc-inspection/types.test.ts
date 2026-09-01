import { describe, expect, it } from 'vitest';

import { confirmedRound, draftRound, reinspectionRound, waitingRequest } from './fixtures';
import {
  formatDateTime,
  latestRound,
  orderedRounds,
  toInspectionQueueRow,
  toInspectionResultRound,
} from './types';

/**
 * 「틀려도 조용한 것」만 잰다 — 이 셋은 틀려도 **화면이 멀쩡히 돈다.**
 *
 * `latestRound` 가 잘못 고르면 다른 회차 위에 판정을 쌓고, `formatDateTime` 이 값을 삼키면
 * 서버가 보낸 시각이 화면에서 사라진다. 둘 다 오류도 빈 화면도 내지 않는다.
 */
describe('latestRound', () => {
  it('서버가 준 차례를 믿지 않고 회차 번호로 고른다 — 정렬이 계약에 적혀 있지 않다', () => {
    const rounds = [reinspectionRound, confirmedRound].map(toInspectionResultRound);

    /* 큰 회차가 뒤에 오도록 뒤집어도 같은 것을 고른다. */
    expect(latestRound(rounds)?.inspectionRound).toBe(2);
    expect(latestRound(rounds.slice().reverse())?.inspectionRound).toBe(2);
  });

  it('회차가 하나도 없으면 null 이다 — 아직 아무도 판정하지 않은 의뢰다', () => {
    expect(latestRound([])).toBeNull();
  });
});

describe('orderedRounds', () => {
  it('회차 번호 오름차순이다 — 사슬의 진행 순서가 그대로 보여야 한다', () => {
    expect(
      orderedRounds([reinspectionRound, confirmedRound].map(toInspectionResultRound)).map(
        (round) => round.inspectionRound,
      ),
    ).toEqual([1, 2]);
  });
});

describe('formatDateTime', () => {
  it('실행 환경 시간대로 옮기지 않는다 — 옮기면 같은 일이 사람마다 다른 시각에 온 것으로 보인다', () => {
    expect(formatDateTime('2026-08-30T10:00:00+09:00')).toBe('2026-08-30 10:00');
    expect(formatDateTime('2026-08-30T10:00:00Z')).toBe('2026-08-30 10:00');
  });

  it('형식이 아니면 원문을 그대로 낸다 — 삼키면 없는 값과 못 알아본 값이 구분되지 않는다', () => {
    expect(formatDateTime('언젠가')).toBe('언젠가');
    expect(formatDateTime('')).toBe('');
  });
});

describe('toInspectionResultRound · toInspectionQueueRow', () => {
  it('선택 필드를 null 로 모은다 — undefined 와 섞이면 그리는 쪽이 두 갈래를 다 다뤄야 한다', () => {
    const round = toInspectionResultRound(draftRound);

    expect(round.confirmedAt).toBeNull();
    expect(round.previousResultId).toBeNull();
  });

  it('큐 행이 대상번호를 싣는다 — 줄의 둘째 행에 서는 값이다', () => {
    expect(toInspectionQueueRow(waitingRequest).targetId).toBe(waitingRequest.targetId);
  });
});
