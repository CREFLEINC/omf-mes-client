import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  AdjustLineTable,
  type AdjustLineRow,
  type AdjustLineTableProps,
} from './adjust-line-table';
import { adjustLineDraft } from './fixtures';
import type { LotLookupResult, ReferenceSource } from './lookups';
import { lineFieldId } from './validation';

const t = messages.stockAdjust;

const source = (entries: ReferenceSource['entries']): ReferenceSource => ({
  entries,
  isError: false,
  isLoading: false,
  truncated: false,
});

const locationLookup = source([
  { value: '9401', label: 'SAMPLE-LOC-01 · 합성 위치 가', isActive: true },
]);
const itemLookup = source([
  { value: '9501', label: 'SAMPLE-ITEM-A · 합성 품목 가', isActive: true },
]);
const uomLookup = source([{ value: '9601', label: 'SAMPLE-EA · 합성 단위 개', isActive: true }]);

const lotLookup: LotLookupResult = {
  entries: [{ value: '9701', label: 'SAMPLE-LOT-0001', isActive: true, itemId: '9501' }],
  isError: false,
  isLoading: false,
  truncated: false,
  refetch: () => undefined,
};

const UOM_NAME = 'SAMPLE-EA · 합성 단위 개';

/** 실사에서 승계한 줄 — 위치·품목·LOT을 고칠 수 없고 장부가 실사에서 온다. */
const inheritedRow = (overrides: Partial<AdjustLineRow> = {}): AdjustLineRow => ({
  draft: adjustLineDraft({
    key: 's1:count:1',
    countLineId: 9111,
    countSystemQty: 100,
    adjustmentQtyText: '-2',
  }),
  bookQty: { kind: 'known', qty: 100 },
  ...overrides,
});

/** 사용자가 더한 줄 — 위치·품목·LOT·단위를 고르고 장부는 잔액 조회가 낸다. */
const addedRow = (overrides: Partial<AdjustLineRow> = {}): AdjustLineRow => ({
  draft: adjustLineDraft({ key: 's1:new:2', locationId: '', itemId: '', lotId: '', uomId: '' }),
  bookQty: { kind: 'notAsked' },
  ...overrides,
});

const baseProps = (overrides: Partial<AdjustLineTableProps> = {}): AdjustLineTableProps => ({
  rows: [inheritedRow(), addedRow()],
  errors: {},
  locationLookup,
  itemLookup,
  uomLookup,
  lotLookup,
  locationOptions: [{ value: '9401', label: 'SAMPLE-LOC-01 · 합성 위치 가' }],
  itemOptions: [{ value: '9501', label: 'SAMPLE-ITEM-A · 합성 품목 가' }],
  uomOptions: [{ value: '9601', label: 'SAMPLE-EA · 합성 단위 개' }],
  onPatch: vi.fn(),
  onRemove: vi.fn(),
  ...overrides,
});

const renderTable = (overrides: Partial<AdjustLineTableProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<AdjustLineTable {...props} />);

  return { ...result, props, user: userEvent.setup() };
};

const diffBox = (lineNo: number): HTMLElement =>
  screen.getByLabelText(t.lineTable.adjustmentQtyLabel(lineNo));

const headerTexts = (): string[] =>
  within(screen.getByRole('table'))
    .getAllByRole('columnheader')
    .map((cell) => cell.textContent ?? '');

const bodyRows = (): HTMLElement[] =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1);

const cellsOf = (rowIndex: number): string[] =>
  within(bodyRows()[rowIndex] ?? document.createElement('tr'))
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');

/**
 * ⭐ **「장부 · 실물 · 차이」 세 열**(조심 ③ · D-5 · C6).
 *
 * 세 열을 다 보이는 것은 **덮어쓰기로 읽히지 않게** 하려면 장부가 보여야 하고, 차이가 얼마인지
 * 눈으로 맞추려면 실물이 보여야 하기 때문이다. 그리고 **입력칸은 차이 하나뿐이다.**
 */
describe('AdjustLineTable — 세 열과 입력칸', () => {
  it('열 차례가 위치·품목·LOT·장부·실물·차이·행 조작이다', () => {
    renderTable();

    expect(headerTexts()).toEqual([
      t.lineTable.location,
      t.lineTable.item,
      t.lineTable.lot,
      t.lineTable.bookQty,
      t.lineTable.actualQty,
      t.lineTable.adjustmentQty,
      t.lineTable.rowActions,
    ]);
  });

  /**
   * ⛔ **실물이 입력칸이 되면 이 화면이 덮어쓰기 화면이 된다.** 양성 앵커(차이 칸이 있다)를
   * 먼저 잡은 뒤 「실물 칸은 없다」를 잰다 — 렌더 전에 재면 늘 통과하는 단언이 된다.
   */
  it('입력칸이 차이 하나뿐이다 — 실물·장부에는 입력칸이 없다', () => {
    renderTable({ rows: [inheritedRow()] });

    expect(diffBox(1)).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('textbox')).toHaveLength(1);
  });

  it('실물이 장부에 차이를 더한 값으로 선다', () => {
    renderTable({ rows: [inheritedRow()] });

    expect(cellsOf(0)[4]).toBe(t.lineTable.qtyWithUom('98', UOM_NAME));
  });

  it('장부가 실사에서 온 값 그대로 선다', () => {
    renderTable({ rows: [inheritedRow()] });

    expect(cellsOf(0)[3]).toBe(t.lineTable.qtyWithUom('100', UOM_NAME));
  });

  /** 차이를 고치면 실물이 따라 움직인다 — 파생이 실제로 살아 있다는 짝 감지기다. */
  it('차이가 바뀌면 실물이 따라 바뀐다', () => {
    const { rerender } = renderTable({ rows: [inheritedRow()] });

    rerender(
      <AdjustLineTable
        {...baseProps({
          rows: [
            inheritedRow({
              draft: adjustLineDraft({
                key: 's1:count:1',
                countLineId: 9111,
                countSystemQty: 100,
                adjustmentQtyText: '-20',
              }),
            }),
          ],
        })}
      />,
    );

    expect(cellsOf(0)[4]).toBe(t.lineTable.qtyWithUom('80', UOM_NAME));
  });

  /**
   * ⛔ **결과 수량을 뜻하는 낱말이 0건이다**(C14). 그 말이 한 번이라도 서면 사용자가 이 화면을
   * 잔량 덮어쓰기로 읽는다. 양성 앵커 뒤에 잰다.
   */
  it.each(['보유 수량', '재고 수량', '현재 수량'])('%o 라는 낱말이 없다', (word) => {
    renderTable();

    expect(screen.getByText(t.lineTable.bookQty)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(word))).not.toBeInTheDocument();
  });

  /** 장부를 못 찾은 줄은 **0이 아니라 빈 값 표식**이고, 실물도 지어내지 않는다(C8). */
  it('장부를 못 찾으면 장부와 실물이 모두 빈 값 표식이다', () => {
    renderTable({ rows: [inheritedRow({ bookQty: { kind: 'notFound' } })] });

    expect(cellsOf(0)[3]).toBe(t.values.empty);
    expect(cellsOf(0)[4]).toBe(t.values.empty);
  });
});

/**
 * ⭐ **줄이는 조정이 정상 경로다**(조심 ② · D-4 · C11).
 */
describe('AdjustLineTable — 음수와 제외', () => {
  it('음수를 그대로 보인다', () => {
    renderTable({ rows: [inheritedRow()] });

    expect(diffBox(1)).toHaveValue('-2');
  });

  it('차이가 0인 줄에 제외 표식이 붙는다 — 오류로 막지 않는다', () => {
    renderTable({
      rows: [
        inheritedRow({ draft: adjustLineDraft({ key: 's1:count:1', adjustmentQtyText: '0' }) }),
      ],
    });

    expect(screen.getByText(t.lineTable.excluded)).toBeInTheDocument();
    expect(diffBox(1)).toBeValid();
  });

  /** 짝 방향 — 0이 아닌 줄에는 제외 표식이 없다. 「늘 붙는다」로 통과하지 않게 한다. */
  it('차이가 0이 아니면 제외 표식이 없다', () => {
    renderTable({ rows: [inheritedRow()] });

    expect(diffBox(1)).toBeInTheDocument();
    expect(screen.queryByText(t.lineTable.excluded)).not.toBeInTheDocument();
  });

  /** 브라우저가 「-」만 친 중간 상태를 되돌리지 않아야 음수를 칠 수 있다. */
  it('차이 칸이 숫자 전용 입력이 아니다 — 「-」만 친 상태가 살아남는다', () => {
    renderTable({ rows: [inheritedRow()] });

    expect(diffBox(1)).not.toHaveAttribute('type', 'number');
  });
});

/**
 * **라인 사유 칸이 없다**(D-7 · 미결 #87 · C9). 조정 라인에 사유를 담을 자리가 아직 없어
 * 보낼 곳이 없다 — 실사에서 실려 온 사유만 읽기 전용 글자로 보인다.
 */
describe('AdjustLineTable — 라인 사유', () => {
  it('실사에서 온 사유가 글자로 보인다', () => {
    renderTable({
      rows: [
        inheritedRow({
          draft: adjustLineDraft({
            key: 's1:count:1',
            countLineId: 9111,
            countReasonCode: 'SAMPLE_VR_A',
          }),
        }),
      ],
    });

    expect(screen.getByText(t.lineTable.countReason('SAMPLE_VR_A'))).toBeInTheDocument();
  });

  it('승계 줄에 사유 선택칸이 없다 — 고를 수 있으면 저장되지 않는 값을 고르게 된다', () => {
    renderTable({
      rows: [
        inheritedRow({
          draft: adjustLineDraft({
            key: 's1:count:1',
            countLineId: 9111,
            countReasonCode: 'SAMPLE_VR_A',
          }),
        }),
      ],
    });

    expect(screen.getByText(t.lineTable.countReason('SAMPLE_VR_A'))).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryAllByRole('combobox')).toHaveLength(0);
  });

  it('더한 줄에도 사유 선택칸이 없다 — 고를 수 있는 것은 위치·품목·LOT·단위 넷뿐이다', () => {
    renderTable({ rows: [addedRow()] });

    const comboboxes = within(screen.getByRole('table')).getAllByRole('combobox');

    expect(comboboxes).toHaveLength(4);
    expect(comboboxes.map((box) => box.getAttribute('aria-label'))).toEqual([
      t.lineTable.locationLabel(1),
      t.lineTable.itemLabel(1),
      t.lineTable.uomLabel(1),
      t.lineTable.lotLabel(1),
    ]);
  });
});

describe('AdjustLineTable — 승계 줄과 더한 줄', () => {
  it('승계 줄의 위치·품목·LOT은 고를 수 없고 표식이 붙는다', () => {
    renderTable({ rows: [inheritedRow()] });

    expect(screen.getByText(t.lineTable.inherited)).toBeInTheDocument();
    expect(screen.getByText('SAMPLE-LOC-01 · 합성 위치 가')).toBeInTheDocument();
    expect(screen.queryByLabelText(t.lineTable.locationLabel(1))).not.toBeInTheDocument();
  });

  it('더한 줄은 위치·품목·LOT·단위를 고른다', () => {
    renderTable({ rows: [addedRow()] });

    expect(screen.getByLabelText(t.lineTable.locationLabel(1))).toBeInTheDocument();
    expect(screen.getByLabelText(t.lineTable.itemLabel(1))).toBeInTheDocument();
    expect(screen.getByLabelText(t.lineTable.lotLabel(1))).toBeInTheDocument();
    expect(screen.getByLabelText(t.lineTable.uomLabel(1))).toBeInTheDocument();
  });

  /** LOT은 **그 줄의 품목이 가진 것만** 고르게 한다 — 선택지만 좁히고 이름 풀이는 전체다. */
  it('LOT 선택지가 그 줄의 품목으로 좁혀진다', async () => {
    const { user } = renderTable({
      rows: [addedRow({ draft: adjustLineDraft({ key: 's1:new:2', itemId: '9502', lotId: '' }) })],
    });

    await user.click(screen.getByLabelText(t.lineTable.lotLabel(1)));

    expect(screen.queryByRole('option', { name: 'SAMPLE-LOT-0001' })).not.toBeInTheDocument();
  });

  it('품목을 고르면 그 품목의 LOT을 고를 수 있다', async () => {
    const { user } = renderTable({
      rows: [addedRow({ draft: adjustLineDraft({ key: 's1:new:2', itemId: '9501', lotId: '' }) })],
    });

    await user.click(screen.getByLabelText(t.lineTable.lotLabel(1)));

    expect(screen.getByRole('option', { name: 'SAMPLE-LOT-0001' })).toBeInTheDocument();
  });

  /** 품목이 바뀌면 남은 LOT은 그 품목의 것이 아니다 — 함께 비운다. */
  it('품목을 바꾸면 LOT을 함께 비운다', async () => {
    const { props, user } = renderTable({
      rows: [addedRow({ draft: adjustLineDraft({ key: 's1:new:2', itemId: '', lotId: '9702' }) })],
    });

    await user.click(screen.getByLabelText(t.lineTable.itemLabel(1)));
    await user.click(screen.getByRole('option', { name: 'SAMPLE-ITEM-A · 합성 품목 가' }));

    expect(props.onPatch).toHaveBeenCalledWith('s1:new:2', { itemId: '9501', lotId: '' });
  });
});

/**
 * **열 폭 잣대**(사본 체크리스트 8번 — 선언과 산출물 두 자리).
 *
 * 흡수 열이 둘이 되면 남는 폭이 나뉘어 「코드 · 이름」이 낱말 단위로 쪼개진다. 하나도 없으면
 * 표가 하한보다 좁아져 고정 배치가 남는 폭을 제멋대로 나눈다. 지정 폭을 늘리는 것도 같은
 * 결과를 낸다 — **어느 쪽이든 이 셋 중 하나가 운다.**
 */
describe('AdjustLineTable — 열 폭', () => {
  /** `.wide-table`이 표에 주는 최소 폭(58rem). */
  const WIDE_TABLE_MIN_PX = 928;
  /** 「코드 · 이름」이 한 줄에 들어가는 폭. */
  const CODE_NAME_COLUMN_PX = 184;

  /** 렌더된 열 폭 — **산출물 쪽을 잰다.** 선언만 읽으면 상수와 산출물이 어긋나도 잡히지 않는다. */
  const renderedColWidths = (): (number | undefined)[] =>
    Array.from(screen.getByRole('table').querySelectorAll('col')).map((col) => {
      const width = (col as HTMLElement).style.width;

      return width === '' ? undefined : Number.parseInt(width, 10);
    });

  const specifiedWidthPx = (): number =>
    renderedColWidths().reduce<number>((sum, width) => sum + (width ?? 0), 0);

  it('폭을 지정하지 않은 흡수 열이 정확히 하나이고 그 자리가 품목이다', () => {
    renderTable();

    const widths = renderedColWidths();

    expect(widths.filter((width) => width === undefined)).toHaveLength(1);
    expect(widths[1]).toBeUndefined();
  });

  it('지정 폭 합에 흡수 열 예산을 더해도 표 하한 안이다', () => {
    renderTable();

    expect(specifiedWidthPx() + CODE_NAME_COLUMN_PX).toBeLessThanOrEqual(WIDE_TABLE_MIN_PX);
  });

  it('흡수 열이 실제로 받는 폭이 예산보다 좁지 않다', () => {
    renderTable();

    expect(WIDE_TABLE_MIN_PX - specifiedWidthPx()).toBeGreaterThanOrEqual(CODE_NAME_COLUMN_PX);
  });
});

/**
 * **줄 단위 오류 격리**(사본 체크리스트 3번 · C12). 줄 번호가 열쇠에 들어가지 않으면
 * 잘못 친 줄이 둘일 때 두 줄이 같은 오류를 가리켜, 사용자가 고치지 않은 줄에서 붉은 글씨를 본다.
 */
describe('AdjustLineTable — 줄 단위 오류', () => {
  it('두 줄이 동시에 잘못돼도 각 칸이 자기 줄의 사유를 가리킨다', () => {
    renderTable({
      rows: [inheritedRow(), addedRow()],
      errors: {
        [lineFieldId('s1:count:1', 'adjustmentQty')]: t.errors.adjustmentQtyRequired,
        [lineFieldId('s1:new:2', 'adjustmentQty')]: t.errors.adjustmentQtyNotNumber,
      },
    });

    expect(diffBox(1)).toHaveAccessibleDescription(new RegExp(t.errors.adjustmentQtyRequired));
    expect(diffBox(2)).toHaveAccessibleDescription(new RegExp(t.errors.adjustmentQtyNotNumber));
  });

  it('고르지 않은 칸이 그 줄에서 잘못된 것으로 표시된다', () => {
    renderTable({
      rows: [addedRow()],
      errors: { [lineFieldId('s1:new:2', 'itemId')]: t.errors.itemRequired },
    });

    expect(screen.getByLabelText(t.lineTable.itemLabel(1))).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('AdjustLineTable — 잠금', () => {
  it('잠기면 입력칸·선택칸·삭제가 모두 막힌다', () => {
    renderTable({ isLocked: true });

    expect(diffBox(1)).toBeDisabled();
    expect(screen.getByLabelText(t.lineTable.itemLabel(2))).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.removeLine(2) })).toBeDisabled();
  });

  /** 짝 방향 — 잠그지 않으면 열려 있다. 「늘 잠긴다」로 통과하지 않게 한다. */
  it('잠기지 않으면 열려 있다', () => {
    renderTable();

    expect(diffBox(1)).toBeEnabled();
    expect(screen.getByRole('button', { name: t.actions.removeLine(2) })).toBeEnabled();
  });

  it('잠긴 칸에 쳐도 값이 나가지 않는다', async () => {
    const { props, user } = renderTable({ isLocked: true });

    await user.type(diffBox(1), '5');

    expect(props.onPatch).not.toHaveBeenCalled();
  });
});

/**
 * **`getRowId` 감지기**(사본 체크리스트 2번 · C15).
 *
 * 행 식별자를 떼면 React key가 인덱스가 되어, 앞 줄이 사라질 때 **치고 있던 칸의 DOM 노드가
 * 대신 지워진다** — 포커스와 캐럿이 말없이 다른 줄의 칸으로 옮겨 간다. 그 표에서 사용자는
 * 친 값이 다른 줄로 옮겨 붙은 것을 알아채지 못한 채 조정을 올린다.
 */
describe('AdjustLineTable — 앞 줄이 사라질 때', () => {
  it('치고 있던 칸의 값과 포커스가 남는다', async () => {
    const { rerender, user } = renderTable();

    await user.click(diffBox(2));

    expect(document.activeElement).toBe(diffBox(2));

    rerender(<AdjustLineTable {...baseProps({ rows: [addedRow()] })} />);

    expect(screen.getAllByLabelText(/차이 수량$/)).toHaveLength(1);
    expect(document.activeElement).toBe(diffBox(1));
    expect(diffBox(1)).toHaveValue('-20');
  });

  it('삭제를 누르면 그 줄의 키가 나간다', async () => {
    const { props, user } = renderTable();

    await user.click(screen.getByRole('button', { name: t.actions.removeLine(2) }));

    expect(props.onRemove).toHaveBeenCalledWith('s1:new:2');
  });
});
