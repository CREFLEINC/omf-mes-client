import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  toWorkOrderCloseDailyRows,
  WorkOrderCloseDailyResultsPane,
  type WorkOrderCloseDailyResultsState,
} from './daily-results-pane';
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
      firstAt: '2026-10-21T22:00:00+07:00',
      lastAt: '2026-10-22T05:00:00+07:00',
      byShift: [{ shiftId: 2, shiftName: '야간', ...qty(80, 2, 2) }],
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

const resolved = (
  overrides: Partial<Extract<WorkOrderCloseDailyResultsState, { kind: 'RESOLVED' }>> = {},
): WorkOrderCloseDailyResultsState => ({
  kind: 'RESOLVED',
  data,
  refetchFailed: false,
  onRetry: () => undefined,
  ...overrides,
});

const pane = () => screen.getByRole('region', { name: t.pane });
const bodyRows = () =>
  within(pane())
    .getAllByRole('row')
    .filter((row) => row.closest('tbody'));
const footRows = () =>
  within(pane())
    .getAllByRole('row')
    .filter((row) => row.closest('tfoot'));
const cellTexts = (row: HTMLElement) =>
  within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);

describe('toWorkOrderCloseDailyRows', () => {
  it('접힌 날은 날짜 줄 하나, 펼친 날은 교대 줄을 서버 순서대로 붙인다', () => {
    expect(toWorkOrderCloseDailyRows(data.items, new Set()).map((row) => row.kind)).toEqual([
      'day',
      'day',
    ]);
    const rows = toWorkOrderCloseDailyRows(data.items, new Set(['2026-10-20']));
    expect(rows.map((row) => `${row.kind}:${row.shiftName ?? ''}`)).toEqual([
      'day:',
      'shift:주간',
      'shift:야간',
      'shift:교대 없음',
      'day:야간',
    ]);
  });

  it('교대가 하나뿐인 날은 펼칠 수 없고 그 교대 이름을 날짜 줄에 싣는다', () => {
    const rows = toWorkOrderCloseDailyRows(data.items, new Set(['2026-10-21']));
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ kind: 'day', expandable: false, shiftName: '야간' });
  });
});

describe('WorkOrderCloseDailyResultsPane', () => {
  it('열 머리와 날짜 줄 값을 보이고, 지시 수량과 단위는 표 밖 제목 줄에 한 번 보인다', () => {
    render(<WorkOrderCloseDailyResultsPane state={resolved()} unitLabel="EA · 개" />);

    const head = within(pane()).getByRole('heading', { name: t.pane }).parentElement!;
    expect(within(head).getByText(t.values.orderQty).nextElementSibling).toHaveTextContent('500');
    expect(within(head).getByText(t.values.unit).nextElementSibling).toHaveTextContent('EA · 개');
    expect(
      within(pane())
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      `${t.fields.workDate}ⓘ`,
      t.fields.shift,
      t.fields.goodQty,
      t.fields.defectQty,
      t.fields.holdQty,
      t.fields.scrapQty,
      t.fields.reworkQty,
      t.fields.resultCount,
      t.fields.corrected,
    ]);
    expect(screen.getByRole('button', { name: t.workDateHintLabel })).toBeInTheDocument();
    expect(within(pane()).getByText(t.lead)).toBeInTheDocument();
    const [first, second] = bodyRows();
    const firstCells = cellTexts(first!);
    expect(firstCells[0]).toContain('2026-10-20');
    expect(firstCells.slice(1)).toEqual([
      t.values.shiftCount(3),
      '120',
      '4',
      '1',
      '2',
      '3',
      '5',
      t.values.corrected(1),
    ]);
    /* 교대가 하나뿐인 날(야간만)은 날짜 줄의 교대 칸에 그 이름이 보인다. */
    expect(cellTexts(second!).slice(0, 2)).toEqual(['2026-10-21', '야간']);
    expect(cellTexts(second!).at(-1)).toBe('');
  });

  it('단위 목록에서 찾지 못하면 응답의 단위 코드를 보인다', () => {
    render(<WorkOrderCloseDailyResultsPane state={resolved()} unitLabel={null} />);
    expect(within(pane()).getByText(t.values.unit).nextElementSibling).toHaveTextContent('EA');
  });

  it('합계 행은 응답의 totals이고, 표 안에 지시 수량 행을 두지 않는다', () => {
    render(<WorkOrderCloseDailyResultsPane state={resolved()} unitLabel="EA" />);

    expect(footRows()).toHaveLength(1);
    expect(cellTexts(footRows()[0]!)).toEqual([
      t.values.total,
      '200',
      '6',
      '2',
      '4',
      '6',
      '7',
      t.values.corrected(1),
    ]);
  });

  it('교대가 둘 이상인 날만 펼침 손잡이가 있고, 교대 줄은 교대 칸에 이름을 보이며 날짜는 보조기기에만 읽힌다', () => {
    render(<WorkOrderCloseDailyResultsPane state={resolved()} unitLabel="EA" />);

    expect(screen.queryByRole('button', { name: t.actions.expand('2026-10-21') })).toBeNull();
    const toggle = screen.getByRole('button', { name: t.actions.expand('2026-10-20') });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(bodyRows()).toHaveLength(2);

    fireEvent.click(toggle);
    expect(bodyRows()).toHaveLength(5);
    const shiftCells = within(bodyRows()[1]!).getAllByRole('cell');
    expect(shiftCells[0]!.textContent).toBe('2026-10-20');
    expect(shiftCells[0]!.querySelector('.work-order-close-table-caption')).toHaveTextContent(
      '2026-10-20',
    );
    expect(cellTexts(bodyRows()[1]!).slice(1)).toEqual([
      '주간',
      '70',
      '3',
      '1',
      '2',
      '3',
      '3',
      t.values.corrected(1),
    ]);
    expect(cellTexts(bodyRows()[3]!)[1]).toBe('교대 없음');

    fireEvent.click(screen.getByRole('button', { name: t.actions.collapse('2026-10-20') }));
    expect(bodyRows()).toHaveLength(2);
  });

  it('실적이 없으면 빈 상태만 보이고 합계 행을 두지 않는다', () => {
    render(
      <WorkOrderCloseDailyResultsPane
        unitLabel="EA"
        state={resolved({
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
        })}
      />,
    );

    expect(within(pane()).getByText(t.empty)).toBeInTheDocument();
    expect(footRows()).toHaveLength(0);
  });

  it('다시 불러오기에 실패하면 표는 그대로 두고 경고와 다시 시도를 보인다', () => {
    const onRetry = vi.fn();
    render(
      <WorkOrderCloseDailyResultsPane
        state={resolved({ refetchFailed: true, onRetry })}
        unitLabel="EA"
      />,
    );

    expect(within(pane()).getByText(t.refetchFailed)).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(2);
    fireEvent.click(within(pane()).getByRole('button', { name: messages.common.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('불러오는 중에는 상태 표시, 처음 불러오기에 실패하면 구획 문구와 다시 시도를 보인다', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <WorkOrderCloseDailyResultsPane state={{ kind: 'CHECKING' }} unitLabel={null} />,
    );
    expect(screen.getByRole('status', { name: t.loading })).toBeInTheDocument();

    rerender(
      <WorkOrderCloseDailyResultsPane
        state={{ kind: 'UNAVAILABLE', cause: 'other', onRetry }}
        unitLabel={null}
      />,
    );
    expect(within(pane()).getByText(t.loadFailedTitle)).toBeInTheDocument();
    expect(within(pane()).getByText(t.loadFailed)).toBeInTheDocument();
    fireEvent.click(within(pane()).getByRole('button', { name: messages.common.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('권한이 없으면(403) 권한 안내만 보이고 다시 시도를 두지 않는다', () => {
    render(
      <WorkOrderCloseDailyResultsPane
        state={{ kind: 'UNAVAILABLE', cause: 'forbidden', onRetry: () => undefined }}
        unitLabel={null}
      />,
    );

    expect(within(pane()).getByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(within(pane()).queryByText(t.loadFailedTitle)).toBeNull();
    expect(within(pane()).queryByRole('button', { name: messages.common.retry })).toBeNull();
  });
});
