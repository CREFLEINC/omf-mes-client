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
  buildPoColumns({
    selectedPoId: null,
    supplierLookup,
    isLocked: false,
    onToggleSelect: () => undefined,
  });

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
      isLocked={false}
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

  /*
   * **흡수 열의 예산까지 세어야 뜻이 있다.** 지정 폭 합만 재면 그 합이 표 폭에 가까울 때
   * 흡수 열에 남는 것이 사실상 없는 상태를 통과시킨다 — W-01-07 브라우저 확인에서
   * 실제로 흡수 열이 82px로 렌더돼 주 식별자가 낱말 단위로 쪼개졌다.
   *
   * `지정합 + 예산 ≤ 928`은 `928 − 지정합 ≥ 예산`과 **같은 부등식이다.** 둘을 나란히 두면
   * 감지기가 둘인 것처럼 보이지만 하나다 — 완료 조건(C18)의 낱말에 맞춰 합의 형태로만 적는다.
   */
  it('지정 폭 합에 흡수 열 예산을 더해도 표 하한 안이다', () => {
    expect(specifiedWidthOf(columnsWith()) + CODE_NAME_COLUMN_PX).toBeLessThanOrEqual(
      WIDE_TABLE_MIN_PX,
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

  /*
   * 등록을 보내는 중에 대상을 바꾸면 **앞 발주의 등록 결과가 지금 보는 발주의 맥락에**
   * 나타난다. 중복 전송이 생기지는 않지만 무엇이 어느 발주에 등록됐는지가 흐려진다.
   */
  it('보내는 중에는 대상을 바꾸는 길이 닫힌다', async () => {
    const { onToggleSelect, user } = renderTable({ isLocked: true });

    const target = screen.getByRole('button', {
      name: t.actions.selectRow('PO-2026-900001'),
    });

    expect(target).toBeDisabled();

    await user.click(target);

    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  /* 짝 방향 — 평상시에는 열려 있다. 늘 닫혀 있으면 위 단언이 항상 참이 된다. */
  it('보내는 중이 아니면 선택이 열려 있다', () => {
    renderTable();

    expect(
      screen.getByRole('button', { name: t.actions.selectRow('PO-2026-900001') }),
    ).toBeEnabled();
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
