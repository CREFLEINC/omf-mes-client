import { messages } from '@omf-mes/i18n';

import { parseQty, readDraft, type LineDrafts, type LotDraft } from './line-draft';
import { lotDraftError } from './lot-format';
import type { PoLineView } from './types';

/**
 * **정량분과 초과분을 가르는 유일한 자리.**
 *
 * 이 화면의 핵심 규칙이며, 표도 요청 조립도 이 모듈의 결과를 받는다. 두 곳에서 다시 계산하면
 * 규칙이 갈려 **보이는 값과 보내는 값이 달라진다** — 되돌릴 수 없는 쓰기라 그 어긋남은
 * 잘못된 전표로 남는다.
 *
 * | 규칙 | 값 |
 * | --- | --- |
 * | 잔량 | `max(발주 − 누적 입하, 0)` — 누적 입하가 발주를 이미 넘긴 발주가 실제로 온다 |
 * | 정량 한도 | `잔량 + 초과 허용치` |
 * | 정량분 | `min(도착 수량, 정량 한도)` |
 * | 초과분 | `도착 수량 − 정량분` |
 * | 경계 | **한도와 같으면 정량**이다. 계약이 「이 값을 **넘으면**」이라고 썼다 |
 *
 * **합계를 누적하지 않는다.** 수량은 소수를 가질 수 있어(계약이 `number`다) 여러 라인의
 * 덧셈을 쌓으면 부동소수 오차가 요청 본문에 실린다. 여기서 만드는 값은 라인마다 둘뿐이고,
 * 전부 비교와 뺄셈 한 번으로 나온다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.overReceiptSplit;

/** 발주의 이 배수를 넘는 도착은 자릿수 실수일 가능성이 크다 — 막지 않고 한 번 더 보게 한다. */
export const FAR_OVER_ORDERED_TIMES = 2;

/** 아직 받을 것이 남은 수량. 누적 입하가 발주를 넘겼으면 더 받을 「정량」이 없다는 뜻으로 0이다. */
export const remainingQty = (orderedQty: number, receivedQty: number): number =>
  Math.max(orderedQty - receivedQty, 0);

/** 여기까지는 정량분이다. 이 값을 **넘는** 몫이 초과분이 된다. */
export const normalLimit = (
  orderedQty: number,
  receivedQty: number,
  toleranceOverQty: number,
): number => remainingQty(orderedQty, receivedQty) + toleranceOverQty;

export interface SplitQtyInput {
  arrivedQty: number;
  orderedQty: number;
  receivedQty: number;
  toleranceOverQty: number;
}

export interface SplitQty {
  normalQty: number;
  excessQty: number;
}

export const splitLineQty = (input: SplitQtyInput): SplitQty => {
  const limit = normalLimit(input.orderedQty, input.receivedQty, input.toleranceOverQty);
  const normalQty = Math.min(input.arrivedQty, limit);

  return { normalQty, excessQty: input.arrivedQty - normalQty };
};

export interface SplitLineView {
  line: PoLineView;
  qtyText: string;
  qtyError: string | null;
  /** 막지 않는 안내 — 발주의 몇 배가 왔다 등. */
  qtyWarning: string | null;
  remainingQty: number;
  normalLimit: number;
  /** 수량이 없거나 잘못됐으면 `null` — 가를 것이 없다. */
  split: SplitQty | null;
  lot: LotDraft;
  excessLot: LotDraft;
  /** 정량분이 실릴 때만 잰다. 실리지 않는 쪽의 LOT 칸은 비어 있어도 잘못이 아니다. */
  lotError: string | null;
  excessLotError: string | null;
}

/** 품목 번호 → 품목코드. 아직 못 받았으면 `null` — 그때는 라벨의 품목코드 일치를 묻지 않는다. */
export type ItemCodeResolver = (itemId: number) => string | null;

const NO_ITEM_CODES: ItemCodeResolver = () => null;

const warningOf = (arrivedQty: number, orderedQty: number): string | null => {
  if (orderedQty <= 0 || arrivedQty <= orderedQty * FAR_OVER_ORDERED_TIMES) return null;

  const times = arrivedQty / orderedQty;

  return t.warnings.qtyFarOverOrdered(Number.isInteger(times) ? String(times) : times.toFixed(1));
};

/**
 * 라인과 초안을 **읽는 자리에서** 파생한다. 표와 요청 조립이 같은 결과를 받는다.
 *
 * LOT 오류는 **그 쪽이 실릴 때만** 센다 — 정량분 0 인 줄의 정량분 LOT 이 비어 있는 것은 잘못이 아니다.
 * 같은 LOT 번호가 양쪽에 있으면 초과분 쪽에 사유를 붙인다(서버가 초과분 `supplierLotNo` 를 짚는다).
 */
export const toSplitLines = (
  lines: readonly PoLineView[],
  drafts: LineDrafts,
  itemCodeOf: ItemCodeResolver = NO_ITEM_CODES,
): SplitLineView[] =>
  lines.map((line) => {
    const draft = readDraft(drafts, line.purchaseOrderLineId);
    const parsed = parseQty(draft.qtyText);
    const split =
      parsed.kind === 'qty'
        ? splitLineQty({
            arrivedQty: parsed.value,
            orderedQty: line.orderedQty,
            receivedQty: line.receivedQty,
            toleranceOverQty: line.toleranceOverQty,
          })
        : null;
    const itemCode = itemCodeOf(line.itemId);

    const lotError =
      split !== null && split.normalQty > 0 ? lotDraftError(draft.lot, itemCode) : null;
    let excessLotError =
      split !== null && split.excessQty > 0 ? lotDraftError(draft.excessLot, itemCode) : null;
    if (
      excessLotError === null &&
      split !== null &&
      split.normalQty > 0 &&
      split.excessQty > 0 &&
      draft.lot.lotNo.trim() !== '' &&
      draft.lot.lotNo.trim() === draft.excessLot.lotNo.trim()
    ) {
      excessLotError = t.errors.lotDuplicate;
    }

    return {
      line,
      qtyText: draft.qtyText,
      qtyError: parsed.kind === 'invalid' ? parsed.message : null,
      qtyWarning: parsed.kind === 'qty' ? warningOf(parsed.value, line.orderedQty) : null,
      remainingQty: remainingQty(line.orderedQty, line.receivedQty),
      normalLimit: normalLimit(line.orderedQty, line.receivedQty, line.toleranceOverQty),
      split,
      lot: draft.lot,
      excessLot: draft.excessLot,
      lotError,
      excessLotError,
    };
  });

/** 수량·LOT 중 고치지 않은 사유가 하나라도 붙어 있는가. 등록을 막는 조건이다. */
export const hasLineError = (rows: readonly SplitLineView[]): boolean =>
  rows.some((row) => row.qtyError !== null || row.lotError !== null || row.excessLotError !== null);
