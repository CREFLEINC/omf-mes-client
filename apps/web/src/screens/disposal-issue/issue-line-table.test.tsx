import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  goodsIssueLineFixtures,
  INTERNAL_IDS,
  itemFixtures,
  locationFixtures,
  lotFixturesByItem,
  uomFixtures,
} from './fixtures';
import {
  buildIssueLineColumns,
  ISSUE_LINE_TABLE_MIN_WIDTH_PX,
  IssueLineTable,
  type IssueLineTableProps,
} from './issue-line-table';
import type { LotReferenceSource, ReferenceSource } from './lookups';

const t = messages.disposalIssue;

const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 자재 가';
const LOT_LABEL = 'SAMPLE-LOT-0001';
const HELD_LOT_LABEL = 'SAMPLE-LOT-0003';
const LOCATION_LABEL = 'SAMPLE-LOC-01 · 합성 적치 가';
const UOM_LABEL = 'SAMPLE-UOM-EA · 합성 낱개';

const source = (
  entries: ReferenceSource['entries'],
  overrides: Partial<ReferenceSource> = {},
): ReferenceSource => ({
  entries,
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

const itemSource = (overrides: Partial<ReferenceSource> = {}): ReferenceSource =>
  source(
    itemFixtures.map((item) => ({
      value: String(item.itemId),
      label: `${item.itemCode} · ${item.itemName}`,
      isActive: item.isActive,
    })),
    overrides,
  );

const uomSource = (overrides: Partial<ReferenceSource> = {}): ReferenceSource =>
  source(
    uomFixtures.map((uom) => ({
      value: String(uom.uomId),
      label: `${uom.uomCode} · ${uom.uomName}`,
      isActive: uom.isActive,
    })),
    overrides,
  );

const locationSource = (overrides: Partial<ReferenceSource> = {}): ReferenceSource =>
  source(
    locationFixtures.map((location) => ({
      value: String(location.locationId),
      label: `${location.locationCode} · ${location.locationName}`,
      isActive: location.isActive,
    })),
    overrides,
  );

/** 자재 LOT은 **보류 여부를 함께 나른다** — 그것이 다른 넷과 다른 유일한 점이다. */
const lotSource = (overrides: Partial<LotReferenceSource> = {}): LotReferenceSource => ({
  entries: Object.values(lotFixturesByItem)
    .flat()
    .map((lot) => ({
      value: String(lot.lotId),
      label: lot.lotNo,
      isActive: true,
      /* 9603을 보류로 둔다 — 둘째 줄이 가리키는 LOT이라 표식이 실제 값으로 걸린다. */
      held: lot.lotId === 9603,
    })),
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

const baseProps = (overrides: Partial<IssueLineTableProps> = {}): IssueLineTableProps => ({
  rows: goodsIssueLineFixtures,
  itemLookup: itemSource(),
  uomLookup: uomSource(),
  lotLookup: lotSource(),
  locationLookup: locationSource(),
  hasReferenceError: false,
  onRetryReferences: vi.fn(),
  ...overrides,
});

const renderTable = (overrides: Partial<IssueLineTableProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<IssueLineTable {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

describe('buildIssueLineColumns — 열 폭 예산', () => {
  const columns = buildIssueLineColumns({
    itemLookup: itemSource(),
    uomLookup: uomSource(),
    lotLookup: lotSource(),
    locationLookup: locationSource(),
  });

  it('흡수 열이 정확히 하나다', () => {
    expect(columns.filter((column) => column.width === undefined)).toHaveLength(1);
  });

  it('지정 폭 합과 흡수 예산이 표 하한 안에 든다', () => {
    const fixed = columns.reduce(
      (sum, column) => sum + Number.parseInt(column.width ?? '0px', 10),
      0,
    );

    expect(fixed).toBe(536);
    expect(ISSUE_LINE_TABLE_MIN_WIDTH_PX - fixed).toBe(392);
    expect(ISSUE_LINE_TABLE_MIN_WIDTH_PX - fixed).toBeGreaterThanOrEqual(200);
  });

  /* 줄번호·단위 열을 두지 않았다 — 열을 늘리는 것보다 줄이는 것이 먼저다. */
  it('열이 다섯이다', () => {
    expect(columns.map((column) => column.key)).toEqual([
      'item',
      'lot',
      'location',
      'issueQty',
      'posted',
    ]);
  });
});

describe('IssueLineTable — 행 표기', () => {
  it('품목·LOT·위치를 이름으로 푼다', () => {
    renderTable();

    expect(screen.getByText(ITEM_LABEL)).toBeInTheDocument();
    expect(screen.getByText(LOT_LABEL)).toBeInTheDocument();
    expect(screen.getAllByText(LOCATION_LABEL).length).toBeGreaterThan(0);
  });

  /** 단위를 수량 표기에 붙인다 — 열을 늘리지 않는다. */
  it('수량에 단위를 붙여 낸다', () => {
    renderTable();

    expect(screen.getByText(t.issueLineTable.issueQtyPair(40, UOM_LABEL))).toBeInTheDocument();
  });

  /** 짝 방향 단언 — 이름이 실제로 보이고 그 자리에 번호가 없다(`omf-mes#44`). */
  it('내부 번호를 어느 칸에도 내지 않는다', () => {
    const { container } = renderTable();

    expect(screen.getByText(ITEM_LABEL)).toBeInTheDocument();

    for (const id of INTERNAL_IDS) {
      expect(container.textContent ?? '').not.toContain(id);
    }
  });

  it('참조가 아직 오지 않았으면 그 사실을 낸다', () => {
    renderTable({ itemLookup: itemSource({ entries: [], isLoading: true }) });

    expect(screen.getAllByText(t.values.referenceLoading).length).toBe(goodsIssueLineFixtures.length);
  });

  it('참조 실패는 사유와 복구 경로를 함께 낸다', async () => {
    const { onRetryReferences, user } = renderTable({ hasReferenceError: true });

    expect(screen.getByText(t.reasons.lineReferencesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  /** 보류 표식은 **알리는 것이지 막는 것이 아니다** — 여기는 이미 만들어진 전표라 막을 것도 없다. */
  it('보류 LOT에만 표식이 붙는다', () => {
    renderTable();

    const held = screen.getByText(HELD_LOT_LABEL).closest('td');
    const plain = screen.getByText(LOT_LABEL).closest('td');

    if (held === null || plain === null) throw new Error('LOT 칸을 찾지 못했다');

    expect(within(held).getByText(t.values.lotHeld)).toBeInTheDocument();
    expect(within(plain).queryByText(t.values.lotHeld)).not.toBeInTheDocument();
  });
});

describe('IssueLineTable — 전기 표식', () => {
  const rowOf = (label: string): HTMLElement => {
    const row = screen.getByText(label).closest('tr');

    if (row === null) throw new Error('행을 찾지 못했다');

    return row;
  };

  /**
   * **원장 라인 유무로만 갈린다**(계획 결정 7). 상태 코드로 판정하면 조용히 틀린다 —
   * 목이 전기 뒤에도 초안 상태를 그대로 준다. **두 방향을 함께 잰다.**
   */
  it('전기된 줄과 전기 전 줄이 갈린다', () => {
    renderTable();

    expect(within(rowOf(LOT_LABEL)).getByText(t.values.posted)).toBeInTheDocument();
    expect(within(rowOf(HELD_LOT_LABEL)).getByText(t.values.notPosted)).toBeInTheDocument();
  });

  it('원장 라인이 붙으면 표식이 뒤집힌다', () => {
    renderTable({
      rows: goodsIssueLineFixtures.map((row) => ({ ...row, inventoryTransactionLineId: 9531 })),
    });

    expect(screen.getAllByText(t.values.posted)).toHaveLength(goodsIssueLineFixtures.length);
    expect(screen.queryByText(t.values.notPosted)).not.toBeInTheDocument();
  });

  /* 색·아이콘에만 기대지 않는다 — 두 표식이 서로 다른 글자다. */
  it('표식이 글자이고 둘이 다르다', () => {
    expect(t.values.posted).not.toBe(t.values.notPosted);
  });
});

describe('IssueLineTable — 빈 상태', () => {
  /**
   * 계약이 라인 최소 개수를 강제하지 않아(실측) **라인이 없는 전표가 실제로 만들어질 수 있다.**
   * 표를 늘 그리고 `empty`가 0건을 맡아야 그 가지에 닿는다.
   */
  it('라인이 없으면 표의 빈 자리가 그 사실을 맡는다', () => {
    renderTable({ rows: [] });

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(t.empty.noIssueLinesTitle)).toBeInTheDocument();
  });

  /* 입고 라인의 빈 상태 문구와 다르다 — 사용자가 할 조치가 다르다. */
  it('입고 라인의 빈 상태 문구와 다르다', () => {
    expect(t.empty.noIssueLinesTitle).not.toBe(t.empty.noLinesTitle);
  });
});
