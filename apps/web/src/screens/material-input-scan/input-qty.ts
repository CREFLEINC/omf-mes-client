/**
 * 투입 수량 — **작업자가 치는 유일한 값**이다.
 *
 * 스펙 §4-B가 이 칸만 「입력」으로 두었다. 나머지는 스캔이 특정하거나 서버가 채운다.
 *
 * ⛔ **되돌릴 수 없는 값이다.** 투입은 정정이 아니라 새 기록으로만 고칠 수 있고(이력 불변
 * B-3), 계약에 정정 경로조차 아직 없다(스펙 §8 미결 9). 그래서 **보내기 전에 여기서 한 번
 * 더 잰다** — 버튼 잠금이 이미 닫아 둔 길이지만, 그것이 뚫려도 형식이 아닌 값이 원장에
 * 실리지 않아야 한다.
 *
 * ⚠ **단위 환산을 화면이 하지 않는다**(스펙 §5-6). 작업자가 친 값과 그 단위를 그대로 싣고,
 * 기준단위로 옮기는 것은 서버다(`mdm.item_uom_conversion`이 정본). 이 화면은 스캔한 LOT의
 * 단위로만 받으므로 친 값과 저장 값이 같다 — 그래서 `enteredQty`를 따로 싣지 않는다.
 */

/** 칸이 비어 있는 것과 0을 친 것은 다르다 — 앞은 아직 안 정한 것이고 뒤는 있을 수 없는 값이다. */
export type QtyDraft = string;

export type QtyProblem = 'empty' | 'format' | 'notPositive';

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

/**
 * 친 값을 잰다. 쓸 수 있으면 `null`.
 *
 * **음수 부호를 형식에서 막는다.** 계약이 `qty_t > 0`을 걸지만 그것은 서버의 검사이고,
 * 화면이 음수를 보내면 되돌릴 수 없는 쓰기가 한 번 왕복한다.
 */
export const validateQty = (draft: QtyDraft): QtyProblem | null => {
  const value = draft.trim();

  if (value === '') return 'empty';
  if (!DECIMAL_PATTERN.test(value)) return 'format';

  return Number(value) > 0 ? null : 'notPositive';
};

/**
 * 보낼 수 있는 수량으로 옮긴다. **잴 수 없으면 만들지 않는다**(`null`).
 *
 * 여기가 마지막 겹이다 — 이 함수를 지나지 않은 값은 본문에 실리지 않는다.
 */
export const toInputQty = (draft: QtyDraft): number | null =>
  validateQty(draft) === null ? Number(draft.trim()) : null;

/** 담긴 자재별 수량 초안. 키는 `lotId`다 — 번호가 아니라 식별자로 잡는다. */
export type QtyDrafts = Readonly<Record<number, QtyDraft>>;

export const EMPTY_QTY_DRAFTS: QtyDrafts = {};

/** 아직 치지 않은 줄은 빈 문자열로 읽는다 — 「없음」과 「빈 값」을 한 모양으로 다룬다. */
export const readQty = (drafts: QtyDrafts, lotId: number): QtyDraft => drafts[lotId] ?? '';

export const writeQty = (drafts: QtyDrafts, lotId: number, draft: QtyDraft): QtyDrafts => ({
  ...drafts,
  [lotId]: draft,
});

/** 자재를 뺄 때 그 줄의 수량도 함께 버린다 — 남겨 두면 같은 LOT을 다시 담을 때 되살아난다. */
export const dropQty = (drafts: QtyDrafts, lotId: number): QtyDrafts => {
  const { [lotId]: _dropped, ...rest } = drafts;

  return rest;
};
