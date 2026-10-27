import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { lotProgress } from './fixtures';
import { lotEvidence } from './lot-row';

const t = messages.inboundSchedule;

describe('lotEvidence — LOT 줄 근거의 날짜는 공장 달력이다', () => {
  it('공장 새벽(UTC 전날 밤)에 들어온 LOT 은 공장 날짜로 보인다', () => {
    const lot = lotProgress({ receiptDatetime: '2026-10-20T18:30:00.000Z', inspection: null });

    expect(lotEvidence(lot).startsWith(t.lot.receivedOn('2026.10.21'))).toBe(true);
  });

  it('offset 이 다른 값도 같은 순간이면 같은 공장 날짜다', () => {
    const lot = lotProgress({ receiptDatetime: '2026-10-21T02:30:00+09:00', inspection: null });

    expect(lotEvidence(lot).startsWith(t.lot.receivedOn('2026.10.21'))).toBe(true);
  });

  it('검사 합격일도 공장 날짜로 보인다', () => {
    const lot = lotProgress({
      receiptDatetime: '2026-10-20T03:00:00.000Z',
      inspection: {
        inspectionRequestId: 7601,
        inspectionRequestNo: 'SAMPLE-IR-0001',
        statusCode: 'COMPLETED',
        requestedAt: '2026-10-20T03:00:00.000Z',
        judgmentCode: 'ACCEPTED',
        judgedAt: '2026-10-21T17:10:00.000Z',
      },
    });

    expect(lotEvidence(lot)).toContain(t.lot.evidence.accepted('2026.10.22'));
  });
});

describe('lotEvidence — 줄의 일부만 이 발주로 온 LOT 줄(초과분 연결)', () => {
  it('이 발주 몫이 줄 전체와 다르면 줄 전체 수량을 덧붙인다', () => {
    const lot = lotProgress({ receivedQty: 1425, allocatedQty: 100, uomCode: 'KG' });

    expect(lotEvidence(lot)).toContain(t.lot.evidence.wholeQty('1,425', 'KG'));
  });

  it.each([
    ['줄 전체가 이 발주 몫이면', { receivedQty: 60, allocatedQty: 60 }],
    ['앞선 서버가 몫을 주지 않으면', { receivedQty: 60 }],
  ])('%s 덧붙이지 않는다', (_, overrides) => {
    expect(lotEvidence(lotProgress(overrides))).not.toContain(
      t.lot.evidence.wholeQty('60', 'SAMPLE-EA'),
    );
  });
});
