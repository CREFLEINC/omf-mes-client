import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { toWorkOrderCloseDailyRows, WorkOrderCloseDailyResultsPane } from './daily-results-pane';
import type { WorkOrderCloseDailyResults } from './queries';

const t = messages.workOrderClose.dailyResults;

const qty = (good: number, defect: number, resultCount: number, correctedCount = 0) => ({
  goodQty: good,
  defectQty: defect,
  holdQty: 1,
  scrapQty: 2,
  reworkQty: 3,
  resultCount,
  correctedCount,
});

const data: WorkOrderCloseDailyResults = {
  uomId: 1,
  uomCode: 'EA',
  orderQty: 500,
  items: [
    {
      workDate: '2026-10-20',
      ...qty(120, 4, 5, 1),
      firstAt: '2026-10-20T06:10:00+07:00',
      lastAt: '2026-10-21T05:40:00+07:00',
      byShift: [
        { shiftId: 1, shiftName: '주간', ...qty(70, 3, 3, 1) },
        { shiftId: 2, shiftName: '야간', ...qty(40, 1, 1) },
        { shiftId: null, shiftName: '교대 없음', ...qty(10, 0, 1) },
      ],
    },
    {
      workDate: '2026-10-21',
      ...qty(80, 2, 2),
      firstAt: '2026-10-21T07:00:00+07:00',
      lastAt: '2026-10-21T15:00:00+07:00',
      byShift: [{ shiftId: 1, shiftName: '주간', ...qty(80, 2, 2) }],
    },
  ],
  totals: {
    goodQty: 200,
    defectQty: 6,
    holdQty: 2,
    scrapQty: 4,
    reworkQty: 6,
    resultCount: 7,
    correctedCount: 1,
  },
};

const pane = () => screen.getByRole('region', { name: t.pane });
const bodyRows = () =>
  within(pane())
    .getAllByRole('row')
    .filter((row) => row.closest('tbody'));

describe('toWorkOrderCloseDailyRows', () => {
  it('접힌 날은 날짜 줄 하나, 펼친 날은 교대 줄을 서버 순서대로 붙인다', () => {
    expect(toWorkOrderCloseDailyRows(data.items, new Set()).map((row) => row.kind)).toEqual([
      'day',
      'day',
    ]);
    const rows = toWorkOrderCloseDailyRows(data.items, new Set(['2026-10-20']));
    expect(rows.map((row) => (row.kind === 'shift' ? row.shiftName : row.workDate))).toEqual([
      '2026-10-20',
      '주간',
      '야간',
      '교대 없음',
      '2026-10-21',
    ]);
  });

  it('교대가 하나뿐인 날은 펼칠 수 없다', () => {
    const rows = toWorkOrderCloseDailyRows(data.items, new Set(['2026-10-21']));
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ kind: 'day', expandable: false, isExpanded: false });
  });
});

describe('WorkOrderCloseDailyResultsPane', () => {
  it('날짜 줄마다 다섯 수량과 실적 건수, 정정 반영을 보이고 단위는 제목 줄에 한 번 보인다', () => {
    render(<WorkOrderCloseDailyResultsPane state={{ kind: 'RESOLVED', data }} />);

    expect(within(pane()).getByText(t.unit('EA'))).toBeInTheDocument();
    const headers = within(pane())
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toEqual([
      t.fields.workDate,
      t.fields.goodQty,
      t.fields.defectQty,
      t.fields.holdQty,
      t.fields.scrapQty,
      t.fields.reworkQty,
      t.fields.resultCount,
      t.fields.corrected,
    ]);
    const [first, second] = bodyRows();
    /* 첫 칸에는 펼침 손잡이의 아이콘 글자가 함께 있다 — 날짜는 포함 여부로 본다. */
    const firstCells = within(first!)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(firstCells[0]).toContain('2026-10-20');
    expect(firstCells.slice(1)).toEqual(['120', '4', '1', '2', '3', '5', t.values.corrected(1)]);
    expect(within(second!).getAllByRole('cell').at(-1)?.textContent).toBe('');
  });

  it('합계 행은 응답의 totals이고, 그 아래 지시 수량을 양품 열에 보인다', () => {
    render(<WorkOrderCloseDailyResultsPane state={{ kind: 'RESOLVED', data }} />);

    const footRows = within(pane())
      .getAllByRole('row')
      .filter((row) => row.closest('tfoot'));
    expect(footRows).toHaveLength(2);
    expect(footRows[0]!.textContent).toBe(`${t.values.total}2006246${'7'}${t.values.corrected(1)}`);
    const orderCells = within(footRows[1]!).getAllByRole('cell');
    expect(orderCells[0]!.textContent).toBe(t.values.orderQty);
    expect(orderCells[1]!.textContent).toBe('500');
  });

  it('교대가 둘 이상인 날만 펼침 손잡이가 있고, 누르면 교대 줄이 보였다가 다시 접힌다', () => {
    render(<WorkOrderCloseDailyResultsPane state={{ kind: 'RESOLVED', data }} />);

    expect(screen.queryByRole('button', { name: t.actions.expand('2026-10-21') })).toBeNull();
    const toggle = screen.getByRole('button', { name: t.actions.expand('2026-10-20') });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(bodyRows()).toHaveLength(2);

    fireEvent.click(toggle);
    expect(bodyRows()).toHaveLength(5);
    expect(
      within(bodyRows()[1]!)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['주간', '70', '3', '1', '2', '3', '3', t.values.corrected(1)]);
    expect(within(bodyRows()[3]!).getAllByRole('cell')[0]!.textContent).toBe('교대 없음');

    fireEvent.click(screen.getByRole('button', { name: t.actions.collapse('2026-10-20') }));
    expect(bodyRows()).toHaveLength(2);
  });

  it('실적이 없으면 빈 상태만 보이고 합계 행을 두지 않는다', () => {
    render(
      <WorkOrderCloseDailyResultsPane
        state={{
          kind: 'RESOLVED',
          data: {
            ...data,
            items: [],
            totals: {
              goodQty: 0,
              defectQty: 0,
              holdQty: 0,
              scrapQty: 0,
              reworkQty: 0,
              resultCount: 0,
              correctedCount: 0,
            },
          },
        }}
      />,
    );

    expect(within(pane()).getByText(t.empty)).toBeInTheDocument();
    expect(
      within(pane())
        .getAllByRole('row')
        .filter((row) => row.closest('tfoot')),
    ).toHaveLength(0);
  });

  it('불러오는 중에는 상태 표시, 실패하면 다시 시도를 보인다', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<WorkOrderCloseDailyResultsPane state={{ kind: 'CHECKING' }} />);
    expect(screen.getByRole('status', { name: t.loading })).toBeInTheDocument();

    rerender(<WorkOrderCloseDailyResultsPane state={{ kind: 'UNAVAILABLE', onRetry }} />);
    fireEvent.click(within(pane()).getByRole('button', { name: messages.common.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
