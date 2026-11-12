import type { InspectionRequestForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { waitingRequest } from './fixtures';
import { QueueTable } from './queue-table';
import type { ItemNameLookup, NameLookup } from './reference-lookup';
import { toInspectionQueueRow } from './types';

/**
 * W-01-01 대기열 — 새 흐름(대상 = 입하 LOT) 줄(005 · screens/W-01-01.md 「대기열 행 = 입하 LOT」).
 * ⛔ 전부 지어낸 값이다.
 */

const t = messages.iqcInspection.queue;
const ti = messages.iqcInboundLot.queue;

const inbound = (overrides: Partial<InspectionRequestForward>): InspectionRequestForward => ({
  ...waitingRequest,
  targetTypeCode: 'INBOUND_LOT' as InspectionRequestForward['targetTypeCode'],
  lotId: undefined,
  inboundLotId: 7001,
  inboundLotNo: 'IL-20991231-0003',
  lotCount: 3,
  targetQty: 3000,
  uomId: 10,
  overallJudgmentCode: undefined,
  confirmedAt: undefined,
  previewJudgmentCode: null,
  splitFromInboundLotNo: null,
  receivedAt: '2099-12-31T01:40:00Z',
  ...overrides,
});

const itemNames: ItemNameLookup = {
  labelOf: () => 'SAMPLE-ITEM-ZZ · 합성 품목 하',
  partsOf: () => ({ code: 'SAMPLE-ITEM-ZZ', name: '합성 품목 하' }),
};
const lotNumbers: NameLookup = {
  labelOf: (id) => (id === null || id === undefined ? '—' : 'SAMPLE-LOT|Q|0042'),
};
const suppliers: NameLookup = { labelOf: () => '(주)합성공급' };

const uomFetch = createStubFetch([
  {
    match: (r) => new URL(r.url).pathname === '/mdm/uoms',
    respond: () =>
      jsonResponse({
        items: [{ uomId: 10, uomCode: 'EA' }],
        page: { page: 1, size: 200, total: 1 },
      }),
  },
]);

const renderRows = (items: InspectionRequestForward[]) =>
  renderWithProviders(
    <QueueTable
      rows={items.map(toInspectionQueueRow)}
      itemNames={itemNames}
      lotNumbers={lotNumbers}
      suppliers={suppliers}
      selectedId={null}
      onSelect={() => undefined}
      empty={<p>{t.empty}</p>}
    />,
    { fetch: uomFetch },
  );

const rowOf = (text: string): HTMLElement => screen.getByText(text).closest('tr') as HTMLElement;

describe('W-01-01 대기열 입하 LOT 행', () => {
  it('US3-1 입하 LOT 줄이 입하 LOT 번호 · 입하 시각 · 자재 관리 LOT 수 · 합계를 보인다', async () => {
    renderRows([inbound({})]);

    const table = screen.getByRole('table');
    expect(within(table).getByText(ti.columns.inboundLotNo)).toBeInTheDocument();
    expect(within(table).getByText(ti.columns.lotCount)).toBeInTheDocument();
    expect(within(table).getByText(ti.columns.overallJudgment)).toBeInTheDocument();

    /* 끝 마디 강조 — 번호가 두 조각으로 나뉜다. */
    expect(within(table).getByTitle('IL-20991231-0003')).toHaveTextContent('IL-20991231-0003');
    expect(within(table).getByText('0003')).toHaveClass('iqc-inspection-lot-tail');
    /* 공장 시각(UTC+7) `MM-DD HH:mm`. */
    expect(within(table).getByText('12-31 08:40')).toBeInTheDocument();

    expect(within(table).getByText(ti.lotCount(3))).toBeInTheDocument();
    expect(await within(table).findByText('3,000 EA')).toBeInTheDocument();

    expect(within(table).getByText(ti.status.REQUESTED)).toBeInTheDocument();
    expect(screen.getByText(ti.closingHint)).toBeInTheDocument();
  });

  it('US3-1 분리로 생긴 입하 LOT 은 아래 줄에 「분리 ← 끝 4자리」를 보인다', () => {
    renderRows([inbound({ splitFromInboundLotNo: 'IL-20991230-0017' })]);

    expect(screen.getByText(ti.splitFrom('0017'))).toBeInTheDocument();
    expect(screen.queryByText('12-31 08:40')).not.toBeInTheDocument();
  });

  it('US3-1 종합 판정 — 확정이면 칩, 확정 전이면 미리 보기, 결과가 없으면 「—」', () => {
    renderRows([
      inbound({
        inspectionRequestId: 1,
        inspectionRequestNo: 'IR-T-1',
        inboundLotNo: 'IL-20991231-0001',
        statusCode: 'COMPLETED',
        confirmedAt: '2099-12-31T03:00:00Z',
        overallJudgmentCode: 'ACCEPTED',
      }),
      inbound({
        inspectionRequestId: 2,
        inspectionRequestNo: 'IR-T-2',
        inboundLotNo: 'IL-20991231-0002',
        statusCode: 'IN_PROGRESS',
        previewJudgmentCode: 'REJECTED',
      }),
      inbound({
        inspectionRequestId: 3,
        inspectionRequestNo: 'IR-T-3',
        inboundLotNo: 'IL-20991231-0003',
      }),
    ]);

    const judgment = messages.partsIqcInspection.judgment;

    const confirmed = within(rowOf('IR-T-1'));
    expect(confirmed.getByText(judgment.ACCEPTED ?? '')).toBeInTheDocument();
    expect(confirmed.getByText(ti.status.CONFIRMED)).toBeInTheDocument();

    const previewed = within(rowOf('IR-T-2'));
    expect(previewed.getByText(ti.preview(judgment.REJECTED ?? ''))).toBeInTheDocument();
    expect(previewed.getByText(ti.status.IN_PROGRESS)).toBeInTheDocument();

    const empty = within(rowOf('IR-T-3'));
    expect(empty.getByText('—')).toBeInTheDocument();
    expect(empty.getByText(ti.status.REQUESTED)).toBeInTheDocument();

    /* 표 아래 건수 — 지금 쪽의 줄로 센다. */
    expect(screen.getByText(ti.counts(3, 1, 1, 1))).toBeInTheDocument();
  });

  it('US3-1 이전 데이터(대상 LOT) 줄은 섞여 있어도 LOT 번호로 그리고 새 칸은 「—」다', () => {
    renderRows([inbound({ inspectionRequestNo: 'IR-T-9' }), waitingRequest]);

    const legacy = within(rowOf('IR-2026-0001'));
    expect(legacy.getByTitle('SAMPLE-LOT|Q|0042')).toBeInTheDocument();
    expect(legacy.getAllByText('—')).toHaveLength(2);
    expect(legacy.getByText(messages.oqcInspection.status.requested)).toBeInTheDocument();
  });

  it('이전 데이터 줄만 있으면 지금 대기열 그대로다 — 새 칸 · 건수가 서지 않는다', () => {
    renderRows([waitingRequest]);

    const table = screen.getByRole('table');
    expect(within(table).getByText(t.columns.lotId)).toBeInTheDocument();
    expect(within(table).queryByText(ti.columns.lotCount)).not.toBeInTheDocument();
    expect(within(table).queryByText(ti.columns.overallJudgment)).not.toBeInTheDocument();
    expect(within(table).getByTitle('SAMPLE-LOT|Q|0042')).toBeInTheDocument();
    expect(screen.queryByText(ti.counts(1, 1, 0, 0))).not.toBeInTheDocument();
  });
});
