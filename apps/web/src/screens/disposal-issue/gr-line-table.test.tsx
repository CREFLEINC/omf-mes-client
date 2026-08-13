import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  describeDisposalSelection,
  toDisposalLineRows,
  type DisposalLineRow,
} from './disposal-selection';
import {
  balanceResponseFixturesByItem,
  INTERNAL_IDS,
  itemFixtures,
  locationFixtures,
  lotFixturesByItem,
  receiptLineFixtures,
  uomFixtures,
} from './fixtures';
import {
  buildGrLineColumns,
  GrLineTable,
  LINE_TABLE_MIN_WIDTH_PX,
  type GrLineTableProps,
} from './gr-line-table';
import { EMPTY_LINE_DRAFT, setDraftQty, toggleLineSelection, type LineDraft } from './line-draft';
import type { LotReferenceSource, ReferenceSource } from './lookups';
import type { BalanceSource, ItemBalance } from './on-hand';
import { toBalanceView, type ReceiptLineView } from './types';

const t = messages.disposalIssue;

const LINE_A = 9401;
const LINE_B = 9402;
const LINE_C = 9403;

const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 자재 가';
const UOM_LABEL = 'SAMPLE-UOM-EA · 합성 낱개';
const LOCATION_LABEL = 'SAMPLE-LOC-01 · 합성 적치 가';

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

const lotSource = (overrides: Partial<LotReferenceSource> = {}): LotReferenceSource => ({
  entries: Object.values(lotFixturesByItem)
    .flat()
    .map((lot) => ({ value: String(lot.lotId), label: lot.lotNo, isActive: true, held: lot.held ?? false })),
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

/** 두 품목의 잔액이 실제로 온 상태. */
const balanceSource = (overrides: Partial<ItemBalance> = {}): BalanceSource => {
  const items: ItemBalance[] = [
    {
      itemId: 9301,
      entries: (balanceResponseFixturesByItem[9301] ?? []).map(toBalanceView),
      isLoading: false,
      isError: false,
      truncated: false,
      ...overrides,
    },
    {
      itemId: 9302,
      entries: (balanceResponseFixturesByItem[9302] ?? []).map(toBalanceView),
      isLoading: false,
      isError: false,
      truncated: false,
    },
  ];

  return {
    items,
    isError: items.some((item) => item.isError),
    truncated: items.some((item) => item.truncated),
  };
};

const rowsFrom = (
  draft: LineDraft = EMPTY_LINE_DRAFT,
  balances = balanceSource(),
): DisposalLineRow[] => toDisposalLineRows(receiptLineFixtures, draft, balances);

const columnInput = () => ({
  itemLookup: itemSource(),
  uomLookup: uomSource(),
  lotLookup: lotSource(),
  locationLookup: locationSource(),
  reasonIdPrefix: 'reason',
  isLocked: false,
  onToggleSelect: vi.fn(),
  onChangeQty: vi.fn(),
});

const baseProps = (overrides: Partial<GrLineTableProps> = {}): GrLineTableProps => {
  const rows = overrides.rows ?? rowsFrom();

  return {
    rows,
    itemLookup: itemSource(),
    uomLookup: uomSource(),
    lotLookup: lotSource(),
    locationLookup: locationSource(),
    hasBalanceError: false,
    hasBalanceTruncated: false,
    isLocked: false,
    selection: describeDisposalSelection(rows),
    onToggleSelect: vi.fn(),
    onChangeQty: vi.fn(),
    onRetryReferences: vi.fn(),
    onRetryBalances: vi.fn(),
    ...overrides,
  };
};

const renderTable = (overrides: Partial<GrLineTableProps> = {}) => {
  const props = baseProps(overrides);
  const { rerender } = render(<GrLineTable {...props} />);

  return { props, rerender, user: userEvent.setup() };
};

/** 줄에 매인 두 컨트롤. **표시 순번으로 집는다** — 내부 번호를 접근 이름에 넣지 않는다. */
const qtyBox = (ordinal: number): HTMLElement =>
  screen.getByRole('textbox', { name: t.lineTable.disposalQtyLabel(ordinal) });

const selectBox = (ordinal: number): HTMLElement =>
  screen.getByRole('checkbox', { name: t.lineTable.selectLabel(ordinal) });

/**
 * **열 폭 예산**(완료 조건 C31).
 *
 * 흡수 열이 둘이 되거나 지정 폭이 커지면 표가 하한을 넘겨 늘 가로 스크롤이 된다.
 * 열 폭 합만 세면 흡수 열이 몇십 px밖에 못 받는 어긋남을 놓치므로 **남는 폭까지 함께 잰다.**
 */
describe('buildGrLineColumns — 열 폭', () => {
  const columns = buildGrLineColumns(columnInput());

  it('열이 일곱이다', () => {
    expect(columns.map((column) => column.key)).toEqual([
      'select',
      'item',
      'lot',
      'location',
      'receiptQty',
      'onHandQty',
      'disposalQty',
    ]);
  });

  it('흡수 열이 정확히 하나다', () => {
    expect(columns.filter((column) => column.width === undefined)).toHaveLength(1);
  });

  it('지정 폭 합과 흡수 예산이 표 하한 안에 든다', () => {
    const fixed = columns.reduce(
      (sum, column) => sum + Number.parseInt(column.width ?? '0px', 10),
      0,
    );

    expect(fixed).toBe(720);
    /* 흡수 열이 실제로 받는 폭이 예산(184px)보다 넓어야 「코드 · 이름」이 접히지 않는다. */
    expect(LINE_TABLE_MIN_WIDTH_PX - fixed).toBe(208);
  });
});

describe('GrLineTable — 이름과 값', () => {
  /**
   * **스펙 5열의 나머지 셋이 이 표에 있다**(승인 기록 정정 2) — 품목·자재 LOT·보유 수량.
   * 대상 표가 내는 원천(입고번호)·입고일과 합쳐 다섯이 화면에서 함께 읽힌다.
   */
  it('품목·LOT·보유 수량 열이 있다', () => {
    renderTable();

    for (const header of [t.lineTable.item, t.lineTable.lot, t.lineTable.onHandQty]) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
  });

  it('참조 넷을 이름으로 푼다', () => {
    renderTable();

    expect(screen.getAllByText(ITEM_LABEL).length).toBeGreaterThan(0);
    expect(screen.getByText('SAMPLE-LOT-0001')).toBeInTheDocument();
    expect(screen.getAllByText(LOCATION_LABEL).length).toBeGreaterThan(0);
    expect(screen.getByText(t.lineTable.receiptQtyPair(100, UOM_LABEL))).toBeInTheDocument();
  });

  /**
   * **참조 네 갈래가 서로 다른 문구를 낸다**(완료 조건 C21) — 뭉치면 사용자가 원인을 반대로
   * 읽는다. 특히 「알 수 없음」은 *값이 잘못됐다*는 신호로 이 화면이 정의해 두었으므로,
   * 미도착·실패를 그 글자로 내면 정상 값이 잘못된 값으로 보인다(`omf-mes#47`).
   */
  it.each([
    ['미도착', { entries: [], isLoading: true }, t.values.referenceLoading],
    ['실패', { entries: [], isError: true }, t.values.referenceFailed],
    ['목록에 없음', { entries: [] }, t.values.unknown],
  ])('품목 이름의 %s 갈래를 그 문구로 낸다', (_name, overrides, message) => {
    renderTable({ itemLookup: itemSource(overrides) });

    expect(screen.getAllByText(message).length).toBeGreaterThan(0);
    /* 짝 방향 — 정상 갈래의 이름은 그 자리에 없다. */
    expect(screen.queryByText(ITEM_LABEL)).not.toBeInTheDocument();
  });

  it('정상 갈래는 이름을 낸다', () => {
    renderTable();

    expect(screen.getAllByText(ITEM_LABEL).length).toBeGreaterThan(0);
    for (const message of [t.values.referenceLoading, t.values.referenceFailed]) {
      expect(screen.queryByText(message)).not.toBeInTheDocument();
    }
  });

  /**
   * **짝 단언** — 이름이 보이는 것을 먼저 재고 번호가 없음을 잰다(`omf-mes#44`).
   * 이름을 못 푼 갈래에서도 번호를 대신 내지 않는다.
   */
  it.each([
    ['정상', {}],
    ['이름 실패', { itemLookup: itemSource({ entries: [], isError: true }) }],
    ['LOT 실패', { lotLookup: lotSource({ entries: [], isError: true }) }],
  ])('%s 갈래에도 내부 번호를 내지 않는다', (_name, overrides) => {
    renderTable(overrides);

    const table = screen.getByRole('table');

    /* 아무것도 안 그려도 통과하지 않게 — 라인이 실제로 그려졌음을 먼저 잰다. */
    expect(within(table).getAllByRole('row').length).toBe(receiptLineFixtures.length + 1);

    for (const id of INTERNAL_IDS) {
      expect(table.textContent ?? '').not.toContain(id);
    }
  });

  /** **보류 표식은 글자다** — 색에만 기대지 않는다. 그리고 **막지 않는다.** */
  it('보류인 LOT에만 표식이 붙고 그 줄도 고를 수 있다', async () => {
    const { props } = renderTable();

    expect(screen.getAllByText(t.values.lotHeld)).toHaveLength(1);
    expect(screen.getByText(t.notes.lotHold)).toBeInTheDocument();

    const heldCheckbox = screen.getByRole('checkbox', { name: t.lineTable.selectLabel(2) });

    expect(heldCheckbox).toBeEnabled();

    const user = userEvent.setup();

    await user.click(heldCheckbox);
    expect(props.onToggleSelect).toHaveBeenCalledWith(LINE_B);
  });

  /** 보류가 하나도 없으면 안내를 세우지 않는다 — 늘 세워 두면 안내가 배경이 된다. */
  it('보류가 없으면 안내가 서지 않는다', () => {
    renderTable({ lotLookup: lotSource({ entries: [] }) });

    expect(screen.queryByText(t.notes.lotHold)).not.toBeInTheDocument();
  });
});

describe('GrLineTable — 폐기 수량 칸', () => {
  /**
   * **빈 칸으로 시작한다**(완료 조건 C26 · 감지기 M26). 입고 수량으로 미리 채우면
   * 전량 폐기가 기본값처럼 보이고, 사용자가 그대로 확인하면 받은 전부가 장부에서 빠진다.
   */
  it('빈 칸으로 시작하고 그 이유를 밝힌다', () => {
    renderTable();

    for (const ordinal of [1, 2, 3]) {
      expect(screen.getByRole('textbox', { name: t.lineTable.disposalQtyLabel(ordinal) })).toHaveValue(
        '',
      );
    }

    expect(screen.getByText(t.notes.disposalQtyEmptyStart)).toBeInTheDocument();
  });

  it('친 글자를 그대로 보이고 바뀌면 알린다', async () => {
    const draft = setDraftQty(EMPTY_LINE_DRAFT, LINE_A, '0.');
    const { props, user } = renderTable({ rows: rowsFrom(draft) });
    const input = screen.getByRole('textbox', { name: t.lineTable.disposalQtyLabel(1) });

    expect(input).toHaveValue('0.');

    await user.type(input, '5');
    expect(props.onChangeQty).toHaveBeenCalledWith(LINE_A, '0.5');
  });

  /** 인라인 오류가 **그 줄의 칸 아래에** 선다 — 어느 줄이 잘못됐는지 표에서 읽힌다. */
  it.each([
    ['0', t.errors.qtyNotPositive],
    ['-1', t.errors.qtyNotPositive],
    ['Infinity', t.errors.qtyNotNumber],
    ['가나다', t.errors.qtyNotNumber],
    ['81', t.errors.qtyOverOnHand(80)],
  ])('폐기 수량 %j에 오류를 낸다', (text, message) => {
    const draft = setDraftQty(toggleLineSelection(EMPTY_LINE_DRAFT, LINE_A), LINE_A, text);

    renderTable({ rows: rowsFrom(draft) });

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  /** 상한 정확히는 통과한다 — 경계에서 정당한 폐기를 막지 않는다. */
  it('상한 정확히는 오류를 내지 않는다', () => {
    const draft = setDraftQty(toggleLineSelection(EMPTY_LINE_DRAFT, LINE_A), LINE_A, '80');

    renderTable({ rows: rowsFrom(draft) });

    expect(screen.queryByText(t.errors.qtyOverOnHand(80))).not.toBeInTheDocument();
  });

  /**
   * **고를 수 없는 줄**은 두 컨트롤이 함께 잠기고 **한 사유**를 가리킨다 — 같은 문장을 두 번
   * 그리면 화면이 같은 말을 되풀이한다.
   */
  it('고를 수 없는 줄은 두 컨트롤이 한 사유를 가리킨다', () => {
    const broken = [{ ...receiptLineFixtures[0], itemId: 0 }] as typeof receiptLineFixtures;
    const rows = toDisposalLineRows(broken, EMPTY_LINE_DRAFT, balanceSource());

    renderTable({ rows, selection: describeDisposalSelection(rows) });

    const checkbox = screen.getByRole('checkbox', { name: t.lineTable.selectLabel(1) });
    const input = screen.getByRole('textbox', { name: t.lineTable.disposalQtyLabel(1) });

    expect(checkbox).toBeDisabled();
    expect(input).toBeDisabled();
    expect(screen.getByText(t.reasons.lineMissingValues)).toBeInTheDocument();
    expect(checkbox.getAttribute('aria-describedby')).toBe(input.getAttribute('aria-describedby'));
    expect(checkbox.getAttribute('aria-describedby')).not.toBeNull();
  });

  /**
   * **잠금 사유 `id`가 줄마다 갈린다**(전례 감지기 이식 — 리뷰 t2 Major ②).
   *
   * 갈리지 않으면 **DOM에 같은 `id`가 여럿** 생기고 `aria-describedby`가 첫 요소로 풀려,
   * 3번 줄의 체크박스가 **2번 줄의 사유를 읽는다.** 이 표는 사유가 둘(값 없음 / 수량 0 이하)로
   * 갈리므로 실제로 **다른 문장**을 가리키게 된다 — 스크린리더 사용자에게 조용히 틀린다.
   */
  it('잠긴 줄이 둘이면 각 줄의 두 칸이 자기 줄의 사유를 가리킨다', () => {
    const rows = toDisposalLineRows(
      [
        { ...(receiptLineFixtures[0] as ReceiptLineView), goodsReceiptLineId: 9404, lotId: 0 },
        { ...(receiptLineFixtures[0] as ReceiptLineView), goodsReceiptLineId: 9405, receiptQty: 0 },
      ],
      EMPTY_LINE_DRAFT,
      balanceSource(),
    );

    renderTable({ rows, selection: describeDisposalSelection(rows) });

    const firstId = selectBox(1).getAttribute('aria-describedby') ?? '';
    const secondId = selectBox(2).getAttribute('aria-describedby') ?? '';

    expect(firstId).not.toBe('');
    expect(firstId).not.toBe(secondId);

    /* 같은 `id`가 둘 이상 생기지 않는다 — 무엇을 가리키는지가 갈린다. */
    for (const id of [firstId, secondId]) {
      expect([...document.querySelectorAll('[id]')].filter((node) => node.id === id)).toHaveLength(
        1,
      );
    }

    expect(document.getElementById(firstId)?.textContent).toBe(t.reasons.lineMissingValues);
    expect(document.getElementById(secondId)?.textContent).toBe(t.reasons.lineQtyNotPositive);

    /* 수량 칸도 같은 짝을 가리킨다 — 한 줄 안에서 두 컨트롤이 사유를 공유하는 형태다. */
    expect(qtyBox(1).getAttribute('aria-describedby')).toContain(firstId);
    expect(qtyBox(2).getAttribute('aria-describedby')).toContain(secondId);
  });

  /**
   * **`getRowId` 감지기**(전례 이식 — 리뷰 t2 Major ②). 이 표에는 **줄에 매인 입력칸**이 있다.
   *
   * 행 식별자를 떼면 React key가 인덱스가 되어, 앞 줄이 사라질 때 **치고 있던 칸의 DOM 노드가
   * 대신 지워진다** — 포커스와 캐럿이 말없이 다른 줄의 칸으로 옮겨 간다. 그 표에서 사용자는
   * **친 값이 다른 줄로 옮겨 붙은 것을 알아채지 못한 채** 폐기 수량을 확정한다.
   */
  it('앞 줄이 사라져도 치고 있던 칸의 포커스가 남는다', async () => {
    const lines = receiptLineFixtures.slice(0, 2);
    const { rerender, user } = renderTable({
      rows: toDisposalLineRows(lines, EMPTY_LINE_DRAFT, balanceSource()),
    });

    await user.click(qtyBox(2));

    expect(document.activeElement).toBe(qtyBox(2));

    rerender(
      <GrLineTable
        {...baseProps({
          rows: toDisposalLineRows(lines.slice(1), EMPTY_LINE_DRAFT, balanceSource()),
        })}
      />,
    );

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(document.activeElement).toBe(qtyBox(1));
  });

  /**
   * **전송 중 잠금은 뜻이 다르다** — 「이 줄은 폐기할 수 없다」가 아니라 「지금은 아무 줄도
   * 못 고친다」다. 그래서 사유를 붙이지 않는다.
   */
  it('전체 잠금은 사유를 붙이지 않고 잠근다', () => {
    renderTable({ isLocked: true });

    const checkbox = screen.getByRole('checkbox', { name: t.lineTable.selectLabel(1) });

    expect(checkbox).toBeDisabled();
    expect(checkbox.getAttribute('aria-describedby')).toBeNull();
  });
});

describe('GrLineTable — 보유 수량과 요약', () => {
  /** **가용 45가 아니라 보유 80**을 낸다(완료 조건 C23) — 두 값이 다른 픽스처로 잰다. */
  it('보유 수량을 내고 가용 수량을 내지 않는다', () => {
    renderTable();

    expect(screen.getByText(t.lineTable.onHandQtyPair(80, UOM_LABEL))).toBeInTheDocument();
    expect(screen.queryByText(t.lineTable.onHandQtyPair(40, UOM_LABEL))).not.toBeInTheDocument();
  });

  /** 보유가 **0으로 확인된** 줄은 「확인하지 못함」이 아니라 0이다. */
  it('보유가 0인 줄은 0으로 낸다', () => {
    renderTable();

    expect(screen.getByText(t.lineTable.onHandQtyPair(0, UOM_LABEL))).toBeInTheDocument();
  });

  /**
   * **모르는 것을 아는 척하지 않는다.** 못 구한 자리에 `0`이나 「—」를 내면 사용자가 그것을
   * 사실로 읽는다 — 「확인하지 못함」은 값이 아니라 화면의 한계를 말하는 글자다.
   */
  it('확인하지 못한 줄에는 그 표식과 「막지 않는다」 안내가 함께 선다', () => {
    const rows = rowsFrom(EMPTY_LINE_DRAFT, {
      items: [
        { itemId: 9301, entries: [], isLoading: false, isError: true, truncated: false },
        { itemId: 9302, entries: [], isLoading: false, isError: false, truncated: false },
      ],
      isError: true,
      truncated: false,
    });

    renderTable({ rows, selection: describeDisposalSelection(rows), hasBalanceError: true });

    expect(screen.getAllByText(t.values.onHandUnknown).length).toBeGreaterThan(0);
    expect(screen.getByText(t.reasons.onHandUnknownNote)).toBeInTheDocument();
    expect(screen.getByText(t.reasons.balancesFailed)).toBeInTheDocument();
  });

  /**
   * **못 찾은 것과 잘린 것도 「확인하지 못함」이다**(완료 조건 C24). 못 찾은 자리를 `0`으로
   * 읽으면 **정당한 폐기를 화면이 막고**, 잘린 목록의 합계를 상한으로 쓰면 실제보다 적은
   * 수를 상한으로 삼는다 — 둘 다 사용자가 할 수 있는 일을 못 하게 만든다.
   */
  it.each([
    ['그 LOT을 못 찾음', { entries: [] }],
    ['목록이 잘림', { truncated: true }],
  ])('%s 갈래도 「확인하지 못함」으로 내고 막지 않는다', (_name, overrides) => {
    const rows = rowsFrom(
      setDraftQty(toggleLineSelection(EMPTY_LINE_DRAFT, LINE_A), LINE_A, '99999'),
      balanceSource(overrides),
    );

    renderTable({ rows, selection: describeDisposalSelection(rows) });

    expect(screen.getAllByText(t.values.onHandUnknown).length).toBeGreaterThan(0);
    expect(screen.getByText(t.reasons.onHandUnknownNote)).toBeInTheDocument();
    /* 막지 않는다 — 상한을 넘겼다는 오류도, 다음 단계를 막는 사유도 서지 않는다. */
    expect(screen.queryByText(t.reasons.selectQtyInvalid)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: t.lineTable.disposalQtyLabel(1) })).toBeEnabled();
  });

  /** 전부 확인된 화면에서는 「막지 않는다」 안내를 세우지 않는다. */
  it('전부 확인됐으면 그 안내가 서지 않는다', () => {
    renderTable();

    expect(screen.queryByText(t.reasons.onHandUnknownNote)).not.toBeInTheDocument();
  });

  it('아무것도 고르지 않으면 그 사실과 사유를 낸다', () => {
    renderTable();

    expect(screen.getByText(t.selection.none)).toBeInTheDocument();
    expect(screen.getByText(t.reasons.selectNone)).toBeInTheDocument();
  });

  it('고른 줄 수와 합계를 낸다', () => {
    const draft = setDraftQty(toggleLineSelection(EMPTY_LINE_DRAFT, LINE_A), LINE_A, '5');

    renderTable({ rows: rowsFrom(draft), selection: describeDisposalSelection(rowsFrom(draft)) });

    expect(screen.getByText(t.selection.summary(1, 5, UOM_LABEL))).toBeInTheDocument();
  });

  /** **단위가 섞이면 합치지 않는다**(완료 조건 C28 · 감지기 M29) — 줄 수는 그대로 낸다. */
  it('단위가 섞이면 합계를 내지 않는다', () => {
    let draft = setDraftQty(toggleLineSelection(EMPTY_LINE_DRAFT, LINE_A), LINE_A, '5');

    draft = setDraftQty(toggleLineSelection(draft, LINE_C), LINE_C, '2');

    const rows = rowsFrom(draft);

    renderTable({ rows, selection: describeDisposalSelection(rows) });

    expect(screen.getByText(t.selection.summaryMixedUom(2))).toBeInTheDocument();
    expect(screen.queryByText(t.selection.summary(2, 7, UOM_LABEL))).not.toBeInTheDocument();
  });
});

describe('GrLineTable — 빈 상태와 복구', () => {
  /**
   * **빈 상태를 바깥에서 가르지 않는다.** 표를 늘 그리고 `empty`가 0건을 맡는다 —
   * 바깥에서 0건을 갈라 내면 `Table.empty`가 닿을 수 없는 가지가 된다.
   */
  it('라인이 0건이면 표의 빈 상태가 맡는다', () => {
    const rows = toDisposalLineRows([], EMPTY_LINE_DRAFT, balanceSource());

    renderTable({ rows, selection: describeDisposalSelection(rows) });

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(t.empty.noLinesTitle)).toBeInTheDocument();
  });

  /** **문구에 적은 대상과 다시 부르는 대상이 같아야 한다** — 잔액과 이름을 갈라 낸다. */
  it('잔액 실패와 이름 실패가 각자의 복구 경로를 갖는다', async () => {
    const { props, user } = renderTable({
      hasBalanceError: true,
      itemLookup: itemSource({ entries: [], isError: true }),
    });

    expect(screen.getByText(t.reasons.balancesFailed)).toBeInTheDocument();
    expect(screen.getByText(t.reasons.lineReferencesFailed)).toBeInTheDocument();

    const [retryBalances, retryReferences] = screen.getAllByRole('button', {
      name: messages.common.retry,
    });

    await user.click(retryBalances as HTMLElement);
    expect(props.onRetryBalances).toHaveBeenCalledTimes(1);

    await user.click(retryReferences as HTMLElement);
    expect(props.onRetryReferences).toHaveBeenCalledTimes(1);
  });

  /** **잘림은 실패와 따로 낸다** — 다시 불러도 같은 쪽이 오므로 복구 버튼을 붙이지 않는다. */
  it('잘림은 사실만 밝히고 복구 버튼을 붙이지 않는다', () => {
    renderTable({
      hasBalanceTruncated: true,
      itemLookup: itemSource({ truncated: true }),
    });

    expect(screen.getByText(t.reasons.balancesTruncated)).toBeInTheDocument();
    expect(screen.getByText(t.reasons.lineReferencesTruncated)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});
