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
