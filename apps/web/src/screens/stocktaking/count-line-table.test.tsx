import type { Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  buildCountLineColumns,
  CountLineTable,
  type CountLineColumnsInput,
  type CountLineTableProps,
} from './count-line-table';
import { blindCountLineResponse, countLineFixtures } from './fixtures';
import { EMPTY_LINE_DRAFTS, setDraftQty, type LineDrafts } from './line-draft';
import { toLineRows, type LineRowView } from './line-replace-request';
import type { ReferenceSource } from './lookups';
import { toCountLineView, type SelectOption } from './types';

const t = messages.stocktaking;

/** `.wide-table`이 표에 주는 최소 폭(58rem). */
const WIDE_TABLE_MIN_PX = 928;

/** 「코드 · 이름」이 한 줄에 들어가는 폭(`docs/layout-conventions.md`의 선례 값). */
const CODE_NAME_COLUMN_PX = 184;

const REASON_OPTIONS: SelectOption[] = [
  { value: 'SAMPLE_VARIANCE_REASON_D', label: 'SAMPLE_VARIANCE_REASON_D' },
];

const toPx = (width: string | undefined): number =>
  width === undefined ? 0 : Number.parseInt(width, 10);

const specifiedWidthOf = (columns: Column<LineRowView>[]): number =>
  columns.reduce((sum, column) => sum + toPx(column.width), 0);

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

const itemLookup = source([
  { value: '9301', label: 'SAMPLE-ITEM-01 · 합성 품목 가', isActive: true },
  { value: '9302', label: 'SAMPLE-ITEM-02 · 합성 품목 나', isActive: true },
]);

const uomLookup = source([
  { value: '9501', label: 'SAMPLE-EA', isActive: true },
  { value: '9502', label: 'SAMPLE-BOX', isActive: true },
]);

const lotLookup = source([{ value: '9601', label: 'LOT-2026-900010', isActive: true }]);

const lines = countLineFixtures.map(toCountLineView);

const rowsOf = (drafts: LineDrafts = EMPTY_LINE_DRAFTS): LineRowView[] => toLineRows(lines, drafts);

const columnsWith = (overrides: Partial<CountLineColumnsInput> = {}): Column<LineRowView>[] =>
  buildCountLineColumns({
    isBlind: false,
    itemLookup,
    uomLookup,
    lotLookup,
    reasonOptions: REASON_OPTIONS,
    isLocked: false,
    onChangeQty: () => undefined,
    onChangeReason: () => undefined,
    ...overrides,
  });

const renderTable = (overrides: Partial<CountLineTableProps> = {}) => {
  const onChangeQty = vi.fn<(inventoryCountLineId: number, text: string) => void>();
  const onChangeReason = vi.fn<(inventoryCountLineId: number, code: string) => void>();
  const onRetryReferences = vi.fn<() => void>();

  const rendered = render(
    <CountLineTable
      rows={rowsOf()}
      isLoading={false}
      isTruncated={false}
      isBlind={false}
      itemLookup={itemLookup}
      uomLookup={uomLookup}
      lotLookup={lotLookup}
      reasonOptions={REASON_OPTIONS}
      isLocked={false}
      onChangeQty={onChangeQty}
      onChangeReason={onChangeReason}
      onRetryReferences={onRetryReferences}
      {...overrides}
    />,
  );

  return { ...rendered, onChangeQty, onChangeReason, onRetryReferences, user: userEvent.setup() };
};

const qtyField = (lineNo: number): HTMLElement =>
  screen.getByLabelText(t.lineTable.countedQtyLabel(lineNo));

describe('buildCountLineColumns — 열 구성과 폭', () => {
  it('비블라인드에서 열이 일곱이다', () => {
    expect(columnsWith().map((column) => column.key)).toEqual([
      'lineNo',
      'item',
      'lot',
      'systemQty',
      'countedQty',
      'variance',
      'reason',
    ]);
  });

  /*
   * **감지기 M30 · 완료 조건 C42** — 블라인드에서 장부와 차이가 **함께** 사라진다.
   * 차이만 보여도 **실물 − 차이 = 장부**로 역산되어 블라인드가 무의미해진다.
   * 한쪽만 감추면 이 단언이 죽는다.
   */
  it('블라인드에서는 장부 수량 열과 차이 열이 함께 없다', () => {
    const keys = columnsWith({ isBlind: true }).map((column) => column.key);

    expect(keys).not.toContain('systemQty');
    expect(keys).not.toContain('variance');
    /* 짝 방향 — 나머지 다섯은 그대로 있다(열이 통째로 사라져서 통과하는 것이 아니다). */
    expect(keys).toEqual(['lineNo', 'item', 'lot', 'countedQty', 'reason']);
  });

  /*
   * **감지기 M39** — 흡수 열이 둘이 되면 남는 폭이 나뉘어 「코드 · 이름」이 낱말 단위로
   * 쪼개진다. 하나도 없으면 표가 하한보다 좁아져 고정 배치가 남는 폭을 제멋대로 나눈다.
   */
  it.each<[string, boolean]>([
    ['비블라인드', false],
    ['블라인드', true],
  ])('%s에서 폭을 지정하지 않은 흡수 열이 정확히 하나다', (_label, isBlind) => {
    const absorbing = columnsWith({ isBlind }).filter((column) => column.width === undefined);

    expect(absorbing).toHaveLength(1);
    expect(absorbing[0]?.key).toBe('item');
  });

  it.each<[string, boolean]>([
    ['비블라인드', false],
    ['블라인드', true],
  ])('%s에서 지정 폭 합에 흡수 열 예산을 더해도 표 하한 안이다', (_label, isBlind) => {
    expect(specifiedWidthOf(columnsWith({ isBlind })) + CODE_NAME_COLUMN_PX).toBeLessThanOrEqual(
      WIDE_TABLE_MIN_PX,
    );
  });

  it('흡수 열이 실제로 받는 폭이 예산보다 좁지 않다', () => {
    expect(WIDE_TABLE_MIN_PX - specifiedWidthOf(columnsWith())).toBeGreaterThanOrEqual(
      CODE_NAME_COLUMN_PX,
    );
  });

  /** 계약의 라인 조회에 `sort` 쿼리가 없다(실측 — 어긋남 3). 목록 표와 같은 규칙이다. */
  it('어느 열도 정렬을 열지 않는다', () => {
    expect(columnsWith().every((column) => column.sortable !== true)).toBe(true);
  });
});

describe('CountLineTable — 값 표기', () => {
  it('줄마다 품목 이름이 참조로 풀린다', () => {
    renderTable();

    expect(screen.getByText('SAMPLE-ITEM-01 · 합성 품목 가')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE-ITEM-02 · 합성 품목 나')).toBeInTheDocument();
  });

  /*
   * **#47** — 참조 목록에 없는 값은 「알 수 없음」이고, 아직 오지 않은 것과 다르다.
   * 짝 방향으로 풀린 이름이 함께 있어야 「아무것도 안 그려서 통과」가 아니다.
   *
   * 셋째 줄이 **연쇄를 그대로 담는다** — 품목(9303)이 참조 목록에 없어 그 품목의 LOT(9602)도
   * 받지 못한다. 그래서 「알 수 없음」이 그 줄에 **둘** 선다.
   */
  it('참조 목록에 없는 품목과 LOT이 알 수 없음으로 갈린다', () => {
    renderTable();

    expect(screen.getByText('SAMPLE-ITEM-01 · 합성 품목 가')).toBeInTheDocument();
    expect(screen.getAllByText(t.values.unknown)).toHaveLength(2);
  });

  it('참조가 아직 오지 않았으면 알 수 없음과 다른 문구를 낸다', () => {
    renderTable({
      itemLookup: source([], { isLoading: true }),
      lotLookup: source([], { isLoading: true }),
    });

    expect(screen.getAllByText(t.values.referenceLoading).length).toBeGreaterThan(0);
    expect(screen.queryByText(t.values.unknown)).not.toBeInTheDocument();
  });

  /*
   * **`lotId`가 `null`인 것은 빈 값이지 참조 실패가 아니다**(W-01-10 전례).
   * 「알 수 없음」으로 내면 *값이 잘못됐다*는 뜻이 되어 사용자가 반대로 읽는다.
   */
  it('자재 LOT이 없는 줄은 빈 값 표기를 낸다', () => {
    renderTable();

    expect(screen.getByText('LOT-2026-900010')).toBeInTheDocument();
    expect(screen.getByText(t.values.empty)).toBeInTheDocument();
  });

  /** 단위 열을 따로 두지 않고 **수량 표기에 붙인다**(W-01-03이 세운 처리). */
  it('장부 수량에 단위가 붙는다', () => {
    renderTable();

    expect(screen.getByText(t.lineTable.qtyWithUom('100', 'SAMPLE-EA'))).toBeInTheDocument();
    expect(screen.getByText(t.lineTable.qtyWithUom('7', 'SAMPLE-BOX'))).toBeInTheDocument();
  });

  /*
   * **감지기 M43 · 완료 조건 C43** — 표 어디에도 내부 번호·카운트 시각이 없다.
   * 카운트 시각은 화면 타입에 자리조차 없고(계획 결정 9) 내부 번호는 참조로 풀린다(#44).
   */
  it('내부 번호와 카운트 시각을 내지 않는다', () => {
    const { container } = renderTable();
    const text = container.textContent ?? '';

    /* 짝 방향 — 표는 실제로 그려졌다. */
    expect(screen.getByText('SAMPLE-ITEM-01 · 합성 품목 가')).toBeInTheDocument();

    for (const internalId of ['9401', '9402', '9403', '9701', '9301', '9302', '9501', '9601']) {
      expect(text).not.toContain(internalId);
    }

    expect(text).not.toContain('2026-08-06T09:12');
  });

  /*
   * **감지기 M34** — 빈 상태를 표의 `empty`가 맡는다. 바깥에서 0건을 갈라 다른 것을 그리면
   * `empty`가 닿을 수 없는 죽은 가지가 된다(W-01-07 Minor의 형태).
   */
  it('줄이 0건이면 표의 빈 상태가 보인다', () => {
    renderTable({ rows: [] });

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(t.empty.noLinesTitle)).toBeInTheDocument();
  });
});

describe('CountLineTable — 표 안 입력 두 칸', () => {
  /*
   * **완료 조건 C35** — 실물 수량 칸이 **빈 칸으로 시작한다.** 짝 방향으로 서버가 준 값이
   * 실제로 있다는 것을 함께 센다 — 없어서 비어 보이는 것이 아니다.
   */
  it('실물 수량 칸이 빈 칸으로 시작한다', () => {
    renderTable();

    expect(lines[0]?.countedQty).toBe(98);
    expect(qtyField(1)).toHaveValue('');
    expect(qtyField(2)).toHaveValue('');
    expect(qtyField(3)).toHaveValue('');
  });

  it('친 글자를 줄 번호와 함께 알린다', async () => {
    const { onChangeQty, user } = renderTable();

    await user.type(qtyField(2), '4');

    expect(onChangeQty).toHaveBeenCalledWith(9402, '4');
  });

  it('친 글자를 그대로 보인다', () => {
    renderTable({ rows: rowsOf(setDraftQty(EMPTY_LINE_DRAFTS, 9401, '0.')) });

    expect(qtyField(1)).toHaveValue('0.');
  });

  it('형식이 잘못된 줄에 인라인 오류가 붙는다', () => {
    renderTable({ rows: rowsOf(setDraftQty(EMPTY_LINE_DRAFTS, 9401, '-1')) });

    expect(screen.getByText(t.errors.qtyNegative)).toBeInTheDocument();
  });

  /** **0은 오류가 아니다**(완료 조건 C37) — 계약이 `minimum: 0`이라 정상 값이다. */
  it('0을 넣어도 오류가 붙지 않는다', () => {
    renderTable({ rows: rowsOf(setDraftQty(EMPTY_LINE_DRAFTS, 9401, '0')) });

    expect(screen.queryByText(t.errors.qtyNegative)).not.toBeInTheDocument();
    expect(screen.queryByText(t.errors.qtyNotNumber)).not.toBeInTheDocument();
  });

  it('차이 사유를 줄 번호와 함께 알린다', async () => {
    const { onChangeReason, user } = renderTable();

    await user.click(screen.getByLabelText(t.lineTable.reasonLabel(1)));
    await user.click(screen.getByRole('option', { name: 'SAMPLE_VARIANCE_REASON_D' }));

    expect(onChangeReason).toHaveBeenCalledWith(9401, 'SAMPLE_VARIANCE_REASON_D');
  });

  /*
   * **값 목록이 확정되지 않은 동안에도 칸은 선다**(승인 G1). 칸을 감추면 무엇을 못 하는지
   * 화면이 말하지 못한다 — 자리표시와 안내가 그 사정을 밝힌다.
   */
  it('사유 선택지가 비어 있으면 자리표시와 안내가 붙는다', () => {
    renderTable({ reasonOptions: [] });

    expect(screen.getAllByText(messages.pendingCode.note).length).toBeGreaterThan(0);
  });

  /*
   * **감지기 M41의 첫째 겹** — 전송 중에는 표 안 두 칸이 잠긴다. 열어 두면 나가는 중인
   * 요청의 값과 화면의 값이 갈린다.
   */
  it('전송 중에는 표 안 두 칸이 잠긴다', () => {
    renderTable({ isLocked: true });

    expect(qtyField(1)).toBeDisabled();
    expect(screen.getByLabelText(t.lineTable.reasonLabel(1))).toBeDisabled();
  });
});

describe('CountLineTable — 차이 칸', () => {
  /*
   * **감지기 M45 · 완료 조건 C41** — 화면이 차이를 계산하지 않는다.
   * 장부 100 · 저장된 실물 98 · 서버가 준 차이 −2인 줄에 50을 치면, 화면이 계산했을 때
   * 나올 −50이 **어디에도 없어야 한다.**
   */
  it('실물을 고쳐도 차이 칸은 서버가 준 값 그대로다', () => {
    const { container } = renderTable({ rows: rowsOf(setDraftQty(EMPTY_LINE_DRAFTS, 9401, '50')) });

    expect(screen.getByText('-2')).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('-50');
  });

  /** 대신 **낡았다는 사실만** 밝힌다 — 계산하지 않으면서도 낡은 값을 그대로 두지 않는 형태다. */
  it('친 값이 저장된 실물과 다르면 낡음 표식이 붙는다', () => {
    renderTable({ rows: rowsOf(setDraftQty(EMPTY_LINE_DRAFTS, 9401, '50')) });

    expect(screen.getAllByText(t.lineTable.varianceStale)).toHaveLength(1);
  });

  it('아직 치지 않은 줄에는 낡음 표식이 없다', () => {
    renderTable();

    expect(screen.queryByText(t.lineTable.varianceStale)).not.toBeInTheDocument();
  });

  /*
   * **계약이 필수라고 말해도 런타임에 없을 수 있다**(계획 결정 4 · 어긋남 1).
   * 비블라인드인데 수량이 오지 않은 어긋남에서 `undefined`가 수량 자리에 그려지지 않아야 한다.
   */
  it('수량이 오지 않은 줄은 그 사정을 밝힌다', () => {
    const missing = [toCountLineView(blindCountLineResponse())];

    renderTable({ rows: toLineRows(missing, EMPTY_LINE_DRAFTS) });

    expect(screen.getAllByText(t.values.qtyNotProvided)).toHaveLength(2);
  });
});

describe('CountLineTable — 안내와 복구', () => {
  /*
   * **계획 결정 15** — 저장 확인 창을 두지 않는 대신 **치환의 뜻을 표 위에서 늘 밝힌다.**
   * 파괴 경로는 전 줄 필수와 잘림 차단이 구조로 막으므로 창이 지킬 것이 없다.
   */
  it('치환 의미론과 빈 칸 시작 안내가 늘 보인다', () => {
    renderTable();

    expect(screen.getByText(t.notes.replaceSemantics)).toBeInTheDocument();
    expect(screen.getByText(t.notes.countedQtyEmptyStart)).toBeInTheDocument();
  });

  /*
   * **감지기 M31 · 완료 조건 C34** — 잘리면 표식이 보인다. 표식과 저장 차단 사유가
   * 같은 사실을 두 자리에서 말하고, 잘리지 않았을 때는 어느 쪽도 나오지 않는다.
   */
  it('잘리면 표식이 보이고 잘리지 않으면 없다', () => {
    const { unmount } = renderTable({ isTruncated: true });

    expect(screen.getByText(t.reasons.linesTruncated)).toBeInTheDocument();

    unmount();
    renderTable();

    expect(screen.queryByText(t.reasons.linesTruncated)).not.toBeInTheDocument();
  });

  it('참조가 하나라도 실패하면 사유와 다시 시도가 함께 선다', async () => {
    const { onRetryReferences, user } = renderTable({
      lotLookup: source([], { isError: true }),
    });

    expect(screen.getByText(t.reasons.lineReferencesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  it('불러오는 중에는 표 대신 진행 표시를 낸다', () => {
    renderTable({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.lines })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
