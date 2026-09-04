/**
 * 투입 수량 — **작업자가 치는 유일한 값**이다.
 *
 * 스펙 §4-A 가 「(그 밖) `P-02-03` §4-B 와 동일」로 두었고, 그 절이 이 칸만 「입력」으로
 * 두었다. 나머지는 스캔이 특정하거나 서버가 채운다.
 *
 * ⛔ **되돌릴 수 없는 값이다.** 교체는 이전 투입을 지우지 않고 잇는 것이라(§5-2) 잘못 친
 * 수량도 원장에 그대로 남는다. 그래서 **보내기 전에 여기서 한 번 더 잰다** — 버튼 잠금이
 * 이미 닫아 둔 길이지만, 그것이 뚫려도 형식이 아닌 값이 원장에 실리지 않아야 한다.
 *
 * ⚠ **단위 환산을 화면이 하지 않는다.** 스캔한 LOT 의 단위로만 받으므로 친 값과 저장 값이
 * 같다 — 그래서 `enteredQty`를 따로 싣지 않는다.
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
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
