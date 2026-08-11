import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  goodsReceiptLineFixtures,
  INTERNAL_IDS,
  itemFixtures,
  locationFixtures,
  lotFixtures,
  uomFixtures,
} from './fixtures';
import { TABLE_MIN_WIDTH_PX } from './gr-table';
import { buildGrLineColumns, GrLineTable, type GrLineTableProps } from './gr-line-table';
import type { LotReferenceSource, ReferenceSource } from './lookups';

const t = messages.supplierReturn;

const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';
const UOM_LABEL = 'SAMPLE-EA · 합성 단위 개';
const LOCATION_LABEL = 'SAMPLE-LOC-A1 · 합성 열 가1';

const source = (entries: ReferenceSource['entries'], overrides: Partial<ReferenceSource> = {}) => ({
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

const lotSource = (overrides: Partial<LotReferenceSource> = {}): LotReferenceSource => ({
  entries: lotFixtures.map((lot) => ({
    value: String(lot.lotId),
    label: lot.lotNo,
    isActive: true,
    held: lot.held,
  })),
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

const baseProps = (overrides: Partial<GrLineTableProps> = {}): GrLineTableProps => ({
  rows: goodsReceiptLineFixtures,
  itemLookup: itemSource(),
  uomLookup: uomSource(),
  lotLookup: lotSource(),
  locationLookup: locationSource(),
  onRetryReferences: vi.fn(),
  ...overrides,
});

const renderTable = (overrides: Partial<GrLineTableProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<GrLineTable {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

describe('buildGrLineColumns — 열 폭 예산', () => {
  const columns = buildGrLineColumns({
    itemLookup: itemSource(),
    uomLookup: uomSource(),
    lotLookup: lotSource(),
    locationLookup: locationSource(),
  });

  /** **M30** — 흡수 열이 둘이 되면 「코드 · 이름」이 낱말 단위로 쪼개진다. */
  it('흡수 열이 정확히 하나다', () => {
    expect(columns.filter((column) => column.width === undefined)).toHaveLength(1);
  });

  it('지정 폭 합과 흡수 예산이 표 하한 안에 든다', () => {
    const fixed = columns.reduce(
      (sum, column) => sum + Number.parseInt(column.width ?? '0px', 10),
      0,
    );

    expect(fixed).toBe(408);
    expect(TABLE_MIN_WIDTH_PX - fixed).toBeGreaterThanOrEqual(184);
  });

  /**
   * **이 회차의 열은 넷이다** — 읽기 전용이다. 선택·보유 수량·반품 수량 세 열은 줄을 고르고
   * 수량을 넣는 회차에서 붙는다.
   */
  it('열이 넷이다', () => {
    expect(columns.map((column) => column.key)).toEqual([
      'item',
      'lot',
      'location',
      'receiptQty',
    ]);
  });

  /** 줄번호 열을 두지 않는다 — 서버가 부여한 순번이라 사용자에게 뜻이 적다(계획 §5.5). */
  it('줄번호 열이 없다', () => {
    expect(columns.map((column) => column.key)).not.toContain('lineNo');
  });
});

describe('GrLineTable — 참조 표기', () => {
  it('품목·LOT·위치를 이름으로 풀고 수량에 단위를 붙인다', () => {
    renderTable();

    expect(screen.getAllByText(ITEM_LABEL).length).toBe(2);
    expect(screen.getByText('LOT-2026-900010')).toBeInTheDocument();
    expect(screen.getByText(LOCATION_LABEL)).toBeInTheDocument();
    expect(screen.getByText(t.lineTable.receiptQtyPair(100, UOM_LABEL))).toBeInTheDocument();
  });

  it('수량이 소수여도 0이어도 그대로 낸다', () => {
    renderTable();

    expect(screen.getByText(t.lineTable.receiptQtyPair(12.5, UOM_LABEL))).toBeInTheDocument();
    expect(screen.getByText(t.lineTable.receiptQtyPair(0, t.values.unknown))).toBeInTheDocument();
  });

  /** **M28 · 짝 방향 단언** — 이름이 실제로 보이고, 그 자리에 번호가 없다(#44). */
  it('라인 표에 내부 번호가 없다', () => {
    const { container } = renderTable();

    expect(screen.getAllByText(ITEM_LABEL).length).toBeGreaterThan(0);

    for (const id of INTERNAL_IDS) {
      expect(container.textContent ?? '').not.toContain(id);
    }
  });

  /**
   * **#47** — 본 자료가 참조보다 먼저 오면 정상 값이 「알 수 없음」으로 보인다.
   * 미도착과 목록에 없음을 가른다.
   */
  it('참조가 아직 오지 않은 것과 목록에 없는 것을 가른다', () => {
    renderTable({ itemLookup: itemSource({ entries: [], isLoading: true }) });

    expect(screen.getAllByText(t.values.referenceLoading).length).toBe(
      goodsReceiptLineFixtures.length,
    );
  });

  it('목록에 없는 품목·LOT·위치는 알 수 없음으로 낸다', () => {
    renderTable();

    /*
     * 9402의 품목 · 9403의 LOT·위치 셋이 제 칸을 통째로 차지한다.
     * 9403의 단위도 목록에 없으나 수량 표기 안에 붙어 있어 따로 세지 않는다 —
     * 그 갈래는 바로 위 단언(`receiptQtyPair(0, unknown)`)이 잰다.
     */
    expect(screen.getAllByText(t.values.unknown).length).toBe(3);
  });
});

describe('GrLineTable — LOT 보류 표식', () => {
  /**
   * 반품해도 LOT 보류는 유지된다(착수 이슈 §6) — 사용자가 그 사실을 아는 자리가 화면에
   * 있어야 한다. **표식은 표시일 뿐이며 선택을 막지 않는다.**
   */
  it('보류 중인 LOT에 표식이 붙는다', () => {
    renderTable();

    expect(screen.getByText(t.values.lotHeld)).toBeInTheDocument();
  });

  it('표식은 색이 아니라 글자다', () => {
    renderTable();

    const marker = screen.getByText(t.values.lotHeld);

    expect(marker.textContent).toBe(t.values.lotHeld);
  });

  it('보류가 아닌 LOT에는 표식이 없다', () => {
    const row = goodsReceiptLineFixtures[0];

    if (row === undefined) throw new Error('픽스처가 비어 있다');

    renderTable({ rows: [row] });

    expect(screen.queryByText(t.values.lotHeld)).not.toBeInTheDocument();
  });

  it('보류가 있으면 그 뜻과 여기서 풀 수 없다는 사실을 밝힌다', () => {
    renderTable();

    expect(screen.getByText(t.notes.lotHold)).toBeInTheDocument();
  });

  /** **해제 수단이 화면 어디에도 없다** — 계약에도 그 오퍼레이션이 없다(착수 이슈 §6). */
  it('보류를 푸는 버튼이 없다', () => {
    renderTable();

    for (const button of screen.queryAllByRole('button')) {
      expect(button.textContent ?? '').not.toContain('해제');
    }
  });

  it('보류가 없으면 그 안내도 없다', () => {
    const row = goodsReceiptLineFixtures[0];

    if (row === undefined) throw new Error('픽스처가 비어 있다');

    renderTable({ rows: [row] });

    expect(screen.queryByText(t.notes.lotHold)).not.toBeInTheDocument();
  });
});

describe('GrLineTable — 빈 상태와 실패', () => {
  /** **M18** — 바깥에서 0건을 갈라 내면 `Table.empty`가 닿을 수 없는 가지가 된다. */
  it('라인이 없으면 표의 빈 상태가 맡는다', () => {
    renderTable({ rows: [] });

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(t.empty.noLinesTitle)).toBeInTheDocument();
  });

  /**
   * **넷을 각각 잰다.** 안내 문구가 「품목·단위·자재 LOT·위치」 넷을 다 이름으로 적고 있으므로
   * 판정도 넷을 다 보아야 한다 — 하나만 재면 나머지 셋 중 어느 항이 빠져도 아무도 울지
   * 않고, 그 참조만 실패했을 때 **사유 줄도 「다시 시도」도 나오지 않아 복구 수단이 사라진다.**
   */
  const eachReference: [string, () => Partial<GrLineTableProps>][] = [
    ['품목', () => ({ itemLookup: itemSource({ isError: true }) })],
    ['단위', () => ({ uomLookup: uomSource({ isError: true }) })],
    ['자재 LOT', () => ({ lotLookup: lotSource({ isError: true }) })],
    ['위치', () => ({ locationLookup: locationSource({ isError: true }) })],
  ];

  it.each(eachReference)('%s 참조만 실패해도 사유와 다시 시도를 낸다', async (_name, overrides) => {
    const { onRetryReferences, user } = renderTable(overrides());

    expect(screen.getByText(t.reasons.lineReferencesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  /**
   * **잘림은 실패와 따로 낸다.** 실패는 「이름을 못 받았다」이고 잘림은 「일부만 받았다」인데,
   * 잘린 목록으로 이름을 풀면 정상 값이 「알 수 없음」으로 찍힌다.
   * **복구 버튼을 붙이지 않는다** — 다시 불러도 같은 쪽이 온다.
   */
  const eachTruncated: [string, () => Partial<GrLineTableProps>][] = [
    ['품목', () => ({ itemLookup: itemSource({ truncated: true }) })],
    ['단위', () => ({ uomLookup: uomSource({ truncated: true }) })],
    ['자재 LOT', () => ({ lotLookup: lotSource({ truncated: true }) })],
    ['위치', () => ({ locationLookup: locationSource({ truncated: true }) })],
  ];

  it.each(eachTruncated)('%s 목록만 잘려도 사실을 밝히고 복구 버튼을 붙이지 않는다', (_name, overrides) => {
    renderTable(overrides());

    expect(screen.getByText(t.reasons.lineReferencesTruncated)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('정상이면 실패·잘림 안내가 없다', () => {
    renderTable();

    expect(screen.queryByText(t.reasons.lineReferencesFailed)).not.toBeInTheDocument();
    expect(screen.queryByText(t.reasons.lineReferencesTruncated)).not.toBeInTheDocument();
  });
});

describe('GrLineTable — 이 회차의 경계', () => {
  /** 줄을 고르는 수단은 아직 없다 — 없는 판정을 화면이 먼저 말하지 않는다. */
  it('줄을 고르는 컨트롤이 없다', () => {
    renderTable();

    expect(within(screen.getByRole('table')).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(screen.getByRole('table')).queryAllByRole('button')).toHaveLength(0);
    expect(within(screen.getByRole('table')).queryAllByRole('textbox')).toHaveLength(0);
  });
});
