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
  productionLineIdText: '7',
  processText: '합성 공정',
  orderQtyText: '3,000',
  goodQtyText: '2,850',
  defectQtyText: '10',
  holdQtyText: '5',
  scrapQtyText: '3',
  reworkQtyText: '2',
  hasHoldQty: true,
  hasScrapQty: true,
  hasReworkQty: true,
  achievementRateText: '95%',
  achievementPercent: 95,
  statusCode: 'SYN_RUN',
  plannedStartAt: '2026-08-04T08:00:00+07:00',
  plannedEndAt: '2026-08-04T18:00:00+07:00',
  plannedStartAtText: '2026-08-04 08:00',
  plannedEndAtText: '2026-08-04 18:00',
  isReleased: true,
  isFinished: false,
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
      lineLabel={(id) => (id === '7' ? 'SYN-LINE-A · 합성 라인' : '이름 확인 중')}
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
  /* 표 하나뿐인 구획이라 「목록」 제목은 보태는 것이 없다 — 이름은 접근 이름으로만 둔다. */
  it('목록을 이름 있는 구획으로 두되 제목을 따로 세우지 않는다', () => {
    const { region } = renderTable();

    expect(within(region).queryByRole('heading', { name: t.title })).not.toBeInTheDocument();
    expect(within(region).getByRole('table', { name: t.title })).toBeInTheDocument();
  });

  it('값이 있으면 수량 다섯을 그대로 보인다 — 셋으로 접지 않는다', () => {
    const { region } = renderTable();

    for (const value of ['2,850', '10', '5', '3', '2']) {
      expect(within(region).getByText(value)).toBeInTheDocument();
    }
  });

  describe('보류 · 스크랩 · 재작업 열', () => {
    const quiet = { hasHoldQty: false, hasScrapQty: false, hasReworkQty: false };

    /* 실적 없는 지시만 있는 쪽에서 0 이 다섯 번 되풀이되면 표가 읽히지 않는다. */
    it('이 쪽에 값이 하나도 없으면 열을 열지 않는다 — 양품 · 불량은 늘 둔다', () => {
      const { region } = renderTable({ rows: [row(quiet)] });

      for (const name of [t.columns.holdQty, t.columns.scrapQty, t.columns.reworkQty]) {
        expect(within(region).queryByRole('columnheader', { name })).not.toBeInTheDocument();
      }
      expect(within(region).getByRole('columnheader', { name: t.columns.goodQty })).toBeVisible();
      expect(within(region).getByRole('columnheader', { name: t.columns.defectQty })).toBeVisible();
    });

    it('한 줄에라도 값이 있으면 그 열만 연다', () => {
      const { region } = renderTable({
        rows: [
          row({ ...quiet, workOrderId: 1 }),
          row({ ...quiet, workOrderId: 2, hasHoldQty: true }),
        ],
      });

      expect(within(region).getByRole('columnheader', { name: t.columns.holdQty })).toBeVisible();
      expect(
        within(region).queryByRole('columnheader', { name: t.columns.scrapQty }),
      ).not.toBeInTheDocument();
    });
  });

  it('0 은 흐리게 적는다 — 값이 있는 칸이 먼저 보인다', () => {
    const { region } = renderTable({ rows: [row({ goodQtyText: '0', defectQtyText: '10' })] });

    expect(within(region).getByText('0')).toHaveClass('work-order-progress-zero');
    expect(within(region).getByText('10')).not.toHaveClass('work-order-progress-zero');
  });

  describe('달성률', () => {
    /* ⛔ 숫자는 서버가 준 값을 그대로 — 막대 길이에서 다시 만들지 않는다(L-2). */
    it('막대와 서버가 준 숫자를 한 칸에 보인다', () => {
      const { region } = renderTable();
      const bar = within(region).getByRole('progressbar', { name: t.columns.achievementRate });

      expect(bar).toHaveAttribute('aria-valuenow', '95');
      expect(within(region).getByText('95%')).toBeInTheDocument();
    });

    it('⛔ 받지 못한 달성률에는 막대를 그리지 않는다 — 0% 로 읽히지 않게', () => {
      const { region } = renderTable({
        rows: [row({ achievementPercent: null, achievementRateText: t.blank })],
      });

      expect(within(region).queryByRole('progressbar')).not.toBeInTheDocument();
    });
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
    it('지연을 칩으로 보이고 넘긴 계획 종료를 같은 색으로 짚는다', () => {
      const { region } = renderTable({ rows: [row({ delay: 'delayed' })] });
      const line = within(region).getByRole('row', { name: /SYN-WO-0007/ });

      expect(within(line).getByText(t.delayed)).toBeInTheDocument();
      expect(within(line).getByText('2026-08-04 18:00')).toHaveClass('work-order-progress-late');
    });

    /* 정상은 표시하지 않고 예외만 보인다 — 「—」는 값이 빠진 것으로 읽힌다. */
    it('정상인 줄은 지연 칸을 비운다', () => {
      const { region } = renderTable({ rows: [row({ delay: 'onTime' })] });
      const line = within(region).getByRole('row', { name: /SYN-WO-0007/ });

      expect(within(line).queryByText(t.delayed)).not.toBeInTheDocument();
      expect(within(line).queryByText(t.delayUnknown)).not.toBeInTheDocument();
      expect(within(line).getByText('2026-08-04 18:00')).not.toHaveClass(
        'work-order-progress-late',
      );
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
      ['품목코드', t.columns.itemCode],
      ['품목명', t.columns.itemName],
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

  describe('라인 열', () => {
    it('W/O 번호 바로 뒤에 두고 라인 이름을 적는다', () => {
      const { region } = renderTable();
      const headers = within(region)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent?.trim());

      expect(headers.indexOf(t.columns.productionLine)).toBe(
        headers.findIndex((text) => text?.startsWith(t.columns.workOrderNo)) + 1,
      );
      expect(within(region).getByRole('cell', { name: '합성 라인' })).toBeInTheDocument();
    });

    /* ⛔ 숫자 번호는 사용자가 쓰는 말이 아니다 — 이름을 모르면 모른다고 적는다. */
    it('⛔ 이름을 못 찾은 라인은 번호 대신 「이름 확인 중」이다', () => {
      const { region } = renderTable({ rows: [row({ productionLineIdText: '99' })] });

      expect(within(region).getByRole('cell', { name: '이름 확인 중' })).toBeInTheDocument();
      expect(within(region).queryByText('99')).not.toBeInTheDocument();
    });

    it('라인이 정해지지 않은 지시는 「—」다', () => {
      const { region } = renderTable({ rows: [row({ productionLineIdText: null })] });
      const line = within(region).getByRole('row', { name: /SYN-WO-0007/ });

      expect(within(line).getAllByRole('cell')[1]).toHaveTextContent(t.blank);
    });
  });

  /* 공정명은 응답에 실려 온다 — 줄마다 다시 묻지 않는다. P/O 는 상세 창에 둔다. */
  it('공정 열을 둔다', () => {
    const { region } = renderTable();

    expect(within(region).getByRole('columnheader', { name: t.columns.process })).toBeVisible();
    expect(within(region).getByRole('cell', { name: '합성 공정' })).toBeInTheDocument();
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
