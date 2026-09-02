import { elapsedOf } from './elapsed';
import type { ShipmentRow } from './types';

/**
 * 다중 선택 규칙.
 *
 * ⚠ **일괄에서 빼는 것과 «못 하게 막는 것»은 다르다**(§6). 3일 경과 건은 함께 확정하지 않지만
 * **개별로는 확정할 수 있다** — 위험한 것을 한 번에 쓸어 담지 않게 하는 것이 목적이지 손을
 * 묶는 것이 아니다.
 */

/**
 * 이 건을 «일괄» 확정에 담을 수 있는가.
 *
 * ⭐ 취소 결재 중 건도 빼야 하지만(§5-5) 결재 대상 유형·승인 상태의 코드 값이 아직 정해지지
 * 않아(G-2) 화면이 판정하지 못한다. **그 물러난 수준을 화면이 적고**, 실제 차단은 서버가 한다
 * (`:confirm` 이 409 `CANCEL_IN_PROGRESS` 로 막는다). 값이 정해지면 이 함수에 갈래가 하나
 * 늘어난다.
 */
export const isBatchExcluded = (row: ShipmentRow, now: Date): boolean =>
  elapsedOf(row, now).level === 'critical';

/** 「모두 선택」이 담는 것 — 일괄에 담을 수 있는 건만이다. */
export const batchSelectableIds = (rows: readonly ShipmentRow[], now: Date): number[] =>
  rows.filter((row) => !isBatchExcluded(row, now)).map((row) => row.shipmentId);

/**
 * 고른 것 중 실제로 목록에 남아 있는 것만.
 *
 * ⚠ 조회를 다시 하면 고른 건이 사라질 수 있다(다른 사람이 확정했거나 자동 확정이 돌았다) —
 * 남은 것만 들고 가지 않으면 **없는 건을 확정하러 간다.**
 */
export const retainSelection = (
  selected: readonly number[],
  rows: readonly ShipmentRow[],
): number[] => {
  const present = new Set(rows.map((row) => row.shipmentId));
  return selected.filter((id) => present.has(id));
};

/** 고른 건들. 목록 순서를 그대로 따른다 — 확인 창이 보이는 차례가 목록과 같아야 한다. */
export const selectedRows = (
  rows: readonly ShipmentRow[],
  selected: readonly number[],
): ShipmentRow[] => {
  const chosen = new Set(selected);
  return rows.filter((row) => chosen.has(row.shipmentId));
};
