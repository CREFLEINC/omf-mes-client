import type { DashboardQualityLots } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { FilterQueryContext } from './period';
import { QualityOverviewTab } from './quality-panels';
import { quality } from './quality.fixture';
import { lotInfoOf } from './quality-lots-dialog';

const t = messages.dashboard.quality;

const isLotsRequest = (request: Request): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === '/app/dashboard-quality-lots';

const lots = (overrides: Partial<DashboardQualityLots> = {}): DashboardQualityLots => ({
  status: 'RECEIPT_HOLD',
  asOf: '2026-10-19T01:00:00Z',
  totalCount: 2,
  items: [
    {
      key: 'HOLD-1',
      lotNo: 'LOT-A',
      itemCode: 'ITEM-1',
      itemName: '시험 품목 1',
      qty: 100,
      unitCode: 'EA',
      occurredAt: '2026-10-18T01:00:00Z',
      refNo: 'IR-1',
      inspectionType: null,
      counterpartName: '공급사 A',
      equipmentCode: null,
      detail: '수입검사 대기',
    },
    {
      key: 'HOLD-2',
      lotNo: null,
      itemCode: 'ITEM-2',
      itemName: '시험 품목 2',
      qty: null,
      unitCode: null,
      occurredAt: '2026-10-19T00:00:00Z',
      refNo: null,
      inspectionType: null,
      counterpartName: null,
      equipmentCode: null,
      detail: null,
    },
  ],
  ...overrides,
});

const renderTab = (respond: () => Response, data = quality()) => {
  const fetch = vi.fn(createStubFetch([{ match: isLotsRequest, respond }]));
  renderWithProviders(
    <FilterQueryContext.Provider
      value={{ dateFrom: '2026-10-01', dateTo: '2026-10-19', plantId: 17 }}
    >
      <QualityOverviewTab quality={data} />
    </FilterQueryContext.Provider>,
    { fetch },
  );

  return fetch;
};

/** 품질 종합 「현재 현황」 상태별 LOT 목록 창(사용자 결정 2026-10-19 「서버 추가 + 팝업」). */
describe('현재 현황 LOT 목록 창', () => {
  it('줄을 누르면 그 상태 · 같은 기간 · 공장으로 부르고, 머리에 상태 이름과 건수, 줄마다 LOT · 품목 · 상세 · 수량 · 시각', async () => {
    const user = userEvent.setup();
    const fetch = renderTab(() => jsonResponse(lots()));

    await user.click(screen.getByRole('button', { name: new RegExp(t.receiptHold) }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getAllByRole('listitem')).toHaveLength(2));

    const url = new URL((fetch.mock.calls[0]![0] as Request).url);
    expect(url.searchParams.get('status')).toBe('RECEIPT_HOLD');
    expect(url.searchParams.get('plantId')).toBe('17');
    expect(url.searchParams.get('dateFrom')).toBe('2026-10-01');

    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveTextContent(t.receiptHold);
    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveTextContent(
      t.lots.countLots('2'),
    );
    const [first, second] = within(dialog).getAllByRole('listitem');
    expect(first).toHaveTextContent('LOT-A');
    expect(first).toHaveTextContent('ITEM-1 시험 품목 1');
    expect(first).toHaveTextContent('공급사 A · IR-1 · 수입검사 대기');
    expect(first).toHaveTextContent('100 EA');
    /* LOT 번호 · 수량이 없으면 지어내지 않는다. */
    expect(second).toHaveTextContent(t.lots.noLot);
    expect(second).toHaveTextContent(t.rateNone);
  });

  it('200건을 넘으면 「전체 n건 중 m건 표시」, 미종결 부적합은 「건」', async () => {
    const user = userEvent.setup();
    const data = quality();
    data.nonconformance = { ...data.nonconformance, openCount: 250 };
    renderTab(() => jsonResponse(lots({ status: 'NC_OPEN', totalCount: 250 })), data);

    await user.click(screen.getByRole('button', { name: new RegExp(t.ncOpen) }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(t.lots.truncated('250', '2'))).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveTextContent(
      t.lots.countCases('250'),
    );
  });

  it('빈 목록 · 실패 문구', async () => {
    const user = userEvent.setup();
    renderTab(() => jsonResponse(lots({ totalCount: 0, items: [] })));
    await user.click(screen.getByRole('button', { name: new RegExp(t.receiptHold) }));
    expect(await screen.findByText(t.lots.empty)).toBeInTheDocument();
  });

  it('실패하면 다시 시도 단추', async () => {
    const user = userEvent.setup();
    renderTab(() => jsonResponse({}, { status: 500 }));
    await user.click(screen.getByRole('button', { name: new RegExp(t.receiptHold) }));
    expect(await screen.findByText(t.lots.failed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  it('숫자가 0인 줄은 누를 수 없다', () => {
    const data = quality();
    data.pqc = { ...data.pqc, pendingLotCount: 0 };
    renderTab(() => jsonResponse(lots()), data);

    expect(screen.getByRole('button', { name: new RegExp(t.pendingLots) })).toBeDisabled();
  });

  it('상세 줄 — 있는 값만 이어 쓴다', () => {
    expect(
      lotInfoOf({
        ...lots().items[0]!,
        inspectionType: 'PQC',
        counterpartName: null,
        equipmentCode: 'EQ-1',
        refNo: null,
        detail: ' ',
      }),
    ).toBe('PQC · EQ-1');
  });
});
