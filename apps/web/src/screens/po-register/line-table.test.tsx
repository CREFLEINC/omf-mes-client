import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { itemFixtures, lineDraft, uomFixtures } from './fixtures';
import { LineTable, type LineTableProps } from './line-table';
import type { ReferenceSource } from './lookups';
import type { LineDraft } from './types';
import { lineFieldId } from './validation';

const t = messages.poRegister;

const toEntries = (
  rows: { id: number; code: string; name: string }[],
): ReferenceSource['entries'] =>
  rows.map((row) => ({
    value: String(row.id),
    label: `${row.code} · ${row.name}`,
    isActive: true,
  }));

const itemLookup: ReferenceSource = {
  entries: toEntries(
    itemFixtures.map((item) => ({ id: item.itemId, code: item.itemCode, name: item.itemName })),
  ),
  isError: false,
  isLoading: false,
};

const uomLookup: ReferenceSource = {
  entries: toEntries(
    uomFixtures.map((uom) => ({ id: uom.uomId, code: uom.uomCode, name: uom.uomName })),
  ),
  isError: false,
  isLoading: false,
};

const INHERITED: LineDraft = lineDraft({ key: 'source:1', sourceLineId: 9111, sourceQty: 12 });
const ADDED: LineDraft = lineDraft({ key: 'new:1', itemId: '', uomId: '', orderedQty: '' });

const baseProps = (overrides: Partial<LineTableProps> = {}): LineTableProps => ({
  rows: [INHERITED, ADDED],
  errors: {},
  warnings: {},
  itemLookup,
  uomLookup,
  itemOptions: [...itemLookup.entries],
  uomOptions: [...uomLookup.entries],
  onPatch: vi.fn(),
  onRemove: vi.fn(),
  ...overrides,
});

const renderTable = (overrides: Partial<LineTableProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<LineTable {...props} />);

  return { ...result, props, user: userEvent.setup() };
};

const qtyBox = (lineNo: number): HTMLElement =>
  screen.getByLabelText(t.lineTable.orderedQtyLabel(lineNo));

/** `.wide-table`이 표에 주는 최소 폭(58rem). */
const WIDE_TABLE_MIN_PX = 928;

/** 「코드 · 이름」이 한 줄에 들어가는 폭(`docs/layout-conventions.md`의 선례 값). */
const CODE_NAME_COLUMN_PX = 184;

/**
 * 렌더된 열 폭 — **산출물 쪽을 잰다**(사본 체크리스트 8번).
 *
 * 디자인 시스템 표가 `<colgroup><col style="width: …">`로 폭을 낸다(실측). 선언만 읽으면
 * 폭 상수와 실제 산출물이 어긋나도 잡히지 않는다.
 */
const renderedColWidths = (): (number | undefined)[] =>
  Array.from(screen.getByRole('table').querySelectorAll('col')).map((col) => {
    const width = (col as HTMLElement).style.width;

    return width === '' ? undefined : Number.parseInt(width, 10);
  });

/** 폭을 지정한 열의 합. 흡수 열(폭 미지정)은 0으로 센다. */
const specifiedWidthPx = (): number =>
  renderedColWidths().reduce<number>((sum, width) => sum + (width ?? 0), 0);

describe('LineTable — 승계 줄과 더한 줄', () => {
  it('승계 줄의 품목·단위는 고를 수 없고 표식이 붙는다(계획 결정 4)', () => {
    renderTable();

    expect(screen.getByText(t.lineTable.inherited)).toBeInTheDocument();
    expect(screen.getByText('SAMPLE-ITEM-01 · 합성 품목 가')).toBeInTheDocument();
    expect(screen.queryByLabelText(t.lineTable.itemLabel(1))).not.toBeInTheDocument();
  });

  it('더한 줄은 품목·단위를 고른다', () => {
    renderTable();

    expect(screen.getByLabelText(t.lineTable.itemLabel(2))).toBeInTheDocument();
    expect(screen.getByLabelText(t.lineTable.uomLabel(2))).toBeInTheDocument();
  });

  it('승계 줄에는 하한 안내가 붙는다', () => {
    renderTable();

    expect(screen.getByText(t.lineTable.minNote(12))).toBeInTheDocument();
  });

  it('한 줄뿐이면 삭제가 잠긴다 — 라인 0행은 보낼 수 없다', () => {
    renderTable({ rows: [INHERITED] });

    expect(screen.getByRole('button', { name: t.actions.removeLine(1) })).toBeDisabled();
  });
});

/**
 * **열 폭 잣대**(사본 체크리스트 8번 · 전례 `stocktaking/count-line-table.test.tsx` 이식).
 *
 * 흡수 열이 둘이 되면 남는 폭이 나뉘어 「코드 · 이름」이 낱말 단위로 쪼개진다. 하나도 없으면
 * 표가 하한보다 좁아져 고정 배치가 남는 폭을 제멋대로 나눈다. 지정 폭을 늘리는 것도 같은
 * 결과를 낸다 — **어느 쪽이든 이 셋 중 하나가 운다.**
 */
describe('LineTable — 열 폭', () => {
  it('폭을 지정하지 않은 흡수 열이 정확히 하나이고 그 자리가 품목이다', () => {
    renderTable();

    const widths = renderedColWidths();
    const absorbing = widths.filter((width) => width === undefined);

    expect(absorbing).toHaveLength(1);
    /* 열 순서는 줄번호·품목·발주수량·… — 흡수 열은 둘째 자리(품목)다. */
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

describe('LineTable — 줄 단위 오류·경고', () => {
  it('오류가 자기 줄의 칸에 이어진다(사본 체크리스트 3번)', () => {
    renderTable({
      errors: {
        [lineFieldId('source:1', 'orderedQty')]: t.errors.qtyBelowSource(12),
        [lineFieldId('new:1', 'orderedQty')]: t.errors.qtyNotPositive,
      },
    });

    expect(qtyBox(1)).toHaveAccessibleDescription(new RegExp(t.errors.qtyBelowSource(12)));
    expect(qtyBox(2)).toHaveAccessibleDescription(new RegExp(t.errors.qtyNotPositive));
  });

  it('경고는 그 칸의 안내로 선다 — 오류처럼 막지 않는다', () => {
    renderTable({
      warnings: {
        [lineFieldId('source:1', 'toleranceOverQty')]: t.warnings.toleranceOverPositive,
      },
    });

    expect(screen.getByText(t.warnings.toleranceOverPositive)).toBeInTheDocument();
  });
});

/**
 * **잠금**(완료 조건 C19·C24).
 *
 * 나가는 중이거나 이미 등록한 뒤에는 표의 **모든 칸과 삭제 버튼**이 함께 잠긴다. 한 칸이라도
 * 열려 있으면 사용자가 그 칸을 고치고 나서 **자기가 고친 값으로 등록된 줄 알게 된다** —
 * 나가는 본문은 이미 조립됐고 등록된 전표는 이 화면에서 고칠 수 없다.
 */
describe('LineTable — 잠금', () => {
  it('잠기면 입력칸과 삭제가 모두 막힌다', () => {
    renderTable({ isLocked: true });

    expect(qtyBox(1)).toBeDisabled();
    expect(screen.getByLabelText(t.lineTable.toleranceOverLabel(1))).toBeDisabled();
    expect(screen.getByLabelText(t.lineTable.toleranceUnderLabel(1))).toBeDisabled();
    expect(screen.getByLabelText(t.lineTable.itemLabel(2))).toBeDisabled();
    expect(screen.getByLabelText(t.lineTable.uomLabel(2))).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.removeLine(2) })).toBeDisabled();
  });

  /** 짝 방향 — 잠그지 않으면 열려 있다. 「늘 잠긴다」로 통과하지 않게 한다. */
  it('잠기지 않으면 열려 있다', () => {
    renderTable();

    expect(qtyBox(1)).toBeEnabled();
    expect(screen.getByLabelText(t.lineTable.itemLabel(2))).toBeEnabled();
    expect(screen.getByRole('button', { name: t.actions.removeLine(2) })).toBeEnabled();
  });

  /** 잠긴 동안에는 값이 바뀌지 않는다 — 잠금이 표시만이면 조작이 그대로 통한다. */
  it('잠긴 칸에 쳐도 값이 나가지 않는다', async () => {
    const { props, user } = renderTable({ isLocked: true });

    await user.type(qtyBox(1), '5');

    expect(props.onPatch).not.toHaveBeenCalled();
  });
});

/**
 * **`getRowId` 감지기**(사본 체크리스트 2번 · 전례 이식).
 *
 * 행 식별자를 떼면 React key가 인덱스가 되어, 앞 줄이 사라질 때 **치고 있던 칸의 DOM 노드가
 * 대신 지워진다** — 포커스와 캐럿이 말없이 다른 줄의 칸으로 옮겨 간다. 그 표에서 사용자는
 * 친 값이 다른 줄로 옮겨 붙은 것을 알아채지 못한 채 발주수량을 확정한다.
 */
describe('LineTable — 앞 줄이 사라질 때', () => {
  it('치고 있던 칸의 포커스가 남는다', async () => {
    const { rerender, user } = renderTable();

    await user.click(qtyBox(2));

    expect(document.activeElement).toBe(qtyBox(2));

    rerender(<LineTable {...baseProps({ rows: [ADDED] })} />);

    expect(screen.getAllByLabelText(/발주수량$/)).toHaveLength(1);
    expect(document.activeElement).toBe(qtyBox(1));
  });
});
