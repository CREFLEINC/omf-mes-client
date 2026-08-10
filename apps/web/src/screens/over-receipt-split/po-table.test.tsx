import type { Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { purchaseOrder, purchaseOrderFixtures } from './fixtures';
import type { ReferenceSource } from './lookups';
import { buildPoColumns, PoTable, type PoTableProps } from './po-table';
import type { PoView } from './types';

const t = messages.overReceiptSplit;

/** `.wide-table`이 표에 주는 최소 폭(58rem). */
const WIDE_TABLE_MIN_PX = 928;

/** 「코드 · 이름」이 한 줄에 들어가는 폭(`docs/layout-conventions.md`의 선례 값). */
const CODE_NAME_COLUMN_PX = 200;

const toPx = (width: string | undefined): number =>
  width === undefined ? 0 : Number.parseInt(width, 10);

const specifiedWidthOf = (columns: Column<PoView>[]): number =>
  columns.reduce((sum, column) => sum + toPx(column.width), 0);

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '9101', label: 'SAMPLE-SUP-01 · 합성 공급사 가', isActive: true }],
  isError: false,
  isLoading: false,
  ...overrides,
});

const columnsWith = (supplierLookup: ReferenceSource = source()): Column<PoView>[] =>
  buildPoColumns({ selectedPoId: null, supplierLookup, onToggleSelect: () => undefined });

const renderTable = (overrides: Partial<PoTableProps> = {}) => {
  const onFirstPage = vi.fn<() => void>();
  const onToggleSelect = vi.fn<(purchaseOrderId: number) => void>();
  const onRetryReferences = vi.fn<() => void>();

  render(
    <PoTable
      rows={purchaseOrderFixtures}
      isLoading={false}
      isBeyondLast={false}
      selectedPoId={null}
      supplierLookup={source()}
      onFirstPage={onFirstPage}
      onToggleSelect={onToggleSelect}
      onRetryReferences={onRetryReferences}
      {...overrides}
    />,
  );

  return { onFirstPage, onToggleSelect, onRetryReferences, user: userEvent.setup() };
};

const table = (): HTMLElement => screen.getByRole('table');

describe('buildPoColumns — 열 구성과 폭', () => {
  it('열이 여섯이다', () => {
    expect(columnsWith()).toHaveLength(6);
  });

  /*
   * **M41** — 흡수 열이 둘이 되면 남는 폭이 나뉘어 「코드 · 이름」이 낱말 단위로 쪼개진다.
   * 하나도 없으면 표가 하한보다 좁아져 고정 배치가 남는 폭을 제멋대로 나눈다.
   */
  it('폭을 지정하지 않은 흡수 열이 정확히 하나다', () => {
    const absorbing = columnsWith().filter((column) => column.width === undefined);

    expect(absorbing.map((column) => column.key)).toEqual(['supplier']);
  });

  it('지정 폭 합에 흡수 열 예산을 더해도 표 하한 안이다', () => {
    expect(specifiedWidthOf(columnsWith()) + CODE_NAME_COLUMN_PX).toBeLessThanOrEqual(
      WIDE_TABLE_MIN_PX,
    );
  });

  /*
   * **합만 세면 흡수 열이 몇십 px밖에 못 받는 상태를 통과시킨다** — 지정 합이 표 폭에 가까우면
   * 고정 배치에서 그 열에 남는 것이 사실상 없다(W-01-07 브라우저 확인에서 실제로 난 결함이다).
   * 그래서 **남는 폭까지 함께 단언한다.**
   */
  it('표 하한에서 흡수 열이 받는 폭이 「코드 · 이름」 하한 이상이다', () => {
    expect(WIDE_TABLE_MIN_PX - specifiedWidthOf(columnsWith())).toBeGreaterThanOrEqual(
      CODE_NAME_COLUMN_PX,
    );
  });
});

describe('PoTable — 참조 표기', () => {
  it('공급사를 이름으로 풀어 낸다', () => {
    renderTable();

    expect(within(table()).getAllByText('SAMPLE-SUP-01 · 합성 공급사 가')).toHaveLength(2);
  });

  /*
   * **M13** — 이름을 못 풀어도 내부 번호를 내지 않는다(#44).
   * 짝 방향으로 「풀리는 행은 이름이 보인다」를 함께 둔다 — 아무것도 안 그려도 통과하지 않게 한다.
   */
  it('목록에 없는 공급사도 번호가 아니라 문구로 낸다', () => {
    renderTable();

    expect(within(table()).getByText(t.values.unknown)).toBeInTheDocument();
    expect(within(table()).queryByText('9102')).not.toBeInTheDocument();
    expect(within(table()).queryByText('9002')).not.toBeInTheDocument();
  });

  /*
   * **M12** — 아직 오지 않은 것을 「알 수 없음」으로 내면 정상 값이 잘못된 값으로 읽힌다(#47).
   */
  it('참조가 아직 오지 않았으면 「알 수 없음」이 아니다', () => {
    renderTable({ supplierLookup: source({ isLoading: true, entries: [] }) });

    expect(within(table()).getAllByText(t.values.referenceLoading)).toHaveLength(3);
    expect(within(table()).queryByText(t.values.unknown)).not.toBeInTheDocument();
  });

  it('참조 조회에 실패하면 사유와 복구 수단을 함께 낸다', async () => {
    const { onRetryReferences, user } = renderTable({
      supplierLookup: source({ isError: true, entries: [] }),
    });

    expect(within(table()).getAllByText(t.values.referenceFailed)).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  it('참조가 정상이면 복구 수단을 내지 않는다', () => {
    renderTable();

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /* 값이 없는 칸을 비워 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
  it('입고 예정일이 없으면 대시로 낸다', () => {
    renderTable({ rows: [purchaseOrder({ expectedReceiptDate: null })] });

    expect(within(table()).getByText(t.values.empty)).toBeInTheDocument();
  });
});

describe('PoTable — 고르기', () => {
  it('행마다 선택 버튼의 접근 이름이 발주번호로 갈린다', () => {
    renderTable();

    expect(
      screen.getByRole('button', { name: t.actions.selectRow('PO-2026-900001') }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t.actions.selectRow('PO-2026-900002') }),
    ).toBeInTheDocument();
  });

  it('고른 행은 선택 해제로 바뀐다', () => {
    renderTable({ selectedPoId: 9001 });

    expect(
      screen.getByRole('button', { name: t.actions.deselectRow('PO-2026-900001') }),
    ).toBeInTheDocument();
  });

  it('누르면 그 발주의 번호를 넘긴다', async () => {
    const { onToggleSelect, user } = renderTable();

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('PO-2026-900001') }));

    expect(onToggleSelect).toHaveBeenCalledWith(9001);
  });

  /* 접근 이름에 내부 번호를 넣으면 그것이 화면 밖으로 새는 또 하나의 경로가 된다. */
  it('선택 버튼의 접근 이름에 내부 번호를 넣지 않는다', () => {
    renderTable();

    for (const button of screen.getAllByRole('button')) {
      expect(button.getAttribute('aria-label') ?? '').not.toContain('9001');
    }
  });
});

describe('PoTable — 빈 상태 두 갈래', () => {
  /*
   * **M07의 부품 몫** — 「결과가 없다」와 「이 쪽에 없다」는 사용자가 할 조치가 다르다.
   */
  it('결과가 없으면 조건을 고치라고 안내한다', () => {
    renderTable({ rows: [] });

    expect(screen.getByText(t.empty.noResultTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  it('쪽 밖이면 첫 쪽으로 가는 수단을 함께 낸다', async () => {
    const { onFirstPage, user } = renderTable({ rows: [], isBeyondLast: true });

    expect(screen.getByText(t.empty.beyondLastTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    expect(onFirstPage).toHaveBeenCalledTimes(1);
  });

  /* 기다리는 동안 「없습니다」를 내면 사용자가 자료가 없는 줄 안다. */
  it('불러오는 중에는 빈 상태 문구를 내지 않는다', () => {
    renderTable({ rows: [], isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.purchaseOrders })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });
});
