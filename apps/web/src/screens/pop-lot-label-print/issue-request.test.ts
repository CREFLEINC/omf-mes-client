import { describe, expect, it } from 'vitest';

import { buildIssueRequest, guardIssue, judgeReissue, type IssueGuardInput } from './issue-request';
import { toIssueCountByLotId, toLotRows, type DocumentIssueSummary, type Lot } from './types';

const baseGuard: IssueGuardInput = {
  lotId: 1001,
  workerNo: 'W-01',
  gate: 'allowed',
  printer: 'ready',
  shellAvailable: true,
  verdict: 'new',
  reissueReasonCode: null,
};

describe('judgeReissue — 회차 판정', () => {
  it('0회면 신규다', () => {
    expect(judgeReissue(0)).toBe('new');
  });

  it('1회 이상이면 재발행이다', () => {
    expect(judgeReissue(1)).toBe('reissue');
  });

  it('모르면 신규가 아니다 — 사유 없이 다시 찍지 않는다', () => {
    expect(judgeReissue(null)).toBe('unknown');
  });
});

describe('guardIssue — 무엇이 막는가', () => {
  it('전부 갖추면 막지 않는다', () => {
    expect(guardIssue(baseGuard)).toBeNull();
  });

  it('대상을 고르지 않았으면 막는다', () => {
    expect(guardIssue({ ...baseGuard, lotId: null })).toBe('noTarget');
  });

  it('사번이 없으면 막는다 — 쓰기가 사번을 요구한다', () => {
    expect(guardIssue({ ...baseGuard, workerNo: null })).toBe('noWorker');
  });

  it('게이팅이 닫혀 있으면 막는다', () => {
    expect(guardIssue({ ...baseGuard, gate: 'denied' })).toBe('gateDenied');
  });

  it('게이팅을 확인하지 못하면 통과시키지 않는다 — 모르는 것을 통과로 두지 않는다', () => {
    expect(guardIssue({ ...baseGuard, gate: 'unknown' })).toBe('gateUnknown');
  });

  it('프린터가 없거나 확인하지 못하면 발행하지 않는다', () => {
    expect(guardIssue({ ...baseGuard, printer: 'none' })).toBe('noPrinter');
    expect(guardIssue({ ...baseGuard, printer: 'unknown' })).toBe('printerUnknown');
  });

  it('POP 셸이 없으면 발행 기록을 만들기 전부터 막는다', () => {
    expect(guardIssue({ ...baseGuard, shellAvailable: false })).toBe('shellUnavailable');
  });

  it('회차를 모르면 막는다 — 이미 찍힌 것을 사유 없이 다시 찍지 않는다', () => {
    expect(guardIssue({ ...baseGuard, verdict: 'unknown' })).toBe('issueCountUnknown');
  });

  it('재발행인데 사유가 비면 막는다 — 서버가 422 로 되돌린다', () => {
    expect(guardIssue({ ...baseGuard, verdict: 'reissue' })).toBe('reissueReasonMissing');
  });

  it('재발행이라도 사유가 있으면 막지 않는다', () => {
    expect(
      guardIssue({ ...baseGuard, verdict: 'reissue', reissueReasonCode: 'DAMAGED' }),
    ).toBeNull();
  });
});

describe('buildIssueRequest — 요청 본문', () => {
  it('LOT 하나를 대상으로 싣는다', () => {
    expect(buildIssueRequest({ lotId: 1001, reissueReasonCode: null, printerName: null })).toEqual({
      documentTypeCode: 'PRODUCTION_LOT_LABEL',
      targets: [{ targetTypeCode: 'LOT', targetId: 1001, lotId: 1001 }],
    });
  });

  it('신규 발행에는 재발행 사유를 싣지 않는다 — 이력이 거짓이 된다', () => {
    const body = buildIssueRequest({ lotId: 1001, reissueReasonCode: null, printerName: 'LP-02' });

    expect(body).not.toHaveProperty('reissueReasonCode');
    expect(body.printerName).toBe('LP-02');
  });

  it('재발행이면 사유를 싣는다', () => {
    expect(
      buildIssueRequest({ lotId: 1001, reissueReasonCode: 'DAMAGED', printerName: null }),
    ).toMatchObject({ reissueReasonCode: 'DAMAGED' });
  });
});

describe('toIssueCountByLotId — 대상 유형으로 먼저 가른다', () => {
  const summaries: DocumentIssueSummary[] = [
    { targetTypeCode: 'LOT', targetId: 1001, issueCount: 2 },
    /* 인식표 발행 기록 — 대상이 개체다. 같은 숫자라도 다른 것을 가리킨다(스펙 §5-2) */
    { targetTypeCode: 'SERIAL_NUMBER', targetId: 1002, issueCount: 7 },
  ];

  it('LOT 이 아닌 요약 행을 LOT 라벨 회차로 세지 않는다', () => {
    const counts = toIssueCountByLotId(summaries);

    expect(counts.get(1001)).toBe(2);
    expect(counts.has(1002)).toBe(false);
  });
});

describe('toLotRows — 「모른다」와 「0」을 가른다', () => {
  const lots = [
    { lotId: 1001, lotNo: 'LOT-0031' },
    { lotId: 1002, lotNo: 'LOT-0032' },
  ] as unknown as Lot[];

  it('현황을 받았으면 회차를 싣고, 빠진 대상은 모른다로 둔다', () => {
    const rows = toLotRows(lots, new Map([[1001, 3]]));

    expect(rows[0]?.issueCount).toBe(3);
    expect(rows[1]?.issueCount).toBeNull();
  });

  it('현황 자체를 못 받았으면 전 줄이 모른다다 — 미출력으로 그리지 않는다', () => {
    const rows = toLotRows(lots, null);

    expect(rows.every((row) => row.issueCount === null)).toBe(true);
  });
});
