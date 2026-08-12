import { messages } from '@omf-mes/i18n';

import type { ApproverOption } from './approver-options';
import type { ApprovalRouteStep, ApprovalRouteStepsReplace } from './types';

/**
 * 결재 단계 초안 — **되돌릴 수 없는 치환의 본문을 만드는 자리**다.
 *
 * 계약에 **개별 추가·삭제 경로가 없다.** 화면이 최종 순서 전체를 통째로 보내고 서버가 한
 * 트랜잭션으로 반영한다 — 순서 열에 유일 제약이 걸려 있어 두 단계를 맞바꾸면 중간 상태가
 * 반드시 제약을 위반하기 때문이다(행 단위 저장이 원리적으로 불가능하다).
 *
 * 그 규약을 지키려면 순서가 **화면 안에서만** 움직여야 하고, 이 파일이 그 움직임을 전부 갖는다.
 * 저장 가능 판정도 여기 하나뿐이다 — 버튼의 잠금 사유와 보내는 자리의 재판정이 같은 함수를
 * 불러야 「버튼은 눌리는데 아무 일이 없는」 자리나 그 반대가 생기지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.approvalRoute;

/**
 * 표에 보이는 한 행.
 *
 * **순서 값을 담지 않는다** — 순서는 이 배열의 위치이고 치환 본문에도 싣지 않는다(계약:
 * 배열 순서가 곧 순서다). 담아 두면 위치와 값이 어긋날 수 있는 자리가 하나 생긴다.
 *
 * **승인자 번호가 없을 수 있다.** 계약이 그 필드를 선택으로 두었고, 1차에 쓰지 않는 구분
 * (역할·부서)으로 만들어진 단계가 그렇게 온다. 화면이 번호를 지어낼 수 없으므로 그 사실을
 * 그대로 담고 **저장을 막는다** — 지우고 다시 넣는 것이 유일한 길이다.
 */
export interface StepDraft {
  /** 새 행에도 안정적인 키. 순서 이동·삭제가 이 값으로 행을 집는다. */
  draftId: string;
  approverUserId: number | null;
  /** 없으면 `null`. **번호로 대신하지 않는다** — 내부 번호가 화면에 서면 식별자로 읽힌다. */
  approverName: string | null;
  approverDepartmentName: string | null;
  /** 거짓이면 그 단계에서 결재가 멈춘다. 화면이 경고하되 **막지 않는다.** */
  approverIsActive: boolean;
}

/** 서버가 빈 문구를 주는 일이 있다. `??`는 빈 문자열을 통과시켜 칸을 이유 없이 비운다. */
const toDisplayName = (value: string | undefined): string | null =>
  value === undefined || value === '' ? null : value;

/**
 * 서버가 준 단계를 초안으로 옮긴다.
 *
 * **차례를 바꾸지 않는다** — 그 차례가 곧 지금 저장된 순서다.
 */
export const toStepDrafts = (steps: readonly ApprovalRouteStep[]): StepDraft[] =>
  steps.map((step) => ({
    draftId: `saved:${String(step.approvalRouteStepId)}`,
    approverUserId: step.approverUserId ?? null,
    approverName: toDisplayName(step.approverName),
    approverDepartmentName: toDisplayName(step.approverDepartmentName),
    approverIsActive: step.approverIsActive,
  }));

/**
 * 아직 저장되지 않은 행의 키. 저장된 행(`saved:<id>`)과 겹치지 않기만 하면 되고,
 * 한 세션 안에서만 유일하면 된다 — **서버로 나가지 않는 값이다.**
 */
let newDraftSequence = 0;

/**
 * 고른 승인자로 새 행 하나를 만든다.
 *
 * **고르지 않았으면 만들지 않는다.** 계약이 승인자 번호를 필수로 두지 않아 목이 200으로
 * 받는다 — 막는 곳이 화면뿐이라 그 판정을 여기 두고 부르는 자리가 결과를 확인한다.
 *
 * **부서 이름은 비어 있다.** 계약의 사용자 목록이 부서 번호만 주므로 화면이 알 길이 없다 —
 * 저장하면 서버 응답이 채운다.
 */
export const createStepDraft = (approver: ApproverOption | null): StepDraft | null => {
  if (approver === null) return null;

  newDraftSequence += 1;

  return {
    draftId: `new:${String(newDraftSequence)}`,
    approverUserId: approver.appUserId,
    approverName: approver.approverName,
    approverDepartmentName: null,
    approverIsActive: approver.isActive,
  };
};

/**
 * `from` 위치의 행을 `to`로 옮긴 새 목록.
 *
 * **여기서 서버를 부르지 않는다.** 이동은 초안만 바꾸고 저장은 사용자가 마칠 때 한 번뿐이다.
 * 목록 밖으로 나가는 이동(첫 행 위·마지막 행 아래)은 받은 목록을 그대로 돌려준다 —
 * 디자인 시스템이 그 두 버튼을 이미 잠그지만, 판정은 자료를 바꾸는 쪽이 갖는다.
 */
export const moveStepDraft = (
  drafts: readonly StepDraft[],
  from: number,
  to: number,
): StepDraft[] => {
  const isOutOfRange =
    from < 0 || from >= drafts.length || to < 0 || to >= drafts.length || from === to;

  if (isOutOfRange) return [...drafts];

  const next = [...drafts];
  const [moved] = next.splice(from, 1);

  if (moved === undefined) return [...drafts];

  next.splice(to, 0, moved);

  return next;
};

export const removeStepDraft = (drafts: readonly StepDraft[], draftId: string): StepDraft[] =>
  drafts.filter((draft) => draft.draftId !== draftId);

/**
 * 삭제가 막힌 사유. `null`이면 지울 수 있다.
 *
 * **마지막 한 단계는 지울 수 없다.** 저장 잠금(단계 0)보다 한 걸음 앞선 방어다 — 지운 뒤에
 * 「저장할 수 없다」고 말하면 사용자는 이미 화면에서 그것을 잃은 뒤이고, 되돌리려면
 * 「다시 조회」로 통째로 버려야 한다.
 */
export const stepRemoveBlockedReason = (draftCount: number): string | null =>
  draftCount <= 1 ? t.actionReasons.stepRemoveLast : null;

/**
 * 두 번 이상 나오는 승인자의 번호.
 *
 * **막는 판정이 아니라 보이는 판정이다.** 같은 사람이 다른 자격으로 두 번 결재하는 것은
 * 업무상 정당할 수 있고 계약도 그것을 금지하지 않았다 — 화면이 없는 규칙을 지어내지 않는다.
 *
 * 승인자를 확인할 수 없는 행끼리는 겹침으로 세지 않는다. 번호가 없는 것이지 같은 것이 아니다.
 */
export const duplicateApproverIds = (drafts: readonly StepDraft[]): ReadonlySet<number> => {
  const seen = new Set<number>();
  const duplicated = new Set<number>();

  for (const draft of drafts) {
    if (draft.approverUserId === null) continue;

    if (seen.has(draft.approverUserId)) duplicated.add(draft.approverUserId);

    seen.add(draft.approverUserId);
  }

  return duplicated;
};

/**
 * 치환 요청의 본문. **보낼 수 없으면 `null`이다.**
 *
 * - **순서 값을 싣지 않는다** — 배열 순서가 곧 순서다(계약). 목은 실어 보내도 200으로 받는다.
 * - **역할·부서 번호를 싣지 않는다** — 1차 미사용이고, 실으면 서버가 400을 낼 수 있다.
 * - **구분은 `'USER'` 상수다** — 계약 enum에 나머지 둘이 남아 있고 목은 그것도 200으로 받는다.
 *   선택칸 값을 그대로 실으면 열지 않기로 한 값이 서버로 나갈 수 있다.
 * - **빈 배열을 만들지 않는다** — 계약이 400으로 막고(단계 없는 결재선은 상신을 거부한다)
 *   화면도 막는다. 둘은 목적이 다르므로 어느 하나를 등가로 보고 지우지 않는다.
 */
export const toStepsReplaceBody = (
  drafts: readonly StepDraft[],
): ApprovalRouteStepsReplace | null => {
  if (drafts.length === 0) return null;

  const steps = [];

  for (const draft of drafts) {
    if (draft.approverUserId === null) return null;

    steps.push({ approverTypeCode: 'USER' as const, approverUserId: draft.approverUserId });
  }

  return { steps };
};

const isSameDraft = (a: StepDraft, b: StepDraft | undefined): boolean =>
  b !== undefined && a.draftId === b.draftId && a.approverUserId === b.approverUserId;

/**
 * 「고친 것이 있는가」의 판정 근거. **순서만 달라도 다른 것으로 본다** —
 * 이 화면에서 순서는 보기 방식이 아니라 저장되는 자료다.
 */
export const isSameStepDrafts = (a: readonly StepDraft[], b: readonly StepDraft[]): boolean =>
  a.length === b.length && a.every((draft, index) => isSameDraft(draft, b[index]));

export interface StepSaveGate {
  drafts: readonly StepDraft[];
  /** 서버에서 온 순서. 「고친 것이 없다」의 기준이다. */
  baseline: readonly StepDraft[];
  /**
   * 결재선 폼에 저장하지 않은 변경이 있는가.
   *
   * **두 저장이 한 벌의 잠금 토큰을 나눠 쓴다.** 폼을 저장하면 단계 저장이 싣고 있던 토큰이
   * 낡아 그다음이 조용히 409다 — 순서를 강제하는 편이 그 실패를 설명하는 것보다 낫다.
   */
  isRouteFormDirty: boolean;
}

/**
 * 단계 저장이 막힌 사유. `null`이면 저장할 수 있다.
 *
 * **차례가 뜻이다** — 사용자가 먼저 해야 할 일을 먼저 말한다. 결재선 폼을 정리하는 것이
 * 가장 앞이고(다른 구획의 일이라 단계를 아무리 고쳐도 풀리지 않는다), 그다음이 단계 자체의
 * 사정이며, 「고친 것이 없다」가 맨 뒤다.
 *
 * **승인자가 사용 중지인 것과 같은 승인자가 둘인 것은 막지 않는다.** 앞엣것은 막으면 다른
 * 단계를 고치는 것까지 불가능해지고, 뒤엣것은 계약도 이슈도 금지하지 않은 일이다.
 */
export const stepSaveBlockedReason = (gate: StepSaveGate): string | null => {
  if (gate.isRouteFormDirty) return t.actionReasons.stepSaveFormDirty;
  if (gate.drafts.length === 0) return t.actionReasons.stepSaveNoSteps;
  if (gate.drafts.some((draft) => draft.approverUserId === null)) {
    return t.actionReasons.stepSaveApproverMissing;
  }

  return isSameStepDrafts(gate.drafts, gate.baseline) ? t.actionReasons.stepSaveNoChanges : null;
};

/** 추가가 막힌 사유. `null`이면 더할 수 있다. */
export const stepAddBlockedReason = (approver: ApproverOption | null): string | null =>
  approver === null ? t.actionReasons.stepAddNoApprover : null;
