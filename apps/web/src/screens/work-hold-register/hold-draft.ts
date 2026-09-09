import type { HoldReason } from './reason-options';

/**
 * 중단 등록 입력의 상태와 **검증 한 자리**.
 *
 * ⛔ **사유는 ⓐ 차단이다**(스펙 §6 · 2026-08-23 변경). 저장 측이 `reason_code` 를 nullable 로
 * 두었지만 **「비어 있을 수 있는 칸이라 안 막는다」는 공유계약 `A-9` 가 금지한 추론**이다 —
 * 같은 칸을 쓰는 통제 우회 사유가 이미 필수라, 한 컬럼에 등급이 둘이 된다.
 *
 * ⭐ 목록에 「기타」가 있어 **차단해도 현장이 막히지 않는다** — 고를 것이 없어 멈추는 일이 없다.
 */

export interface HoldDraft {
  /** 고른 중단 사유 코드. 아직 고르지 않았으면 `null`. */
  reasonCode: string | null;
  remarks: string;
}

export const EMPTY_HOLD_DRAFT: HoldDraft = { reasonCode: null, remarks: '' };

/** 무엇이 덜 채워졌는가. 채워졌으면 `null`이다. */
export type HoldDraftError = 'reasonRequired' | 'reasonUnknown';

/**
 * 입력이 등록할 수 있는 모양인가. **지금 받아 온 목록과 견준다.**
 *
 * ⛔ **목록에 없는 사유를 통과시키지 않는다.** 고른 뒤에 목록이 다시 받아져 값이 사라질 수
 * 있고(고객이 마스터에서 끄면 그렇다), 그대로 보내면 서버가 모르는 코드가 기록에 남는다 —
 * 사건은 정정 경로가 없다(스펙 §6).
 *
 * ⚠ **목록이 비어 있으면 「모르는 값」으로 떨어진다** — 그것이 맞다. 고를 것이 없는데 값이
 * 실려 있다는 뜻이고, 화면은 목록을 받지 못한 사실을 따로 말한다.
 */
export const validateHoldDraft = (
  draft: HoldDraft,
  reasons: readonly HoldReason[],
): HoldDraftError | null => {
  if (draft.reasonCode === null || draft.reasonCode === '') return 'reasonRequired';

  const known = reasons.some((reason) => reason.code === draft.reasonCode);

  return known ? null : 'reasonUnknown';
};
