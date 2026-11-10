import type { DashboardItemGroupDefects, DashboardProduction } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { ItemGroupDefectsDialog, ItemGroupPanel } from './item-group-panel';
import { FilterQueryContext } from './period';

const t = messages.dashboard.itemGroup;

const production: DashboardProduction = {
  totalQty: 400,
  goodQty: 377,
  ngQty: 30,
  holdQty: 0,
  defectRate: 7.5,
  byItemGroup: [
    {
      itemGroupCode: 'ADT',
      itemGroupName: 'ADT 그룹',
      totalQty: 300,
      goodQty: 282,
      ngQty: 20,
      defectRate: 6.7,
    },
    {
      itemGroupCode: null,
      itemGroupName: null,
      totalQty: 100,
      goodQty: 95,
      ngQty: 10,
      defectRate: 10,
    },
  ],
};

const defects: DashboardItemGroupDefects = {
  dateFrom: '2026-11-10',
  dateTo: '2026-11-10',
  asOf: '2026-11-10T03:00:00Z',
  groups: [
    {
      itemGroupCode: 'ADT',
      itemGroupName: 'ADT 그룹',
      totalQty: 300,
      ngQty: 20,
      defectRate: 6.7,
      topDefects: [{ defectCodeId: 1, defectCode: 'D1', defectName: '찍힘', qty: 15 }],
      untypedNgQty: 5,
    },
    {
      itemGroupCode: null,
      itemGroupName: null,
      totalQty: 100,
      ngQty: 10,
      defectRate: 10,
      topDefects: [],
      untypedNgQty: 10,
    },
  ],
};

describe('제품군별 생산 현황(omf-all-around#251)', () => {
  it('제품군 줄 + 맨 끝 합계(공장 합), 품목군 없는 줄은 「미분류」', () => {
    renderWithProviders(<ItemGroupPanel production={production} isLoading={false} />);

    const table = screen.getByRole('table', { name: t.title });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      'ADT 그룹30028220' + '6.7%',
      `${t.unclassified}10095` + '10' + '10%',
      `${t.sum}40037730` + '7.5%',
    ]);
    /* 모든 칸 가운데 정렬 — 대시보드 표 공통 규칙에 맡겨 정렬 속성을 두지 않는다(사용자 지시 2026-11-10). */
    for (const header of within(table).getAllByRole('columnheader')) {
      expect(header).not.toHaveAttribute('data-align');
    }
  });

  it('표 아래 「상세 보기」를 누르면 제품군별 불량 현황 창이 열린다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <FilterQueryContext.Provider value={{ dateFrom: '2026-11-10', dateTo: '2026-11-10' }}>
        <ItemGroupPanel production={production} isLoading={false} />
      </FilterQueryContext.Provider>,
      {
        fetch: createStubFetch([
          {
            match: (request) =>
              new URL(request.url).pathname.endsWith('/app/dashboard-item-group-defects'),
            respond: () => jsonResponse(defects),
          },
        ]),
      },
    );

    await user.click(screen.getByRole('button', { name: t.detailButtonLabel }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('region', { name: 'ADT 그룹' })).toHaveTextContent(
      '찍힘15 EA',
    );
  });

  it('서버가 제품군 칸을 주지 않으면(이전 서버) 그리지 않는다', () => {
    renderWithProviders(
      <ItemGroupPanel production={{ ...production, byItemGroup: undefined }} isLoading={false} />,
    );
    expect(screen.queryByText(t.title)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('불량 현황 창 — 같은 기간 · 공장으로 부르고, 머리는 종합 불량률, 제품군마다 상위 유형과 유형 미입력', async () => {
    const fetch = vi.fn(
      createStubFetch([
        {
          match: (request) =>
            new URL(request.url).pathname.endsWith('/app/dashboard-item-group-defects'),
          respond: () => jsonResponse(defects),
        },
      ]),
    );
    renderWithProviders(
      <FilterQueryContext.Provider
        value={{ dateFrom: '2026-11-10', dateTo: '2026-11-10', plantId: 17 }}
      >
        <ItemGroupDefectsDialog open production={production} onClose={() => undefined} />
      </FilterQueryContext.Provider>,
      { fetch },
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(t.dialogSub('7.5%', '30'));
    const adt = await within(dialog).findByRole('region', { name: 'ADT 그룹' });
    expect(adt).toHaveTextContent('찍힘15 EA');
    expect(adt).toHaveTextContent(t.untypedQty('5'));
    expect(within(dialog).getByRole('region', { name: t.unclassified })).toHaveTextContent(
      t.noTypes,
    );
    const url = new URL((fetch.mock.calls[0]?.[0] as Request).url);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      dateFrom: '2026-11-10',
      dateTo: '2026-11-10',
      plantId: '17',
    });
  });
});
