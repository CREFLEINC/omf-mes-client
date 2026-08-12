import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  balanceFixtures,
  goodsReceiptLine,
  goodsReceiptLineFixtures,
  INTERNAL_IDS,
  itemFixtures,
  locationFixtures,
  lotFixtures,
  ON_HAND_9601,
  uomFixtures,
} from './fixtures';
import { TABLE_MIN_WIDTH_PX } from './gr-table';
import { buildGrLineColumns, GrLineTable, type GrLineTableProps } from './gr-line-table';
import {
  EMPTY_LINE_DRAFT,
  setDraftQty,
  toggleLineSelection,
  type LineDraft,
} from './line-draft';
import type { LotReferenceSource, ReferenceSource } from './lookups';
import type { BalanceSource, ItemBalance } from './on-hand';
import { describeReturnSelection, toReturnLineRows, type ReturnLineRow } from './return-selection';
import { toBalanceView } from './types';

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

/** 품목 9301의 잔액이 실제로 온 상태. 9302(9402의 품목)의 줄은 없다 — 「확인하지 못함」 갈래다. */
const balanceSource = (overrides: Partial<ItemBalance> = {}): BalanceSource => {
  const items: ItemBalance[] = [
    {
      itemId: 9301,
      entries: balanceFixtures.filter((row) => row.itemId === 9301).map(toBalanceView),
      isLoading: false,
      isError: false,
      truncated: false,
      ...overrides,
    },
    {
      itemId: 9302,
      entries: [],
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

const rowsFrom = (draft: LineDraft = EMPTY_LINE_DRAFT, balances = balanceSource()): ReturnLineRow[] =>
  toReturnLineRows(goodsReceiptLineFixtures, draft, balances);

const columnInput = () => ({
  itemLookup: itemSource(),
  uomLookup: uomSource(),
  lotLookup: lotSource(),
  locationLookup: locationSource(),
  reasonIdPrefix: 'test-reason',
  isLocked: false,
  onToggleSelect: vi.fn(),
  onChangeQty: vi.fn(),
});

/**
 * 기본 props.
 *
 * **판정을 화면이 부른 결과로 받는다**(완료 조건 C31). 표가 스스로 부르면 「반품 처리」
 * 버튼과 호출 자리가 둘로 갈린다 — 여기서도 줄과 판정이 **같은 입력에서** 나오게 묶는다.
 */
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
    selection: describeReturnSelection(rows),
    onToggleSelect: vi.fn(),
    onChangeQty: vi.fn(),
    onRetryReferences: vi.fn(),
    onRetryBalances: vi.fn(),
    ...overrides,
  };
};

const renderTable = (overrides: Partial<GrLineTableProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<GrLineTable {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

const selectBox = (ordinal: number): HTMLElement =>
  screen.getByRole('checkbox', { name: t.lineTable.selectLabel(ordinal) });

const qtyBox = (ordinal: number): HTMLElement =>
  screen.getByRole('textbox', { name: t.lineTable.returnQtyLabel(ordinal) });

describe('buildGrLineColumns — 열 폭 예산', () => {
  const columns = buildGrLineColumns(columnInput());

  /** **M30** — 흡수 열이 둘이 되면 「코드 · 이름」이 낱말 단위로 쪼개진다. */
  it('흡수 열이 정확히 하나다', () => {
    expect(columns.filter((column) => column.width === undefined)).toHaveLength(1);
  });

  it('지정 폭 합과 흡수 예산이 표 하한 안에 든다', () => {
    const fixed = columns.reduce(
      (sum, column) => sum + Number.parseInt(column.width ?? '0px', 10),
      0,
    );

    expect(fixed).toBe(720);
    expect(TABLE_MIN_WIDTH_PX - fixed).toBeGreaterThanOrEqual(184);
  });

  /** 선택·보유 수량·반품 수량 세 열이 붙어 일곱이 됐다(계획 §5.5). */
  it('열이 일곱이고 차례가 정해져 있다', () => {
    expect(columns.map((column) => column.key)).toEqual([
      'select',
      'item',
      'lot',
      'location',
      'receiptQty',
      'onHandQty',
      'returnQty',
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

  /**
   * 입고 수량 칸을 **자리로 집는다.** 9403은 수량이 0이고 단위 이름도 안 풀려 보유 수량 칸과
   * 글자가 같아지는데, 글자로 집으면 어느 칸을 잰 것인지가 흐려진다.
   */
  it('수량이 소수여도 0이어도 그대로 낸다', () => {
    renderTable();

    expect(screen.getByText(t.lineTable.receiptQtyPair(12.5, UOM_LABEL))).toBeInTheDocument();

    const row = screen.getAllByRole('row')[3];

    if (row === undefined) throw new Error('9403의 줄이 없다');

    expect(within(row).getAllByRole('cell')[4]?.textContent).toBe(
      t.lineTable.receiptQtyPair(0, t.values.unknown),
    );
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
   * 접근 이름과 사유 `id`에도 내부 번호를 넣지 않는다 — 글자는 아니지만 DOM에 남고,
   * 한 번 쓰기 시작하면 접근 이름으로도 샌다.
   */
  it('접근 이름과 id 속성에도 내부 번호가 없다', () => {
    const { container } = renderTable();

    for (const element of container.querySelectorAll('[aria-label], [id], [aria-describedby]')) {
      const attributes = [
        element.getAttribute('aria-label') ?? '',
        element.getAttribute('id') ?? '',
        element.getAttribute('aria-describedby') ?? '',
      ].join(' ');

      for (const id of INTERNAL_IDS) {
        expect(attributes).not.toContain(id);
      }
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
     * 9403의 단위도 목록에 없으나 수량 표기 안에 붙어 있어 따로 세지 않는다.
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

    expect(screen.getByText(t.values.lotHeld).textContent).toBe(t.values.lotHeld);
  });

  /** **보류가 선택을 막지 않는다** — 보류된 자재를 되돌려 보내는 것이 이 화면의 주 용도다. */
  it('보류 중인 LOT의 줄도 고를 수 있다', () => {
    renderTable();

    expect(selectBox(2)).toBeEnabled();
  });

  it('보류가 아닌 LOT에는 표식이 없다', () => {
    renderTable({ rows: toReturnLineRows([goodsReceiptLine()], EMPTY_LINE_DRAFT, balanceSource()) });

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
    renderTable({ rows: toReturnLineRows([goodsReceiptLine()], EMPTY_LINE_DRAFT, balanceSource()) });

    expect(screen.queryByText(t.notes.lotHold)).not.toBeInTheDocument();
  });
});

describe('GrLineTable — 줄 선택', () => {
  /**
   * **부정 방향의 짝** — 「고를 수 없는 줄은 잠긴다」만 재면 **전부 잠가도** 통과한다.
   * 두 칸이 다 열려 있는 줄이 실제로 있어야 잠금이 조건부임을 잰 것이 된다.
   */
  it('고를 수 있는 줄의 두 칸은 잠기지 않는다', () => {
    renderTable();

    expect(selectBox(1)).toBeEnabled();
    expect(selectBox(2)).toBeEnabled();
    expect(qtyBox(1)).toBeEnabled();
    expect(qtyBox(2)).toBeEnabled();
  });

  it('누르면 그 줄의 번호로 알린다', async () => {
    const { onToggleSelect, user } = renderTable();

    await user.click(selectBox(1));

    expect(onToggleSelect).toHaveBeenCalledExactlyOnceWith(9401);
  });

  /** **부품이 스스로 판정하지 않는다**(C31) — 골라졌는지는 받은 줄이 말한다. */
  it('골라진 줄의 칸이 켜져 있다', () => {
    renderTable({ rows: rowsFrom(toggleLineSelection(EMPTY_LINE_DRAFT, 9401)) });

    expect(selectBox(1)).toBeChecked();
    expect(selectBox(2)).not.toBeChecked();
  });

  /**
   * **M29** — 고를 수 없는 줄은 잠기고 **사유가 함께** 보인다. `disabled`만 두고 사유를 떼면
   * 사용자가 무엇을 해야 풀리는지 알 수 없고, 사유만 두고 잠금을 떼면 고를 수 없는 줄이
   * 요청에 실린다.
   */
  it('고를 수 없는 줄은 사유와 함께 잠긴다', () => {
    renderTable();

    const box = selectBox(3);

    expect(box).toBeDisabled();
    expect(screen.getByText(t.reasons.lineQtyNotPositive)).toBeInTheDocument();

    const describedBy = box.getAttribute('aria-describedby');

    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(
      t.reasons.lineQtyNotPositive,
    );
  });

  /**
   * **잠긴 줄의 칸은 비어 있다.** 체크된 채로 보이면 화면이 어긋난 두 말을 한다 —
   * 눈에는 골라진 줄로 보이는데 요약은 「아직 고른 줄이 없습니다」라고 적는다.
   * 앞 잣대는 `disabled`와 사유만 보아 이 자리를 지나가지 않았다.
   */
  it('고를 수 없는 줄은 초안에 있어도 체크되지 않고 요약에도 들지 않는다', () => {
    const draft = setDraftQty(
      toggleLineSelection(toggleLineSelection(EMPTY_LINE_DRAFT, 9401), 9403),
      9401,
      '10',
    );

    renderTable({ rows: rowsFrom(draft) });

    expect(selectBox(3)).not.toBeChecked();
    /* 짝 방향 — 같은 초안에 든 **고를 수 있는** 줄은 실제로 체크되고 요약에 든다. */
    expect(selectBox(1)).toBeChecked();
    expect(screen.getByText(t.selection.summary(1, 10, UOM_LABEL))).toBeInTheDocument();
  });

  it('고를 수 있는 줄에는 사유가 붙지 않는다', () => {
    renderTable();

    expect(selectBox(1).getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByText(t.reasons.lineMissingValues)).not.toBeInTheDocument();
  });

  /**
   * **사유는 줄마다 갈린다.** 잠긴 줄이 둘 이상일 때 `id`가 같으면 ⓐ 같은 `id`가 DOM에 여럿
   * 생기고 ⓑ 둘째 줄의 두 컨트롤이 **첫 줄의 사유**를 가리켜 **틀린 사유를 읽어 준다** —
   * 사유가 두 갈래(값 없음 / 수량 0 이하)라 실제로 어긋난 안내가 만들어진다.
   *
   * 기본 픽스처에는 잠기는 줄이 하나뿐이라 이 상태 자체가 만들어지지 않았다.
   */
  it('잠긴 줄이 둘이면 각 줄의 두 칸이 자기 줄의 사유를 가리킨다', () => {
    const rows = toReturnLineRows(
      [
        goodsReceiptLine({ goodsReceiptLineId: 9404, lotId: 0 }),
        goodsReceiptLine({ goodsReceiptLineId: 9405, receiptQty: 0 }),
      ],
      EMPTY_LINE_DRAFT,
      balanceSource(),
    );

    renderTable({ rows });

    const firstId = selectBox(1).getAttribute('aria-describedby') ?? '';
    const secondId = selectBox(2).getAttribute('aria-describedby') ?? '';

    expect(firstId).not.toBe('');
    expect(firstId).not.toBe(secondId);

    /* 같은 `id`가 둘 이상 생기지 않는다 — 무엇을 가리키는지가 갈린다. */
    for (const id of [firstId, secondId]) {
      expect([...document.querySelectorAll('[id]')].filter((node) => node.id === id)).toHaveLength(1);
    }

    expect(document.getElementById(firstId)?.textContent).toBe(t.reasons.lineMissingValues);
    expect(document.getElementById(secondId)?.textContent).toBe(t.reasons.lineQtyNotPositive);

    /* 수량 칸도 같은 짝을 가리킨다 — 한 줄 안에서 두 컨트롤이 사유를 공유하는 형태다. */
    expect(qtyBox(1).getAttribute('aria-describedby')).toContain(firstId);
    expect(qtyBox(2).getAttribute('aria-describedby')).toContain(secondId);
  });

  /** 값이 빠진 줄은 다른 사유로 잠긴다 — 두 사유가 갈려야 사용자가 원인을 안다. */
  it('값이 빠진 줄은 그 사유로 잠긴다', () => {
    renderTable({
      rows: toReturnLineRows([goodsReceiptLine({ lotId: 0 })], EMPTY_LINE_DRAFT, balanceSource()),
    });

    expect(selectBox(1)).toBeDisabled();
    expect(screen.getByText(t.reasons.lineMissingValues)).toBeInTheDocument();
  });
});

describe('GrLineTable — 반품 수량 입력', () => {
  /** **M22 · 승인 13-7** — 입고 수량으로 채우면 전량 반품이 기본값처럼 보인다. */
  it('수량 칸이 빈 칸으로 시작한다', () => {
    renderTable();

    expect(qtyBox(1)).toHaveValue('');
    expect(qtyBox(2)).toHaveValue('');
  });

  it('빈 칸으로 시작한다는 사실을 표 위에서 밝힌다', () => {
    renderTable();

    expect(screen.getByText(t.notes.returnQtyEmptyStart)).toBeInTheDocument();
  });

  it('치면 그 줄의 번호와 친 글자를 알린다', async () => {
    const { onChangeQty, user } = renderTable();

    await user.type(qtyBox(1), '7');

    expect(onChangeQty).toHaveBeenCalledExactlyOnceWith(9401, '7');
  });

  it('친 글자를 그대로 보인다', () => {
    renderTable({ rows: rowsFrom(setDraftQty(EMPTY_LINE_DRAFT, 9401, '0.')) });

    expect(qtyBox(1)).toHaveValue('0.');
  });

  it('고를 수 없는 줄의 수량 칸은 사유와 함께 잠긴다', () => {
    renderTable();

    const box = qtyBox(3);

    expect(box).toBeDisabled();

    const describedBy = box.getAttribute('aria-describedby') ?? '';

    expect(
      describedBy
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent)
        .filter((text) => text === t.reasons.lineQtyNotPositive),
    ).toHaveLength(1);
  });

  /**
   * **생산자를 지나가는가**(C31) — 오류 문구는 받은 줄에서 온다. 부품이 값을 다시 읽어
   * 판정하면 이 단언이 무너진다(수량 `50`은 그 자체로는 아무 오류도 만들지 않는다).
   */
  it('오류를 부품이 다시 판정하지 않고 받은 것을 낸다', () => {
    const [row] = rowsFrom(setDraftQty(EMPTY_LINE_DRAFT, 9401, '50'));

    if (row === undefined) throw new Error('줄이 없다');

    renderTable({ rows: [{ ...row, error: '합성 오류 문구' }] });

    expect(screen.getByText('합성 오류 문구')).toBeInTheDocument();
  });

  it('오류가 없으면 오류 표시가 서지 않는다', () => {
    renderTable({ rows: rowsFrom(setDraftQty(EMPTY_LINE_DRAFT, 9401, '50')) });

    expect(qtyBox(1)).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(t.errors.qtyOverOnHand(ON_HAND_9601))).not.toBeInTheDocument();
  });

  it('상한을 넘긴 줄에 그 사유가 붙는다', () => {
    renderTable({ rows: rowsFrom(setDraftQty(EMPTY_LINE_DRAFT, 9401, '121')) });

    expect(screen.getByText(t.errors.qtyOverOnHand(ON_HAND_9601))).toBeInTheDocument();
    expect(qtyBox(1)).toHaveAttribute('aria-invalid', 'true');
  });

  /**
   * **`getRowId` 감지기** — 이 표에는 이제 **줄에 매인 입력칸**이 있다. 행 식별자를 떼면 React
   * key가 인덱스가 되어, 앞 줄이 사라질 때 **치고 있던 칸의 DOM 노드가 대신 지워진다** —
   * 포커스와 캐럿이 말없이 다른 줄의 칸으로 옮겨 간다.
   */
  it('앞 줄이 사라져도 치고 있던 칸의 포커스가 남는다', async () => {
    const lines = goodsReceiptLineFixtures.slice(0, 2);
    const { rerender, user } = renderTable({
      rows: toReturnLineRows(lines, EMPTY_LINE_DRAFT, balanceSource()),
    });

    await user.click(qtyBox(2));

    expect(document.activeElement).toBe(qtyBox(2));

    rerender(
      <GrLineTable
        {...baseProps({
          rows: toReturnLineRows(lines.slice(1), EMPTY_LINE_DRAFT, balanceSource()),
        })}
      />,
    );

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(document.activeElement).toBe(qtyBox(1));
  });
});

describe('GrLineTable — 보유 수량', () => {
  /** 같은 LOT의 여러 줄이 더해진 값이다(80 + 40) — 소유 구분으로 갈려 내려온다. */
  it('확인한 줄에 수량과 단위를 함께 낸다', () => {
    renderTable();

    expect(
      screen.getAllByText(t.lineTable.onHandQtyPair(ON_HAND_9601, UOM_LABEL)).length,
    ).toBeGreaterThan(0);
  });

  /** **M23** — 못 구한 것을 0이나 무제한으로 읽으면 정당한 반품이 막히거나 다 통과한다. */
  it('그 LOT의 잔액이 없으면 확인하지 못함으로 낸다', () => {
    renderTable();

    expect(screen.getByText(t.values.onHandUnknown)).toBeInTheDocument();
  });

  it('아직 오지 않았으면 불러오는 중으로 낸다', () => {
    renderTable({ rows: rowsFrom(EMPTY_LINE_DRAFT, balanceSource({ isLoading: true })) });

    expect(screen.getAllByText(t.values.onHandLoading).length).toBeGreaterThan(0);
  });

  /**
   * **승인 13-6** — 확인하지 못한 줄이 있으면 **막지 않는다는 사실**을 밝힌다.
   * 밝히지 않으면 사용자가 화면이 다 재어 준 줄 알고 보낸다.
   */
  it('확인하지 못한 줄이 있으면 막지 않는다는 사실을 밝힌다', () => {
    renderTable();

    expect(screen.getByText(t.reasons.onHandUnknownNote)).toBeInTheDocument();
  });

  it('전부 확인했으면 그 안내를 내지 않는다', () => {
    renderTable({ rows: rowsFrom().filter((row) => row.onHand.kind === 'known') });

    expect(screen.queryByText(t.reasons.onHandUnknownNote)).not.toBeInTheDocument();
  });

  /** 잔액 조회 실패는 이름 참조 실패와 따로 낸다 — 사용자가 할 판단이 다르다. */
  it('잔액 조회가 실패하면 사유와 복구 경로를 낸다', async () => {
    const { onRetryBalances, user } = renderTable({ hasBalanceError: true });

    expect(screen.getByText(t.reasons.balancesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryBalances).toHaveBeenCalledTimes(1);
  });

  /** 잘림에는 복구 버튼을 붙이지 않는다 — 다시 불러도 같은 쪽이 온다. */
  it('잔액 목록이 잘리면 사실만 밝힌다', () => {
    renderTable({ hasBalanceTruncated: true });

    expect(screen.getByText(t.reasons.balancesTruncated)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('정상이면 잔액 실패·잘림 안내가 없다', () => {
    renderTable();

    expect(screen.queryByText(t.reasons.balancesFailed)).not.toBeInTheDocument();
    expect(screen.queryByText(t.reasons.balancesTruncated)).not.toBeInTheDocument();
  });
});

describe('GrLineTable — 고른 줄 요약', () => {
  /** **C33** — 화면에 보이는 줄 수와 합계가 실제로 보낼 줄에서 나온다. */
  it('고른 줄 수와 합계를 낸다', () => {
    const draft = setDraftQty(toggleLineSelection(EMPTY_LINE_DRAFT, 9401), 9401, '10');

    renderTable({ rows: rowsFrom(draft) });

    expect(screen.getByText(t.selection.summary(1, 10, UOM_LABEL))).toBeInTheDocument();
  });

  it('아무 줄도 고르지 않았으면 그 사실을 낸다', () => {
    renderTable();

    expect(screen.getByText(t.selection.none)).toBeInTheDocument();
  });

  /** **C29** — 다음 단계로 갈 수 없는 사유가 화면에서 읽힌다. */
  it('갈 수 없는 사유를 낸다', () => {
    renderTable();

    expect(screen.getByText(t.reasons.selectNone)).toBeInTheDocument();
  });

  it('고른 줄의 수량이 비면 그 사유를 낸다', () => {
    renderTable({ rows: rowsFrom(toggleLineSelection(EMPTY_LINE_DRAFT, 9401)) });

    expect(screen.getByText(t.reasons.selectQtyMissing)).toBeInTheDocument();
  });

  it('갖춰지면 사유를 거둔다', () => {
    const draft = setDraftQty(toggleLineSelection(EMPTY_LINE_DRAFT, 9401), 9401, '10');

    renderTable({ rows: rowsFrom(draft) });

    for (const reason of [t.reasons.selectNone, t.reasons.selectQtyMissing, t.reasons.selectQtyInvalid]) {
      expect(screen.queryByText(reason)).not.toBeInTheDocument();
    }
  });

  /** 단위가 섞이면 합계를 내지 않는다 — 더한 수에 뜻이 없다. */
  it('단위가 섞이면 합계 대신 그 사실을 낸다', () => {
    const lines = [goodsReceiptLine(), goodsReceiptLine({ goodsReceiptLineId: 9402, uomId: 9599 })];
    const draft = setDraftQty(
      setDraftQty(toggleLineSelection(toggleLineSelection(EMPTY_LINE_DRAFT, 9401), 9402), 9401, '10'),
      9402,
      '5',
    );

    renderTable({ rows: toReturnLineRows(lines, draft, balanceSource()) });

    expect(screen.getByText(t.selection.summaryMixedUom(2))).toBeInTheDocument();
  });

  /** **부품이 스스로 세지 않는다**(C31) — 골라졌다고 표시된 줄만 센다. */
  it('요약을 부품이 다시 세지 않고 받은 줄에서 낸다', () => {
    const draft = setDraftQty(toggleLineSelection(EMPTY_LINE_DRAFT, 9401), 9401, '10');
    const rows = rowsFrom(draft).map((row) => ({ ...row, isSelected: false }));

    renderTable({ rows });

    expect(screen.getByText(t.selection.none)).toBeInTheDocument();
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
   * 판정도 넷을 다 보아야 한다 — 하나만 재면 그 참조만 실패했을 때 **복구 수단이 사라진다.**
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
   * **잘림은 실패와 따로 낸다.** 잘린 목록으로 이름을 풀면 정상 값이 「알 수 없음」으로 찍힌다.
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
  /** 반품을 보내는 버튼은 아직 없다 — 결과를 볼 수 없는 채로 재고가 움직여서는 안 된다. */
  it('표 안에 버튼이 없다', () => {
    renderTable();

    expect(within(screen.getByRole('table')).queryAllByRole('button')).toHaveLength(0);
  });
});

/**
 * **전송 중 잠금의 첫째 겹**(M33).
 *
 * 보내는 중에 줄 선택이나 수량이 바뀌면 **사용자가 확인한 것과 나가는 것이 갈린다.**
 * 고를 수 없는 줄의 잠금(`blocked`)과 뜻이 다르므로 두 잠금이 서로를 지우지 않는지도 잰다.
 */
describe('GrLineTable — 전송 중 잠금', () => {
  it('전송 중에는 선택칸과 수량칸이 모두 잠긴다', () => {
    renderTable({ isLocked: true });

    for (const ordinal of [1, 2, 3]) {
      expect(selectBox(ordinal)).toBeDisabled();
      expect(qtyBox(ordinal)).toBeDisabled();
    }
  });

  /** 짝 방향 — 전송 중이 아니면 고를 수 있는 줄이 열려 있다. */
  it('전송 중이 아니면 고를 수 있는 줄이 열려 있다', () => {
    renderTable();

    expect(selectBox(1)).not.toBeDisabled();
    expect(qtyBox(1)).not.toBeDisabled();
  });

  /*
   * 두 잠금이 서로를 지우지 않는다 — 전송이 끝나도 **고를 수 없는 줄은 그대로 잠겨 있어야**
   * 하고, 그 사유도 그대로 붙어 있어야 한다.
   */
  it('전송 중이어도 고를 수 없는 줄의 사유가 그대로 붙는다', () => {
    renderTable({ isLocked: true });

    expect(selectBox(3)).toHaveAccessibleDescription(t.reasons.lineQtyNotPositive);
  });

  /*
   * **판정을 받아서 쓴다**(C31 · 관찰 1의 이행). 표가 스스로 세면 「반품 처리」 버튼과 판정
   * 호출이 둘로 갈린다 — 받은 요약을 그대로 낸다.
   */
  it('요약과 사유가 받은 판정에서 나온다', () => {
    const rows = rowsFrom();

    renderTable({
      rows,
      selection: { ...describeReturnSelection(rows), count: 7, totalQty: 70, totalUomId: 9501 },
    });

    expect(screen.getByText(t.selection.summary(7, 70, UOM_LABEL))).toBeInTheDocument();
  });
});
