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
