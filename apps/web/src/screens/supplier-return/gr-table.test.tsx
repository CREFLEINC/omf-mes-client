import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { goodsReceiptFixtures, INTERNAL_IDS, warehouseFixtures } from './fixtures';
import { buildGrColumns, GrTable, TABLE_MIN_WIDTH_PX, type GrTableProps } from './gr-table';
import type { ReferenceSource } from './lookups';

const t = messages.supplierReturn;

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 창고 가';

const warehouseSource = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: warehouseFixtures.map((warehouse) => ({
    value: String(warehouse.warehouseId),
    label: `${warehouse.warehouseCode} · ${warehouse.warehouseName}`,
    isActive: warehouse.isActive,
  })),
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

const baseProps = (overrides: Partial<GrTableProps> = {}): GrTableProps => ({
  rows: goodsReceiptFixtures,
  isLoading: false,
  isBeyondLast: false,
  selectedReceiptId: null,
  warehouseLookup: warehouseSource(),
  onFirstPage: vi.fn(),
  onToggleSelect: vi.fn(),
  onRetryReferences: vi.fn(),
  ...overrides,
});

const renderTable = (overrides: Partial<GrTableProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<GrTable {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

describe('buildGrColumns — 열 폭 예산', () => {
  const columns = buildGrColumns({
    selectedReceiptId: null,
    warehouseLookup: warehouseSource(),
    onToggleSelect: vi.fn(),
  });

  /**
   * **M14** — 흡수 열이 둘이 되거나 지정 폭이 커지면 표가 하한을 넘겨 늘 가로 스크롤이 된다.
   * 열 폭 합만 세면 흡수 열이 몇십 px밖에 못 받는 어긋남을 놓치므로 **남는 폭까지 함께 잰다.**
   */
  it('흡수 열이 정확히 하나다', () => {
    expect(columns.filter((column) => column.width === undefined)).toHaveLength(1);
  });

  it('지정 폭 합과 흡수 예산이 표 하한 안에 든다', () => {
    const fixed = columns.reduce(
      (sum, column) => sum + Number.parseInt(column.width ?? '0px', 10),
      0,
    );

    expect(fixed).toBe(680);
    /* 흡수 열이 실제로 받는 폭이 예산(200px)보다 넓어야 「코드 · 이름」이 접히지 않는다. */
    expect(TABLE_MIN_WIDTH_PX - fixed).toBeGreaterThanOrEqual(200);
  });

  it('열이 여섯이다', () => {
    expect(columns.map((column) => column.key)).toEqual([
      'goodsReceiptNo',
      'warehouse',
      'receiptTypeCode',
      'receiptDatetime',
      'statusCode',
      'select',
    ]);
  });
});

describe('GrTable — 행 표기', () => {
  it('입고번호와 일시를 읽을 수 있게 낸다', () => {
    renderTable();

    expect(screen.getByText('GR-2026-900001')).toBeInTheDocument();
    /* 9001·9002가 같은 일시라 두 칸이 나온다 — 표기가 도는지를 보는 것이 이 단언이다. */
    expect(screen.getAllByText('2026-08-06 09:12')).toHaveLength(2);
    expect(screen.getByText('2026-08-07 10:05')).toBeInTheDocument();
  });

  /** 짝 방향 단언 — 이름이 실제로 보이고, 그 자리에 번호가 없다(#44). */
  it('창고를 이름으로 풀고 번호를 내지 않는다', () => {
    const { container } = renderTable();

    expect(screen.getAllByText(WAREHOUSE_LABEL).length).toBeGreaterThan(0);

    for (const id of INTERNAL_IDS) {
      expect(container.textContent ?? '').not.toContain(id);
    }
  });

  /* 이름을 못 푼 갈래도 번호를 내지 않는다 — 「알 수 없음」이 그 자리를 맡는다. */
  it('목록에 없는 창고는 알 수 없음으로 낸다', () => {
    const { container } = renderTable();

    expect(screen.getByText(t.values.unknown)).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('9799');
  });

  it('참조가 아직 오지 않은 것과 목록에 없는 것을 가른다', () => {
    renderTable({ warehouseLookup: warehouseSource({ entries: [], isLoading: true }) });

    expect(screen.getAllByText(t.values.referenceLoading).length).toBe(
      goodsReceiptFixtures.length,
    );
    expect(screen.queryByText(t.values.unknown)).not.toBeInTheDocument();
  });
});

describe('GrTable — 고르기', () => {
  it('행마다 어느 건인지 밝히는 선택 버튼이 있다', async () => {
    const { onToggleSelect, user } = renderTable();

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('GR-2026-900001') }));

    expect(onToggleSelect).toHaveBeenCalledWith(9001);
  });

  it('고른 행은 해제 버튼이 된다', () => {
    renderTable({ selectedReceiptId: 9001 });

    expect(
      screen.getByRole('button', { name: t.actions.deselectRow('GR-2026-900001') }),
    ).toBeInTheDocument();
  });
});

describe('GrTable — 빈 상태와 실패', () => {
  /**
   * **M18** — 바깥에서 0건을 갈라 내면 `Table.empty`가 닿을 수 없는 가지가 된다.
   * 표를 늘 그리고 빈 상태는 표가 맡는다.
   */
  it('결과가 없으면 표의 빈 상태가 맡는다', () => {
    renderTable({ rows: [] });

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(t.empty.noResultTitle)).toBeInTheDocument();
  });

  /* 「결과가 없다」와 「이 쪽에 없다」는 사용자가 할 조치가 다르다. */
  it('쪽 밖이면 첫 쪽으로 가는 길을 낸다', async () => {
    const { onFirstPage, user } = renderTable({ rows: [], isBeyondLast: true });

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.getByText(t.empty.beyondLastTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    expect(onFirstPage).toHaveBeenCalledTimes(1);
  });

  it('불러오는 중에는 골격을 낸다', () => {
    renderTable({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.goodsReceipts })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('참조 실패에는 사유와 다시 시도를 함께 낸다', async () => {
    const { onRetryReferences, user } = renderTable({
      warehouseLookup: warehouseSource({ isError: true }),
    });

    expect(screen.getByText(t.reasons.referencesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  it('참조가 정상이면 실패 안내가 없다', () => {
    renderTable();

    expect(screen.queryByText(t.reasons.referencesFailed)).not.toBeInTheDocument();
  });
});

describe('GrTable — 표 구조', () => {
  it('머리글 한 줄과 행 세 줄을 그린다', () => {
    renderTable();

    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(
      goodsReceiptFixtures.length + 1,
    );
  });
});
