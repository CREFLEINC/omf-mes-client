import type { Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { transactionFixtures } from './fixtures';
import { toPageView } from './pagination';
import {
  buildTransactionColumns,
  TransactionPane,
  type TransactionPaneProps,
} from './transaction-pane';
import type { TransactionView } from './types';

const t = messages.stockStatus;

/** `.wide-table`이 표에 주는 최소 폭(58rem). **바닥이지 천장이 아니다.** */
const WIDE_TABLE_MIN_PX = 928;

/** 축 열(주 식별자)이 한 줄에 들어가는 폭(계획 정정 2). */
const AXIS_COLUMN_PX = 200;

const toPx = (width: string | undefined): number =>
  width === undefined ? 0 : Number.parseInt(width, 10);

const columns = (): Column<TransactionView>[] =>
  buildTransactionColumns({ selected: null, onToggleSelect: () => undefined });

const PERIOD = { from: '2026-07-10', to: '2026-08-10' };

const pageView = (total = transactionFixtures.length) =>
  toPageView({ page: 1, size: 50, total }, transactionFixtures.length);

const renderPane = (overrides: Partial<TransactionPaneProps> = {}) => {
  const onSearch = vi.fn<TransactionPaneProps['onSearch']>();
  const onToggleSelect = vi.fn<TransactionPaneProps['onToggleSelect']>();
  const onChangePage = vi.fn<TransactionPaneProps['onChangePage']>();

  const view = render(
    <TransactionPane
      appliedPeriod={PERIOD}
      rows={transactionFixtures}
      isLoading={false}
      hasQuery
      pageView={pageView()}
      selected={null}
      onSearch={onSearch}
      onToggleSelect={onToggleSelect}
      onChangePage={onChangePage}
      {...overrides}
    />,
  );

  return { onSearch, onToggleSelect, onChangePage, view, user: userEvent.setup() };
};

const table = (): HTMLElement => screen.getByRole('table');

const headerNames = (): string[] =>
  within(table())
    .getAllByRole('columnheader')
    .map((cell) => cell.textContent ?? '');

describe('TransactionPane — 열 구성', () => {
  /*
   * **수량 열이 없다**(C56). 계약의 이 목록은 헤더라 수량을 주지 않는다 — 만들면 라인을
   * 훑어 더해야 하고, 라인마다 단위가 달라 그 합은 틀린 값이다.
   */
  it('머리글에 수량이 없다', () => {
    renderPane();

    expect(headerNames()).toEqual([
      t.history.table.businessDate,
      t.history.table.transactionNo,
      t.history.table.transactionType,
      t.history.table.sourceDocumentType,
      t.history.table.status,
      t.history.table.occurredAt,
      t.history.table.select,
    ]);
    /* 선행 단언과 짝을 이룬다 — 머리글이 실제로 그려진 뒤에 「없다」를 본다. */
    expect(headerNames()).not.toContain(t.history.lines.qty);
  });

  /* 축 열은 「번호 + 역처리 칩」이 한 줄에 들어가야 훑을 수 있다(계획 정정 2). */
  it('축 열이 200px 이상이고 모든 열이 폭을 지정한다', () => {
    const all = columns();

    expect(
      toPx(all.find((column) => column.key === 'transactionNo')?.width),
    ).toBeGreaterThanOrEqual(AXIS_COLUMN_PX);
    expect(all.every((column) => column.width !== undefined)).toBe(true);
  });

  /*
   * **합을 `.wide-table` 하한 아래로 누르지 않는다.** 고정 배치에서 합이 하한보다 작으면
   * 남는 폭이 나뉘어 들어가 선언과 실렌더가 어긋난다(브라우저 확인 F-B2).
   */
  it('열 폭 합이 wide-table 하한 이상이다', () => {
    const total = columns().reduce((sum, column) => sum + toPx(column.width), 0);

    expect(total).toBeGreaterThanOrEqual(WIDE_TABLE_MIN_PX);
  });

  /*
   * **이 구획에 선택칸을 두지 않는다**(계획 결정 14 · #45). 거래 유형 조건을 `Select`로
   * 만들면 값 목록이 미확정이라 자리표시가 비고, 조건 입력이 창으로 옮겨졌을 때
   * 「창 안 선택칸이 잘린다」가 걸릴 자리가 생긴다.
   */
  it('조건에 선택칸이 없고 날짜 두 칸과 버튼뿐이다', () => {
    renderPane();

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.history.periodFrom)).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText(t.history.periodTo)).toHaveAttribute('type', 'date');
  });

  /*
   * **원천 전표의 번호를 내지 않는다**(#44 · C56). 유형 코드만 낸다 — 번호를 이름으로 풀
   * 참조가 이 화면에 없어 내면 내부 번호가 그대로 화면에 선다.
   */
  it('원천 전표 유형 코드는 내고 그 번호는 내지 않는다', () => {
    renderPane();

    const body = table().textContent ?? '';

    expect(body).toContain('SAMPLE_SRC_T_A');
    /* 픽스처의 번호 대역(9900대)이 표 어디에도 나오지 않는다. */
    expect(body).not.toContain('9901');
    expect(body).not.toContain('9902');
  });
});

describe('TransactionPane — 표시', () => {
  /* 취소가 행을 지우지 않고 역처리 행을 더한다 — 표식이 없으면 두 번 움직인 것으로 읽는다. */
  it('역처리 거래에만 표식이 붙는다', () => {
    renderPane();

    const rows = within(table()).getAllByRole('row');
    const marks = within(table()).getAllByText(t.history.reversal);

    expect(marks).toHaveLength(1);
    /* 짝 방향 — 표식이 붙지 않은 줄이 함께 있다(둘 다 붙으면 위 단언이 무의미해진다). */
    expect(rows.length).toBeGreaterThan(marks.length);
  });

  /* 25자 원본을 그대로 그리면 124px 열에서 여러 줄로 접힌다 — `as-of.ts`가 줄인 형태를 쓴다. */
  it('발생 시각을 MM-DD HH:mm으로 줄여 낸다', () => {
    renderPane();

    expect(within(table()).getByText('08-06 09:12')).toBeInTheDocument();
    expect(within(table()).queryByText('2026-08-06T09:12:00+09:00')).not.toBeInTheDocument();
  });

  /* 영업일은 식별자의 일부라 줄여 적지 않는다 — 상세를 부를 때 경로에 그대로 실린다. */
  it('영업일은 YYYY-MM-DD 그대로 낸다', () => {
    renderPane();

    expect(within(table()).getByText('2026-08-06')).toBeInTheDocument();
  });

  /*
   * 접근 이름에 **거래 번호**를 넣는다 — 「보기」가 줄마다 되풀이되면 어느 거래를 여는지
   * 보조기술 사용자가 알 수 없다.
   */
  it('라인 열기 버튼의 접근 이름에 거래 번호가 있다', async () => {
    const { onToggleSelect, user } = renderPane();

    await user.click(
      screen.getByRole('button', { name: t.history.showLinesRow('SAMPLE-IT-0001') }),
    );

    expect(onToggleSelect).toHaveBeenCalledWith(transactionFixtures[0]);
  });

  /*
   * **영업일과 번호가 둘 다 같아야 같은 거래다** — 번호만 견주면 다른 영업일의 같은 번호가
   * 열린 것으로 보인다. 픽스처의 두 줄은 영업일이 다르다.
   */
  it('고른 줄만 「닫기」가 되고 나머지는 「보기」다', () => {
    renderPane({ selected: { businessDate: '2026-08-06', transactionId: 9901 } });

    expect(
      screen.getByRole('button', { name: t.history.hideLinesRow('SAMPLE-IT-0001') }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t.history.showLinesRow('SAMPLE-IT-0002') }),
    ).toBeInTheDocument();
  });

  it('영업일이 다르면 같은 번호라도 고른 것으로 보지 않는다', () => {
    renderPane({ selected: { businessDate: '2026-08-07', transactionId: 9901 } });

    expect(
      screen.getByRole('button', { name: t.history.showLinesRow('SAMPLE-IT-0001') }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /닫기$/ })).not.toBeInTheDocument();
  });
});

describe('TransactionPane — 기간 조건', () => {
  /*
   * **기간이 없으면 조회를 잠근다**(계획 결정 14). 성능이 아니라 가능·불가능의 문제라
   * 사유를 그렇게 적고, 비활성 컨트롤은 포커스를 받지 못하므로 항상 보이는 텍스트로 잇는다.
   */
  it('기간이 비면 조회가 잠기고 사유가 보인다', () => {
    renderPane({ appliedPeriod: { from: '', to: '' } });

    expect(screen.getByRole('button', { name: messages.common.search })).toBeDisabled();
    expect(screen.getByText(t.reasons.historyNeedsPeriod)).toBeInTheDocument();
  });

  /* 한쪽만 채운 기간으로는 조회할 수 없다 — 계약이 둘 다 필수로 둔다. */
  it('한쪽만 채운 기간에서도 조회가 잠긴다', () => {
    renderPane({ appliedPeriod: { from: '2026-07-10', to: '' } });

    expect(screen.getByRole('button', { name: messages.common.search })).toBeDisabled();
  });

  it('뒤집힌 기간에는 다른 사유를 낸다', () => {
    renderPane({ appliedPeriod: { from: '2026-08-10', to: '2026-07-10' } });

    expect(screen.getByRole('button', { name: messages.common.search })).toBeDisabled();
    expect(screen.getByText(t.reasons.historyPeriodReversed)).toBeInTheDocument();
    expect(screen.queryByText(t.reasons.historyNeedsPeriod)).not.toBeInTheDocument();
  });

  /* 짝 방향 — 성한 기간에서는 잠기지 않고 사유도 나오지 않는다. */
  it('성한 기간에서는 조회할 수 있다', async () => {
    const { onSearch, user } = renderPane();

    expect(screen.queryByText(t.reasons.historyNeedsPeriod)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(PERIOD);
  });

  /*
   * **되돌림을 참조가 아니라 값으로 판정한다**(#43). 같은 값의 새 객체를 부모가 다시 내려도
   * 고치던 날짜가 사라지지 않아야 한다 — 조회 응답이 도착해 다시 그려질 때가 그 자리다.
   */
  it('같은 값의 새 객체를 다시 받아도 고치던 날짜가 남는다', async () => {
    const { view, user } = renderPane();

    const from = screen.getByLabelText(t.history.periodFrom);

    await user.clear(from);
    await user.type(from, '2026-05-01');

    view.rerender(
      <TransactionPane
        appliedPeriod={{ ...PERIOD }}
        rows={transactionFixtures}
        isLoading={false}
        hasQuery
        pageView={pageView()}
        selected={null}
        onSearch={() => undefined}
        onToggleSelect={() => undefined}
        onChangePage={() => undefined}
      />,
    );

    expect(screen.getByLabelText(t.history.periodFrom)).toHaveValue('2026-05-01');
  });

  /* 주소가 정본이다 — 값이 실제로 달라지면 고치던 값도 그 값으로 되돌아간다. */
  it('적용된 기간이 달라지면 칸이 따라간다', () => {
    const { view } = renderPane();

    view.rerender(
      <TransactionPane
        appliedPeriod={{ from: '2026-01-01', to: '2026-01-31' }}
        rows={transactionFixtures}
        isLoading={false}
        hasQuery
        pageView={pageView()}
        selected={null}
        onSearch={() => undefined}
        onToggleSelect={() => undefined}
        onChangePage={() => undefined}
      />,
    );

    expect(screen.getByLabelText(t.history.periodFrom)).toHaveValue('2026-01-01');
  });
});

describe('TransactionPane — 빈 상태 세 갈래', () => {
  /*
   * **조회 전이 맨 앞이다.** 요청을 보내지 않은 상태를 「기록이 없다」로 말하면 안내가 시키는
   * 조치(기간을 넓혀라)가 실제 원인(기간을 안 넣었다)과 어긋난다.
   */
  it('기간이 없으면 「아직 조회하지 않았다」이고 결과 없음이 아니다', () => {
    renderPane({ rows: [], hasQuery: false, appliedPeriod: { from: '', to: '' } });

    expect(screen.getByText(t.history.empty.notQueriedTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.history.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.history.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  it('조회했는데 0건이면 「기록이 없다」이고 미조회가 아니다', () => {
    renderPane({ rows: [], pageView: toPageView({ page: 1, size: 50, total: 0 }, 0) });

    expect(screen.getByText(t.history.empty.noResultTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.history.empty.notQueriedTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.history.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  it('쪽 밖이면 첫 쪽으로 가는 안내를 낸다', async () => {
    const { onChangePage, user } = renderPane({
      rows: [],
      pageView: toPageView({ page: 9, size: 50, total: 3 }, 0),
    });

    expect(screen.getByText(t.history.empty.beyondLastTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.history.empty.noResultTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    expect(onChangePage).toHaveBeenCalledWith(1);
  });

  /* 조회하지 않았으면 넘길 쪽이 없다 — 쪽 이동을 내면 누를 수 없는 버튼이 생긴다. */
  it('조회 전에는 쪽 이동을 내지 않는다', () => {
    renderPane({ rows: [], hasQuery: false, appliedPeriod: { from: '', to: '' } });

    expect(screen.queryByRole('navigation', { name: t.pageNav.label })).not.toBeInTheDocument();
  });

  it('조회 중에는 표 대신 로딩 표기를 낸다', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.history })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
