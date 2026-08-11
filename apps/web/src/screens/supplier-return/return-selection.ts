import { messages } from '@omf-mes/i18n';

import {
  isLineSelected,
  parseReturnQty,
  readDraftQty,
  type LineDraft,
  type QtyParse,
} from './line-draft';
import { describeLineSelect, type LineSelectState } from './line-select';
import { checkQtyLimit, toOnHand, type BalanceSource, type OnHand } from './on-hand';
import type { ReceiptLineView } from './types';

/**
 * 줄마다의 판정을 한 번에 만들고, **「다음 단계로 갈 수 있는가」를 한 곳에서 낸다**
 * (완료 조건 C29·C31·C33).
 *
 * 표가 「고를 수 있다」를 자기대로 판정하고 버튼이 「보낼 수 있다」를 또 자기대로 판정하면
 * 둘이 갈린다 — 표에는 멀쩡한데 버튼이 잠겨 있거나, 반대로 잠겼어야 할 것이 열린다.
 * **되돌릴 수 없는 쓰기**라 뒤쪽 어긋남은 잘못된 반품 전표로 남는다.
 *
 * 그래서 부품은 **판정하지 않고 받는다.** 표는 `ReturnLineRow`를 그대로 그리고, 사유·요약도
 * 여기서 나온 문장을 낸다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.supplierReturn;

/** 표 한 줄이 그리는 데 필요한 것 전부. **부품이 다시 계산할 것이 남지 않게 한다.** */
export interface ReturnLineRow {
  line: ReceiptLineView;
  /**
   * 표시 순번(1부터). 표 안 컨트롤의 접근 이름과 사유 `id`가 쓴다.
   *
   * **내부 번호를 쓰지 않는다**(#44) — `id` 속성은 화면 글자가 아니지만 DOM에 남고, 한 번
   * 쓰기 시작하면 접근 이름으로도 새기 쉽다. 이 표에는 줄번호 열이 없고(계획 §5.5) 품목·LOT은
   * 아직 이름이 안 풀렸거나 줄끼리 겹칠 수 있어 줄을 가르지 못한다.
   */
  ordinal: number;
  /** 이 줄을 고를 수 있는가와 못 고르는 사유(`line-select.ts` 한 곳에서 온다). */
  select: LineSelectState;
  /** **고를 수 있으면서 초안에 들어 있는** 줄만 골라진 것으로 본다. */
  isSelected: boolean;
  qtyText: string;
  qty: QtyParse;
  onHand: OnHand;
  /**
   * 그 칸 아래 서는 인라인 오류. **형식 오류가 상한 초과보다 앞선다** — 숫자가 아닌데
   * 「보유 수량보다 많다」를 내면 사용자가 수량을 줄여 보다가 왜 안 되는지 모른다.
   */
  error: string | undefined;
}

/**
 * 라인 응답과 초안·잔액을 합쳐 표가 그릴 줄을 만든다.
 *
 * **지금 표에 있는 줄만 만든다**(계획 결정 8). 초안에 남아 있어도 사라진 줄은 여기 나타나지
 * 않으므로 요약에도 요청에도 실리지 않는다 — 「다시 조회」가 초안을 지우지 않아도 되는 이유다.
 */
export const toReturnLineRows = (
  lines: readonly ReceiptLineView[],
  draft: LineDraft,
  balances: BalanceSource,
): ReturnLineRow[] =>
  lines.map((line, index) => {
    const select = describeLineSelect(line);
    const qtyText = readDraftQty(draft, line.goodsReceiptLineId);
    const qty = parseReturnQty(qtyText);
    const onHand = toOnHand(balances, line);

    return {
      line,
      ordinal: index + 1,
      select,
      /*
       * **고를 수 없게 된 줄은 골라져 있지 않은 것으로 본다.** 「다시 조회」로 라인이 바뀌어
       * 고른 줄이 잠기면, 그대로 두었을 때 표에는 **잠긴 줄이 골라져 있는** 상태가 되고
       * 그 줄이 요청에 실린다.
       */
      isSelected: select.kind === 'selectable' && isLineSelected(draft, line.goodsReceiptLineId),
      qtyText,
      qty,
      onHand,
      error: toLineError(qty, onHand),
    };
  });

const toLineError = (qty: QtyParse, onHand: OnHand): string | undefined => {
  if (qty.kind === 'invalid') return qty.message;
  if (qty.kind === 'empty') return undefined;

  const limit = checkQtyLimit(qty.value, onHand);

  return limit.kind === 'over' ? limit.message : undefined;
};

/**
 * 다음 단계로 갈 수 있는가. **막힌 쪽은 사유를 함께 낸다** — 사유 없이 잠그면 사용자가
 * 무엇을 해야 풀리는지 화면에서 읽을 수 없다(배치 규범 4).
 */
export type ReturnReadyState = { kind: 'ready' } | { kind: 'blocked'; reason: string };

export interface ReturnSelectionView {
  /** 실제로 보낼 줄. **요약도 요청도 이 배열에서 나온다.** */
  selectedRows: ReturnLineRow[];
  count: number;
  /**
   * 고른 줄의 반품 수량 합. **단위가 섞이면 `null`이다** — 100 개와 5 상자를 더한 105는
   * 어떤 뜻도 없고, 화면이 확인하지 않은 것을 말하는 것이 된다.
   */
  totalQty: number | null;
  totalUomId: number | null;
  ready: ReturnReadyState;
}

/**
 * 고른 줄을 세고 보낼 수 있는지 판정한다.
 *
 * 사유 순서가 뜻을 정한다 — **아무것도 안 골랐다 → 빈 칸 → 오류.** 빈 칸이 오류보다 앞서는
 * 이유는 오류가 이미 그 칸 아래에 붉은 글씨로 서 있는 반면, **빈 칸은 멀쩡해 보이기** 때문이다.
 */
export const describeReturnSelection = (
  rows: readonly ReturnLineRow[],
): ReturnSelectionView => {
  const selectedRows = rows.filter((row) => row.isSelected);
  const uomIds = new Set(selectedRows.map((row) => row.line.uomId));
  const hasSingleUom = uomIds.size === 1;
  const [totalUomId] = [...uomIds];

  return {
    selectedRows,
    count: selectedRows.length,
    totalQty: hasSingleUom ? sumQty(selectedRows) : null,
    totalUomId: hasSingleUom ? (totalUomId ?? null) : null,
    ready: judge(selectedRows),
  };
};

/** 읽을 수 있는 수량만 더한다 — 빈 칸·오류인 줄은 보낼 수 없고 그 사정은 사유가 말한다. */
const sumQty = (rows: readonly ReturnLineRow[]): number =>
  rows.reduce((sum, row) => (row.qty.kind === 'qty' ? sum + row.qty.value : sum), 0);

const judge = (selectedRows: readonly ReturnLineRow[]): ReturnReadyState => {
  if (selectedRows.length === 0) return { kind: 'blocked', reason: t.reasons.selectNone };
  if (selectedRows.some((row) => row.qty.kind === 'empty')) {
    return { kind: 'blocked', reason: t.reasons.selectQtyMissing };
  }
  if (selectedRows.some((row) => row.error !== undefined)) {
    return { kind: 'blocked', reason: t.reasons.selectQtyInvalid };
  }

  return { kind: 'ready' };
};
