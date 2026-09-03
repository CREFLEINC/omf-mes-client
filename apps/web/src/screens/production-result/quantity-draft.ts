import type { ResultDraft, WorkOrder } from './types';

/**
 * 양품수량 입력의 규칙 — **키패드 버퍼에서 보낼 수량까지.**
 *
 * 이 화면이 받는 수량은 하나뿐이다(R50 — 불량은 생산불량LOT 으로 갈라진다). 그래서 검증도
 * 셋으로 끝난다: **비었나 · 0 인가 · 잔여를 넘었나.** 앞 둘은 저장을 막고, **마지막은 막지
 * 않는다** — 초과 생산은 허용이고 화면이 할 일은 확인을 한 번 받는 것이다(스펙 §6).
 */

/** 키패드 버퍼 최대 길이. 계약이 `numeric(20,6)` 이라 자릿수를 넘겨 치는 것은 오타다. */
export const GOOD_QTY_MAX_LENGTH = 12;

/** 빠른 입력 버튼의 증분. 스펙 §5-1 이 두 값을 적었다. */
export const QUICK_ADD_STEPS = [10, 100] as const;

/**
 * 버퍼를 보낼 수량으로. **보낼 수 없으면 `null`.**
 *
 * ⛔ `Number('')` 은 `0` 이다 — 빈 입력을 0 으로 접으면 「아무것도 안 친 상태」와 「0 을 친
 * 상태」가 같아진다. 둘 다 저장을 막지만, 화면이 말할 사유가 다르다.
 */
export const parseGoodQty = (buffer: string): number | null => {
  if (buffer === '') return null;

  const value = Number(buffer);

  return Number.isFinite(value) ? value : null;
};

/**
 * 빠른 입력 — 지금 버퍼에 증분을 더한 **새 버퍼**.
 *
 * ⚠ 버퍼는 문자열이라 이어 붙이면 `12` + `10` 이 `1210` 이 된다. 더한 값을 다시 문자열로
 * 만든다. 자릿수 상한을 넘기는 결과는 **무시한다** — 키패드가 그렇게 동작하므로 같은 규칙이다.
 */
export const addQuickStep = (buffer: string, step: number): string => {
  const next = String((parseGoodQty(buffer) ?? 0) + step);

  return next.length > GOOD_QTY_MAX_LENGTH ? buffer : next;
};

/**
 * 이 작업지시의 **잔여수량**. 모르면 `null`.
 *
 * ⭐ **서버가 낸 `varianceQty` 를 먼저 쓴다** — 「지시 수량 − 양품 합계」를 서버가 그렇게
 * 정의해 내려 준다. 그 값이 비어 있을 때만 지시 수량과 양품 누계로 같은 식을 세운다.
 *
 * ⛔ **달성률·마감 판정을 화면이 계산하지 않는다**(계약 명시). 여기서 만드는 것은 잔여 하나다.
 * ⚠ `progress` 자체가 없으면(`withProgress` 를 켜지 않은 응답) **모르는 것**이지 0 이 아니다.
 */
export const remainingQty = (workOrder: WorkOrder | undefined): number | null => {
  if (workOrder?.progress === undefined) return null;

  return workOrder.progress.varianceQty ?? workOrder.orderQty - workOrder.progress.goodQty;
};

/**
 * 저장을 막는 사유. **막지 않으면 `null`.**
 *
 * ⛔ 잔여 초과는 여기 넣지 않는다 — 초과 생산은 허용이라 저장을 막는 사유가 아니다.
 */
export type BlockReason =
  'gate' | 'noWorkOrder' | 'noWorker' | 'noLot' | 'pendingPqc' | 'emptyQty' | 'zeroQty';

export interface SaveGuard {
  /** 게이팅이 열려 있는가 — `canInputResult === true` 일 때만 참이다. */
  isGateAllowed: boolean;
  hasWorkOrder: boolean;
  hasWorker: boolean;
  hasLot: boolean;
  /** 아직 끝나지 않은 PQC 의뢰가 있는가(R54). 있으면 실적을 먼저 넣을 수 없다. */
  hasPendingPqc: boolean;
  draft: ResultDraft;
}

/**
 * 순서가 규정이다 — **먼저 걸리는 것부터 말한다.**
 *
 * 사용자가 고칠 수 있는 것(수량)보다 고칠 수 없는 것(권한·진입값·선행 검사)을 앞에 둔다.
 * 뒤엣것부터 말하면 수량을 고쳐 넣고 나서야 「이 단말은 안 됩니다」를 보게 된다.
 */
export const saveBlockReason = (guard: SaveGuard): BlockReason | null => {
  if (!guard.isGateAllowed) return 'gate';
  if (!guard.hasWorkOrder) return 'noWorkOrder';
  if (!guard.hasWorker) return 'noWorker';
  if (guard.hasPendingPqc) return 'pendingPqc';
  if (!guard.hasLot) return 'noLot';

  const qty = parseGoodQty(guard.draft.goodQty);
  if (qty === null) return 'emptyQty';
  if (qty <= 0) return 'zeroQty';

  return null;
};

export const canSave = (guard: SaveGuard): boolean => saveBlockReason(guard) === null;

/**
 * 이번 입력이 **잔여를 넘는가.** 잔여를 모르면 넘는지도 모르므로 `false` 다.
 *
 * ⛔ 넘는다고 막지 않는다 — 초과 생산은 확정된 허용이고(QA #27), 초과분은 추가 생산LOT 으로
 * 간다. 화면이 하는 일은 **확인을 한 번 받는 것**이다(스펙 §6).
 */
export const exceedsRemaining = (buffer: string, remaining: number | null): boolean => {
  const qty = parseGoodQty(buffer);

  return qty !== null && remaining !== null && qty > remaining;
};

/** 사람이 읽는 수량. 소수 자리가 있으면 그대로 보인다. */
export const formatQty = (value: number): string => value.toLocaleString('ko-KR');
