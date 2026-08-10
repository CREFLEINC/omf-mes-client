import { parseQty, readDraftQty, type LineDrafts } from './line-draft';
import type { PoLineView } from './types';

/**
 * **정량분과 초과분을 가르는 유일한 자리.**
 *
 * 이 화면의 핵심 규칙이며, 표도 (뒤따르는 PR의) 요청 조립도 이 모듈의 결과를 받는다.
 * 두 곳에서 다시 계산하면 규칙이 갈려 **보이는 값과 보내는 값이 달라진다** —
 * 되돌릴 수 없는 쓰기라 그 어긋남은 잘못된 전표로 남는다.
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

/**
 * 한 줄이 화면에 보이는 모습 전부. **읽는 자리에서 파생한다** —
 * 표는 이 값을 그리기만 하고 잔량·한도·가르기를 다시 계산하지 않는다.
 */
export interface SplitLineView {
  line: PoLineView;
  /** 사용자가 친 그대로. 입력칸의 `value`가 된다 */
  qtyText: string;
  /** 형식 오류의 사유. 없으면 `null` — 빈 칸도 `null`이다(오류가 아니다) */
  qtyError: string | null;
  remainingQty: number;
  normalLimit: number;
  /** 수량으로 읽힐 때만 갈린다. 미입력·형식 오류면 `null`이며 그 줄은 계산에서 빠진다 */
  split: SplitQty | null;
}

/** 라인 목록과 초안을 한 벌의 표시값으로 옮긴다. 라인 순서를 바꾸지 않는다. */
export const toSplitLines = (
  lines: readonly PoLineView[],
  drafts: LineDrafts,
): SplitLineView[] =>
  lines.map((line) => {
    const qtyText = readDraftQty(drafts, line.purchaseOrderLineId);
    const parsed = parseQty(qtyText);

    return {
      line,
      qtyText,
      qtyError: parsed.kind === 'invalid' ? parsed.message : null,
      remainingQty: remainingQty(line.orderedQty, line.receivedQty),
      normalLimit: normalLimit(line.orderedQty, line.receivedQty, line.toleranceOverQty),
      /*
       * 잘못된 수량을 그대로 넘기면 `NaN`이 계산에 들어가 정량·초과가 둘 다 `NaN`이 되고,
       * 그 값이 요청 본문에까지 흘러간다.
       */
      split:
        parsed.kind === 'qty'
          ? splitLineQty({
              arrivedQty: parsed.value,
              orderedQty: line.orderedQty,
              receivedQty: line.receivedQty,
              toleranceOverQty: line.toleranceOverQty,
            })
          : null,
    };
  });
