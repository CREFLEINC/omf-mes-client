import { MAX_ISSUE_QUANTITY } from './types';

/**
 * 발행 수량을 판정한다.
 *
 * ⭐ **미발행 양품은 화면이 계산한다** — 양품 누계에서 이미 발번된 개체 건수를 뺀다(스펙 §6).
 * 서버가 내려 주는 값이 아니므로 이 계산이 틀리면 **화면은 정상으로 보이면서 값만 틀린다.**
 * 그래서 순수 함수로 떼어 두고 시험으로 못박는다.
 *
 * ⛔ **모르는 것을 0 으로 치지 않는다.** 진척을 받지 못했으면 양품 누계를 「모르는」 것이고,
 * 그때 0 으로 치면 「양품이 없다」는 **사실과 다른 안내**가 나간다(공유계약 F-6 와 같은 방향).
 */

/** 양품 누계를 모를 때의 표시 — 「0」과 구분한다. */
export const UNKNOWN_GOOD_QTY = null;

export interface UnissuedInput {
  /** 양품 누계. 모르면 `null` */
  goodQty: number | null;
  /** 이미 발번된 개체 건수. 모르면 `null` */
  issuedCount: number | null;
}

/**
 * 아직 인식표가 붙지 않은 양품 수. **둘 중 하나라도 모르면 모르는 것이다.**
 *
 * 음수는 0 으로 내린다 — 발번이 양품 누계를 앞지르는 것은 서버 쪽 사정이고, 화면이 그것을
 * 「-3 장 발행할 수 있다」로 그릴 수는 없다.
 */
export const unissuedGoodQty = ({ goodQty, issuedCount }: UnissuedInput): number | null => {
  if (goodQty === null || issuedCount === null) return null;

  return Math.max(0, goodQty - issuedCount);
};

/** 입력이 왜 막혔는가. 화면이 문구를 고르는 판별자다 — 문구 자체는 i18n 이 갖는다. */
export type QuantityRejection =
  'empty' | 'notANumber' | 'notPositive' | 'exceedsUnissued' | 'exceedsLimit' | 'unknownUnissued';

export type QuantityVerdict =
  { ok: true; quantity: number } | { ok: false; reason: QuantityRejection };

/**
 * 사람이 친 문자열을 발행 수량으로 판정한다.
 *
 * **문자열로 받는 이유** — 빈 칸과 `0` 을 가르고, 지우는 도중의 중간 상태를 숫자로 억지로
 * 바꾸지 않기 위해서다(전례 `P-05-01`).
 *
 * 판정 순서가 곧 사용자가 보는 사유의 우선순위다 — 상한을 넘긴 값은 「미발행 양품보다 많다」가
 * 아니라 **「한 번에 1000 개까지」**로 말해야 고칠 방법이 분명해진다.
 */
export const judgeQuantity = (raw: string, unissued: number | null): QuantityVerdict => {
  const trimmed = raw.trim();

  if (trimmed === '') return { ok: false, reason: 'empty' };

  /* 키패드가 숫자만 넣지만 손 입력·붙여넣기가 남는다 — 경계에서 한 번 더 막는다. */
  if (!/^\d+$/.test(trimmed)) return { ok: false, reason: 'notANumber' };

  const quantity = Number(trimmed);

  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    return { ok: false, reason: 'notPositive' };
  }

  if (quantity > MAX_ISSUE_QUANTITY) return { ok: false, reason: 'exceedsLimit' };

  /*
   * ⛔ **미발행 양품을 모르면 발행을 열지 않는다.** 상한을 모르는 채 대량 발번을 보내면
   * 되돌릴 수 없는 쓰기가 검증 없이 나간다.
   */
  if (unissued === null) return { ok: false, reason: 'unknownUnissued' };

  if (quantity > unissued) return { ok: false, reason: 'exceedsUnissued' };

  return { ok: true, quantity };
};
