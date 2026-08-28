import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { DelayState } from './delay';
import type { WorkOrderRow } from './row-view';
import { DEFAULT_SORT } from './sort';
import { WorkOrderTable, type WorkOrderTableProps } from './work-order-table';

const t = messages.workOrderProgress.list;
const NARROW = { from: '2026-08-01', to: '2026-08-30' };
const WIDE = { from: '2026-01-01', to: '2026-12-31' };

const row = (overrides: Partial<WorkOrderRow> = {}): WorkOrderRow => ({
  workOrderId: 7001,
  workOrderNo: 'SYN-WO-0007',
  itemIdText: '5001',
  orderQtyText: '3,000',
  goodQtyText: '2,850',
  defectQtyText: '10',
  holdQtyText: '5',
  scrapQtyText: '3',
  reworkQtyText: '2',
  achievementRateText: '95%',
  statusCode: 'SYN_RUN',
  plannedEndAtText: '2026-08-04 18:00',
  delay: 'delayed' as DelayState,
  ...overrides,
});

const renderTable = (overrides: Partial<WorkOrderTableProps> = {}) => {
  const onSort = vi.fn();
  const onSelect = vi.fn();

  render(
    <WorkOrderTable
      rows={[row()]}
      sort={DEFAULT_SORT}
      period={NARROW}
      isLoading={false}
      isError={false}
      itemLabel={(id) => `품목 ${id}`}
      statusLabel={(code) => (code === 'SYN_RUN' ? '진행중' : code)}
      onSort={onSort}
      onSelect={onSelect}
      {...overrides}
    />,
  );

  return {
    onSort,
    onSelect,
    user: userEvent.setup(),
    region: screen.getByRole('region', { name: t.title }),
  };
};

describe('WorkOrderTable', () => {
  it('한 줄에 수량 다섯을 그대로 보인다 — 셋으로 접지 않는다', () => {
    const { region } = renderTable();

    for (const value of ['2,850', '10', '5', '3', '2']) {
      expect(within(region).getByText(value)).toBeInTheDocument();
    }
  });

  it('⛔ 식별자를 그대로 보이지 않고 이름으로 바꾼다', () => {
    const { region } = renderTable();

    expect(within(region).getByText('품목 5001')).toBeInTheDocument();
  });

  it('줄을 눌러 상세를 연다', async () => {
    const { onSelect, user, region } = renderTable();

    await user.click(within(region).getByRole('button', { name: t.select('SYN-WO-0007') }));

    expect(onSelect).toHaveBeenCalledWith(7001);
  });

  describe('지연', () => {
    it.each([
      ['지연', 'delayed' as DelayState, t.delayed],
      ['정상', 'onTime' as DelayState, t.blank],
    ])('%s 을 표식으로 보인다', (_name, delay, expected) => {
      const { region } = renderTable({ rows: [row({ delay })] });

      expect(within(region).getByRole('row', { name: /SYN-WO-0007/ })).toHaveTextContent(expected);
    });

    /*
     * ⛔ 「모름」을 빈칸으로 두면 「정상」으로 읽힌다. 계획 종료가 없는 지시는 늦었는지
     * 아닌지 **판정할 수 없는** 것이라 그 뜻을 값 자리에 적는다.
     */
    it('⛔ 「모름」을 빈칸으로 두지 않는다 — 「정상」과 다르게 보인다', () => {
      const { region } = renderTable({ rows: [row({ delay: 'unknown' })] });
      const line = within(region).getByRole('row', { name: /SYN-WO-0007/ });

      expect(line).toHaveTextContent(t.delayUnknown);
      expect(t.delayUnknown).not.toBe(t.blank);
    });

    /* ⛔ 서버 판정이 아니라는 사실을 값 옆에 상시 둔다. 서버가 주기 시작하면 이 문구부터 지운다. */
    it('⛔ 화면이 낸 참고값임을 상시 적는다', () => {
      const { region } = renderTable();

      expect(within(region).getByText(t.delayReference)).toBeInTheDocument();
    });
  });

  describe('정렬 — 서버에 맡긴다', () => {
    it('머리를 누르면 밖으로 넘긴다 — 화면이 이 페이지만 늘어놓지 않는다', async () => {
      const { onSort, user, region } = renderTable();

      await user.click(
        within(region).getByRole('button', { name: new RegExp(t.columns.workOrderNo) }),
      );

      expect(onSort).toHaveBeenCalledWith('workOrderNo');
    });

    it('지금 걸린 순서를 표에 알린다', () => {
      const { region } = renderTable({ sort: { key: 'workOrderNo', direction: 'desc' } });

      expect(
        within(region).getByRole('columnheader', { name: new RegExp(t.columns.workOrderNo) }),
      ).toHaveAttribute('aria-sort', 'descending');
    });

    /*
     * ⛔ 눌러도 안 되는 머리를 두면 사용자가 고장으로 읽는다. 기간이 넓으면 달성률 정렬이
     * 막히므로(L-4) 그 머리는 누를 수 없어야 한다.
     */
    it('⛔ 기간이 넓으면 달성률 머리를 누를 수 없다', () => {
      const { region } = renderTable({ period: WIDE });

      expect(
        within(region).queryByRole('button', { name: new RegExp(t.columns.achievementRate) }),
      ).not.toBeInTheDocument();
    });

    it('기간이 좁으면 달성률로도 정렬한다', () => {
      const { region } = renderTable({ period: NARROW });

      expect(
        within(region).getByRole('button', { name: new RegExp(t.columns.achievementRate) }),
      ).toBeInTheDocument();
    });

    it.each([
      ['품목', t.columns.itemId],
      ['지시', t.columns.orderQty],
      ['양품', t.columns.goodQty],
      ['계획 종료', t.columns.plannedEndAt],
    ])('⛔ 지정되지 않은 열(%s)의 머리는 누를 수 없다', (_name, header) => {
      const { region } = renderTable();

      expect(
        within(region).queryByRole('button', { name: new RegExp(header) }),
      ).not.toBeInTheDocument();
    });
  });

  describe('볼 것이 없을 때', () => {
    it('결과가 0건이면 다음에 할 일을 적는다', () => {
      const { region } = renderTable({ rows: [] });

      expect(within(region).getByText(t.empty)).toBeInTheDocument();
    });

    it('받는 중임을 알린다', () => {
      const { region } = renderTable({ isLoading: true });

      expect(within(region).getByRole('status')).toHaveTextContent(t.loading);
    });

    /* ⛔ 조회 실패를 빈 표로 두면 「결과가 없다」로 읽힌다 — 다른 사실이다. */
    it('⛔ 조회 실패를 「결과 0건」으로 두지 않는다', () => {
      const { region } = renderTable({ isError: true, rows: [] });

      expect(within(region).getByText(t.loadError)).toBeInTheDocument();
      expect(within(region).queryByText(t.empty)).not.toBeInTheDocument();
    });
  });

  /* ⚠ 응답이 식별자만 주어 이름을 얻으려면 줄마다 서버를 다시 불러야 한다. */
  it('⛔ P/O·공정 열을 만들지 않고 그 사실을 적는다', () => {
    const { region } = renderTable();

    expect(within(region).getByText(t.joinedColumnsNote)).toBeInTheDocument();
    expect(within(region).queryByRole('columnheader', { name: 'P/O' })).not.toBeInTheDocument();
    expect(within(region).queryByRole('columnheader', { name: '공정' })).not.toBeInTheDocument();
  });
});

/*
 * ⚠ 상태는 품목과 다르다 — 코드 자체가 사람이 읽을 수 있는 말이라, 표시명을 모른다고
 * 감추면 오히려 정보가 준다.
 */
describe('상태 열', () => {
  it('마스터의 표시명으로 바꾼다', () => {
    renderTable({ rows: [row({ statusCode: 'SYN_RUN' })] });

    expect(screen.getByRole('cell', { name: '진행중' })).toBeInTheDocument();
  });

  it('표시명을 모르는 코드는 받은 값을 그대로 보인다', () => {
    renderTable({ rows: [row({ statusCode: 'SYN_UNSEEN' })] });

    expect(screen.getByRole('cell', { name: 'SYN_UNSEEN' })).toBeInTheDocument();
  });
});

/*
 * ⛔ 「SYN-WO-0007 상세 열기」를 눈에 보이는 글자로 쓰면 번호 열이 문장 열이 되어, 번호끼리
 * 견주며 훑는 일이 안 된다. 무엇을 여는지는 화면 읽기 도구에만 들려주면 된다.
 */
describe('W/O 번호 열', () => {
  it('⛔ 칸에는 번호만 보인다', () => {
    renderTable({ rows: [row({ workOrderNo: 'SYN-WO-0007' })] });

    expect(screen.getByRole('button', { name: t.select('SYN-WO-0007') })).toHaveTextContent(
      /^SYN-WO-0007$/,
    );
  });
});
