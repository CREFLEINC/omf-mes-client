import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { lotProgress, scheduleLine } from './fixtures';
import { inboundLotShareText, lotEvidence, LotMainCell, packageText } from './lot-row';
import { inboundLotShares } from './stage';
import type { InboundLotProgress } from './types';

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

  it('줄 전체가 이 발주 몫이면 덧붙이지 않는다', () => {
    expect(lotEvidence(lotProgress({ receivedQty: 60, allocatedQty: 60 }))).not.toContain(
      t.lot.evidence.wholeQty('60', 'SAMPLE-EA'),
    );
  });
});

describe('FR-035 W-01-09 LOT 줄 · 라인의 입하 LOT', () => {
  const renderCell = (lot: InboundLotProgress, canOpenWorkRecord: boolean) =>
    render(
      createElement(MemoryRouter, null, createElement(LotMainCell, { lot, canOpenWorkRecord })),
    );

  it('FR-035 자재 관리 LOT 줄에 입하 LOT 칩과 패키징을 보인다', () => {
    renderCell(
      lotProgress({
        inboundLotId: 9901,
        inboundLotNo: 'IL-20261112-0001',
        package: {
          uomId: 8601,
          uomCode: 'SAMPLE-BAG',
          uomName: '합성 봉지',
          count: 10,
          qtyPerPackage: 100,
        },
      }),
      false,
    );

    expect(screen.getByText(t.lot.inboundLot('IL-20261112-0001'))).toBeInTheDocument();
    expect(screen.getByText(t.lot.package('합성 봉지', '10', '100'))).toBeInTheDocument();
  });

  it('FR-035 패키징 단위 이름이 없으면 코드로 보인다', () => {
    expect(
      packageText({
        uomId: 8601,
        uomCode: 'SAMPLE-BAG',
        uomName: null,
        count: 2,
        qtyPerPackage: 50,
      }),
    ).toBe(t.lot.package('SAMPLE-BAG', '2', '50'));
  });

  it('FR-035 새 흐름 입하 LOT 은 W-01-16 을 그 입하 LOT 을 연 채로 여는 링크가 선다', () => {
    renderCell(lotProgress({ inboundLotId: 9901, inboundLotNo: 'IL-20261112-0001' }), true);

    expect(screen.getByRole('link', { name: t.lot.workRecordLink })).toHaveAttribute(
      'href',
      '/logistics/inbound-work-record?open=9901',
    );
  });

  it('FR-035 W-01-16 권한이 없으면 매칭 조정 안내는 글만 보인다', () => {
    renderCell(lotProgress({ inboundLotId: 9901, inboundLotNo: 'IL-20261112-0001' }), false);

    expect(screen.getByText(t.lot.workRecordLink)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('FR-035 이전 데이터 입하 LOT(IL-MIG-…)에는 매칭 조정 안내를 두지 않는다', () => {
    renderCell(lotProgress({ inboundLotId: 9902, inboundLotNo: 'IL-MIG-SAMPLE-0001' }), true);

    expect(screen.getByText(t.lot.inboundLot('IL-MIG-SAMPLE-0001'))).toBeInTheDocument();
    expect(screen.queryByText(t.lot.workRecordLink)).toBeNull();
  });

  it('FR-035 입하 LOT 이 없는 줄(라벨 대기)에는 칩이 없다', () => {
    renderCell(lotProgress(), true);

    expect(screen.queryByText(/^입하 LOT /)).toBeNull();
  });

  it('FR-035 라인의 입하 LOT 몫 — 마감한 입하 LOT 은 매칭 수량, 마감 전은 「입하 중」', () => {
    const line = scheduleLine({
      receivingInboundLots: [
        { inboundLotId: 9903, inboundLotNo: 'IL-20261112-0003', receivedQty: 40 },
      ],
    });
    const lots = [
      lotProgress({
        inboundLotId: 9901,
        inboundLotNo: 'IL-20261112-0001',
        allocatedQty: 30,
        receivedQty: 50,
      }),
      /* 같은 입하 LOT 의 둘째 자재 관리 LOT — 몫은 입하 LOT 단위라 한 번만 센다. */
      lotProgress({
        lotId: 7709,
        inboundLotId: 9901,
        inboundLotNo: 'IL-20261112-0001',
        allocatedQty: 30,
        receivedQty: 50,
      }),
      lotProgress({ lotId: 7710, inboundLotId: null, inboundLotNo: null }),
    ];

    expect(inboundLotShares(line, lots).map(inboundLotShareText)).toEqual([
      t.lot.shareAllocated('IL-20261112-0001', '30', 'SAMPLE-EA'),
      t.lot.shareReceiving('IL-20261112-0003'),
    ]);
  });

  it('FR-035 같은 입하 LOT 이 매칭 몫과 입하 중에 다 오면 매칭 몫만 남긴다', () => {
    const line = scheduleLine({
      receivingInboundLots: [
        { inboundLotId: 9901, inboundLotNo: 'IL-20261112-0001', receivedQty: 50 },
      ],
    });
    const lots = [
      lotProgress({ inboundLotId: 9901, inboundLotNo: 'IL-20261112-0001', allocatedQty: 30 }),
    ];

    expect(inboundLotShares(line, lots)).toHaveLength(1);
    expect(inboundLotShares(line, lots)[0]?.kind).toBe('allocated');
  });
});
