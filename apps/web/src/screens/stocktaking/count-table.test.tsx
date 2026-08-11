import type { Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { countFixtures, countResponse } from './fixtures';
import { buildCountColumns, CountTable, type CountTableProps } from './count-table';
import type { ReferenceSource } from './lookups';
import { toCountView, type CountView } from './types';

const t = messages.stocktaking;

/** `.wide-table`이 표에 주는 최소 폭(58rem). */
const WIDE_TABLE_MIN_PX = 928;

/** 「코드 · 이름」이 한 줄에 들어가는 폭(`docs/layout-conventions.md`의 선례 값). */
const CODE_NAME_COLUMN_PX = 200;

const toPx = (width: string | undefined): number =>
  width === undefined ? 0 : Number.parseInt(width, 10);

const specifiedWidthOf = (columns: Column<CountView>[]): number =>
  columns.reduce((sum, column) => sum + toPx(column.width), 0);

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '9101', label: 'SAMPLE-WH-01 · 합성 창고 가', isActive: true }],
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

const columnsWith = (warehouseLookup: ReferenceSource = source()): Column<CountView>[] =>
  buildCountColumns({
    selectedCountId: null,
    warehouseLookup,
    onToggleSelect: () => undefined,
  });

const rows = countFixtures.map(toCountView);

const renderTable = (overrides: Partial<CountTableProps> = {}) => {
  const onFirstPage = vi.fn<() => void>();
  const onToggleSelect = vi.fn<(inventoryCountId: number) => void>();
  const onRetryReferences = vi.fn<() => void>();

  render(
    <CountTable
      rows={rows}
      isLoading={false}
      isBeyondLast={false}
      selectedCountId={null}
      warehouseLookup={source()}
      onFirstPage={onFirstPage}
      onToggleSelect={onToggleSelect}
      onRetryReferences={onRetryReferences}
      {...overrides}
    />,
  );

  return { onFirstPage, onToggleSelect, onRetryReferences, user: userEvent.setup() };
};

describe('buildCountColumns — 열 구성과 폭', () => {
  it('열이 일곱이다', () => {
    expect(columnsWith().map((column) => column.key)).toEqual([
      'inventoryCountNo',
      'warehouse',
      'countTypeCode',
      'plannedDate',
      'blindCount',
      'statusCode',
      'select',
    ]);
  });

  /*
   * **M16** — 흡수 열이 둘이 되면 남는 폭이 나뉘어 「코드 · 이름」이 낱말 단위로 쪼개진다.
   * 하나도 없으면 표가 하한보다 좁아져 고정 배치가 남는 폭을 제멋대로 나눈다.
   */
  it('폭을 지정하지 않은 흡수 열이 정확히 하나다', () => {
    const absorbing = columnsWith().filter((column) => column.width === undefined);

    expect(absorbing).toHaveLength(1);
    expect(absorbing[0]?.key).toBe('warehouse');
  });

  /*
   * **흡수 열의 예산까지 세어야 뜻이 있다.** 지정 폭 합만 재면 그 합이 표 폭에 가까울 때
   * 흡수 열이 몇십 px밖에 못 받는 상태를 통과시킨다.
   */
  it('지정 폭 합에 흡수 열 예산을 더해도 표 하한 안이다', () => {
    expect(specifiedWidthOf(columnsWith()) + CODE_NAME_COLUMN_PX).toBeLessThanOrEqual(
      WIDE_TABLE_MIN_PX,
    );
  });

  it('흡수 열이 실제로 받는 폭이 예산보다 좁지 않다', () => {
    expect(WIDE_TABLE_MIN_PX - specifiedWidthOf(columnsWith())).toBeGreaterThanOrEqual(
      CODE_NAME_COLUMN_PX,
    );
  });

  /*
   * **S-1**(PR ② 착수 조건) — **정렬을 열지 않는다**는 규칙이 부품 주석에만 있고 세는 자리가
   * 없었다. 디자인 시스템 `Table`에는 서버 정렬 배선이 있으나 **계약의 실사 목록 조회에 `sort`
   * 쿼리가 없다**(실측 — 어긋남 3). 열에 `sortable: true`를 붙이면 헤더가 button이 되어 누를 수
   * 있게 되는데, 눌러도 서버는 그 조건을 모르고 화면은 **지금 쪽 안에서만** 다시 늘어놓는다 —
   * 사용자에게는 「정렬했는데 다른 쪽의 값이 안 따라온다」로 보인다.
   */
  it('어느 열도 정렬을 열지 않는다', () => {
    const columns = columnsWith();

    /* 짝 방향 — 열이 실제로 일곱이다(열이 없어서 통과하는 것이 아니다). */
    expect(columns).toHaveLength(7);
    expect(columns.filter((column) => column.sortable === true)).toEqual([]);
  });
});

describe('CountTable — 값 표기', () => {
  it('실사번호·유형·계획일·상태를 그대로 보인다', () => {
    renderTable();

    const table = screen.getByRole('table');

    /*
     * **건수를 못 박는다.** `getAllByText`는 0건이면 스스로 던지므로 「0건이 아니다」는 늘 참이라
     * 아무것도 재지 못한다 — 픽스처 세 줄 중 몇 줄이 그 값을 갖는지가 실제 단언이다.
     */
    expect(within(table).getByText('IC-2026-900011')).toBeInTheDocument();
    expect(within(table).getAllByText('SAMPLE_COUNT_TYPE_A')).toHaveLength(2);
    expect(within(table).getAllByText('2026-08-06')).toHaveLength(2);
    expect(within(table).getAllByText('SAMPLE_COUNT_STATUS_A')).toHaveLength(2);
  });

  /* **C18** — 참·거짓이 읽히는 말로 나온다. `true`/`false`가 그대로 나오면 값이 읽히지 않는다. */
  it('블라인드 여부를 읽히는 말로 보인다', () => {
    renderTable();

    const table = screen.getByRole('table');

    /* 세 줄 중 둘이 블라인드가 아니고 하나가 블라인드다 — 건수까지 못 박는다. */
    expect(within(table).getAllByText('아니오')).toHaveLength(2);
    expect(within(table).getByText('예')).toBeInTheDocument();
    expect(within(table).queryByText('true')).not.toBeInTheDocument();
    expect(within(table).queryByText('false')).not.toBeInTheDocument();
  });

  it('창고를 이름으로 풀어 보인다', () => {
    renderTable();

    /* 9001·9003이 같은 창고를 가리킨다 — 두 줄 모두 이름으로 풀린다. */
    expect(screen.getAllByText('SAMPLE-WH-01 · 합성 창고 가')).toHaveLength(2);
  });

  /*
   * **#47** — 이름 목록이 아직 오지 않은 것을 「알 수 없음」으로 내면 *값이 잘못됐다*는 뜻이 되어
   * 사용자에게 반대로 읽힌다. 미도착·실패·목록에 없음이 서로 다른 문구여야 한다.
   */
  it('참조가 아직 오지 않았으면 목록에 없음과 다른 문구를 낸다', () => {
    renderTable({ warehouseLookup: source({ isLoading: true, entries: [] }) });

    expect(screen.getAllByText(t.values.referenceLoading)).toHaveLength(rows.length);
    expect(screen.queryByText(t.values.unknown)).not.toBeInTheDocument();
  });

  it('참조 조회가 실패하면 목록에 없음과 다른 문구를 낸다', () => {
    renderTable({ warehouseLookup: source({ isError: true, entries: [] }) });

    expect(screen.getAllByText(t.values.referenceFailed)).toHaveLength(rows.length);
    expect(screen.queryByText(t.values.unknown)).not.toBeInTheDocument();
  });

  /*
   * **#44** — 이름을 못 풀어도 번호를 내지 않는다. 9102(둘째 행의 창고)는 참조 목록에 없다.
   * 짝 방향으로 「이름이 보인다」를 함께 단언한다 — 아무것도 안 그려도 통과하지 않게.
   */
  it('이름을 못 풀어도 내부 번호를 내지 않는다', () => {
    renderTable();

    const table = screen.getByRole('table');

    expect(within(table).getByText(t.values.unknown)).toBeInTheDocument();
    expect(within(table).getAllByText('SAMPLE-WH-01 · 합성 창고 가')).toHaveLength(2);
    expect(table.textContent ?? '').not.toContain('9102');
    expect(table.textContent ?? '').not.toContain('9101');
  });

  it('참조 조회가 실패하면 사유와 다시 시도를 낸다', async () => {
    const { onRetryReferences, user } = renderTable({
      warehouseLookup: source({ isError: true, entries: [] }),
    });

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
    expect(screen.getByText(t.reasons.warehouseReferenceFailed)).toBeInTheDocument();
  });
});

describe('CountTable — 선택과 빈 상태', () => {
  it('행의 선택 버튼 이름에 실사번호가 들어간다', async () => {
    const { onToggleSelect, user } = renderTable();

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('IC-2026-900011') }));

    expect(onToggleSelect).toHaveBeenCalledWith(9001);
  });

  it('고른 행은 선택 해제로 바뀐다', () => {
    renderTable({ selectedCountId: 9001 });

    expect(
      screen.getByRole('button', { name: t.actions.deselectRow('IC-2026-900011') }),
    ).toBeInTheDocument();
  });

  /*
   * **M08** — 빈 상태를 표의 `empty`가 맡는다. 바깥에서 0건을 갈라 다른 것을 그리면
   * `empty`가 닿을 수 없는 죽은 가지가 된다(W-01-07 Minor의 형태).
   */
  it('결과가 0건이면 표 안에서 없음을 알린다', () => {
    renderTable({ rows: [] });

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(t.empty.noResultTitle)).toBeInTheDocument();
  });

  /* 쪽 밖은 「결과가 없다」와 사용자가 할 조치가 다르다 — 첫 쪽으로 갈 수 있어야 한다. */
  it('쪽 밖이면 첫 쪽으로 가는 길을 낸다', async () => {
    const { onFirstPage, user } = renderTable({ rows: [], isBeyondLast: true });

    expect(screen.getByText(t.empty.beyondLastTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    expect(onFirstPage).toHaveBeenCalledTimes(1);
  });

  it('불러오는 중에는 골격을 낸다', () => {
    renderTable({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.counts })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  /* 한 쪽에 같은 상태 코드를 가진 행이 둘 있어도 각각 그려진다 — 코드가 접히지 않는다. */
  it('같은 상태 코드를 가진 행이 접히지 않는다', () => {
    renderTable({ rows: [toCountView(countResponse()), toCountView(countResponse({ inventoryCountId: 9003, inventoryCountNo: 'IC-2026-900013' }))] });

    expect(screen.getAllByText('SAMPLE_COUNT_STATUS_A')).toHaveLength(2);
  });
});
