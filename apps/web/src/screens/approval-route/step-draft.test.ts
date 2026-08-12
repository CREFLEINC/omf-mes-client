import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toApproverOptions, type ApproverOption } from './approver-options';
import { stepFixtures, userFixtures } from './fixtures';
import type { ApprovalRouteStep } from './types';
import {
  createStepDraft,
  duplicateApproverIds,
  isSameStepDrafts,
  moveStepDraft,
  removeStepDraft,
  stepAddBlockedReason,
  stepRemoveBlockedReason,
  stepSaveBlockedReason,
  toStepDrafts,
  toStepsReplaceBody,
  type StepDraft,
} from './step-draft';

const t = messages.approvalRoute;

const drafts = (): StepDraft[] => toStepDrafts(stepFixtures);

/** 인덱스 접근이 `undefined`를 섞지 않게 한 자리에서 좁힌다. 픽스처가 비지 않는다는 것은 이 파일의 전제다. */
const stepAt = (index: number): ApprovalRouteStep => stepFixtures[index] as ApprovalRouteStep;
const approverAt = (index: number): ApproverOption =>
  toApproverOptions(userFixtures)[index] as ApproverOption;

const draftOf = (
  approverUserId: number | null,
  draftId = `d${String(approverUserId)}`,
): StepDraft => ({
  draftId,
  approverUserId,
  approverName: null,
  approverDepartmentName: null,
  approverIsActive: true,
});

describe('toStepDrafts', () => {
  it('서버가 준 차례를 그대로 초안 순서로 삼는다', () => {
    expect(drafts().map((draft) => draft.approverUserId)).toEqual([9301, 9302, 9303]);
  });

  /**
   * **순서 값을 담지 않는다.** 순서는 이 배열의 위치이며, 담아 두면 위치와 값이 어긋날 수 있는
   * 자리가 하나 생긴다 — 치환 본문에도 순서를 싣지 않으므로(계약) 담을 이유가 없다.
   */
  it('순서 값을 담지 않는다 — 순서는 배열의 위치다', () => {
    for (const draft of drafts()) {
      expect(draft).not.toHaveProperty('stepNo');
    }
  });

  it('행 식별자가 저장된 단계 번호에서 나와 안정적이다', () => {
    // 새 행에도 안정적인 키가 있어야 순서 이동·삭제가 엉뚱한 행을 집지 않는다.
    expect(drafts().map((draft) => draft.draftId)).toEqual([
      'saved:9201',
      'saved:9202',
      'saved:9203',
    ]);
  });

  it('표시 이름·부서·사용 여부를 응답 값 그대로 들고 온다', () => {
    expect(drafts()[1]).toMatchObject({
      approverName: '합성 승인자2',
      approverDepartmentName: '합성부서 나',
      approverIsActive: false,
    });
  });

  /**
   * **계약이 승인자 번호를 필수로 두지 않았다.** 없으면 화면이 지어낼 수 없고, 그 행을 그대로
   * 되돌려 보낼 수도 없다 — 그 사실이 초안에 남아 저장 잠금으로 이어진다.
   */
  it('승인자 번호가 없는 단계는 번호 없이 담는다', () => {
    const parsed = toStepDrafts([{ ...stepAt(0), approverUserId: undefined }]);

    expect(parsed[0]?.approverUserId).toBeNull();
  });

  it('이름이 오지 않으면 null로 세운다 — 번호로 대신하지 않는다', () => {
    const parsed = toStepDrafts([
      { ...stepAt(0), approverName: undefined, approverDepartmentName: undefined },
    ]);

    expect(parsed[0]?.approverName).toBeNull();
    expect(parsed[0]?.approverDepartmentName).toBeNull();
  });

  it('빈 문자열 이름을 이름으로 세우지 않는다', () => {
    // 서버가 빈 문구를 주는 일이 실제로 있다. 통과시키면 승인자 칸이 이유 없이 빈다.
    const parsed = toStepDrafts([{ ...stepAt(0), approverName: '', approverDepartmentName: '' }]);

    expect(parsed[0]?.approverName).toBeNull();
    expect(parsed[0]?.approverDepartmentName).toBeNull();
  });
});

describe('createStepDraft', () => {
  it('고른 승인자로 새 행 하나를 만든다', () => {
    const created = createStepDraft(approverAt(1));

    expect(created).toMatchObject({
      approverUserId: 9304,
      approverName: '합성 승인자4',
      approverIsActive: true,
    });
  });

  /**
   * **부서 이름을 지어내지 않는다.** 사용자 목록이 부서 번호만 주므로 새 행의 부서는 비어 있고,
   * 저장 뒤 서버 응답이 채운다.
   */
  it('새 행의 부서 이름은 비어 있다 — 사용자 목록이 주지 않는 값이다', () => {
    expect(createStepDraft(approverAt(0))?.approverDepartmentName).toBeNull();
  });

  it('행 식별자가 저장된 행과 겹치지 않고 부를 때마다 다르다', () => {
    const first = createStepDraft(approverAt(0));
    const second = createStepDraft(approverAt(0));

    expect(first?.draftId).not.toBe(second?.draftId);
    expect(drafts().map((draft) => draft.draftId)).not.toContain(first?.draftId);
  });

  /** 승인자를 고르지 않았으면 **행을 만들지 않는다** — 목이 200으로 받는 자리다. */
  it('승인자를 고르지 않으면 행을 만들지 않는다', () => {
    expect(createStepDraft(null)).toBeNull();
  });
});

describe('moveStepDraft', () => {
  it('앞 행을 뒤로 옮긴다', () => {
    expect(moveStepDraft(drafts(), 0, 1).map((draft) => draft.approverUserId)).toEqual([
      9302, 9301, 9303,
    ]);
  });

  it('뒤 행을 앞으로 옮긴다', () => {
    expect(moveStepDraft(drafts(), 2, 0).map((draft) => draft.approverUserId)).toEqual([
      9303, 9301, 9302,
    ]);
  });

  /** 목록 밖으로 나가는 이동은 받은 목록을 그대로 돌려준다 — 첫 행 위·마지막 행 아래다. */
  it('목록 밖으로 나가는 이동은 아무것도 바꾸지 않는다', () => {
    const before = drafts();

    expect(moveStepDraft(before, 0, -1)).toEqual(before);
    expect(moveStepDraft(before, 2, 3)).toEqual(before);
    expect(moveStepDraft(before, 1, 1)).toEqual(before);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const before = drafts();

    moveStepDraft(before, 0, 2);

    expect(before.map((draft) => draft.approverUserId)).toEqual([9301, 9302, 9303]);
  });
});

describe('removeStepDraft', () => {
  it('그 행만 지운다', () => {
    expect(removeStepDraft(drafts(), 'saved:9202').map((draft) => draft.approverUserId)).toEqual([
      9301, 9303,
    ]);
  });

  it('없는 행을 지우라고 해도 목록이 그대로다', () => {
    expect(removeStepDraft(drafts(), 'saved:0000')).toHaveLength(3);
  });
});

describe('stepRemoveBlockedReason', () => {
  /**
   * **마지막 한 단계는 지울 수 없다.** 저장 잠금(단계 0)보다 한 걸음 앞선 방어다 —
   * 지운 뒤에 「저장할 수 없다」고 말하면 사용자는 이미 화면에서 그것을 잃은 뒤다.
   */
  it('단계가 하나뿐이면 사유와 함께 막는다', () => {
    expect(stepRemoveBlockedReason(1)).toBe(t.actionReasons.stepRemoveLast);
  });

  it('둘 이상이면 막지 않는다', () => {
    expect(stepRemoveBlockedReason(2)).toBeNull();
  });
});

describe('duplicateApproverIds', () => {
  /** 같은 사람이 다른 자격으로 두 번 결재하는 것은 업무상 정당할 수 있다 — **막지 않는다.** */
  it('두 번 이상 나오는 승인자를 모은다', () => {
    expect([
      ...duplicateApproverIds([draftOf(9301, 'a'), draftOf(9302, 'b'), draftOf(9301, 'c')]),
    ]).toEqual([9301]);
  });

  it('겹치지 않으면 비어 있다', () => {
    expect(duplicateApproverIds(drafts()).size).toBe(0);
  });

  /** 승인자를 확인할 수 없는 행끼리는 「같은 사람」이 아니다 — 번호가 없는 것이지 같은 것이 아니다. */
  it('승인자 번호가 없는 행끼리는 겹침으로 세지 않는다', () => {
    expect(duplicateApproverIds([draftOf(null, 'a'), draftOf(null, 'b')]).size).toBe(0);
  });
});

describe('toStepsReplaceBody', () => {
  it('보이는 순서 그대로 싣는다', () => {
    const body = toStepsReplaceBody(moveStepDraft(drafts(), 2, 0));

    expect(body?.steps.map((step) => step.approverUserId)).toEqual([9303, 9301, 9302]);
  });

  /**
   * **순서 값을 싣지 않는다.** 배열 순서가 곧 순서라고 계약이 못 박았고, 목은 순서 값을 실어
   * 보내도 200으로 받는다 — 막는 곳이 화면뿐이다.
   */
  it('순서 값을 싣지 않는다', () => {
    for (const step of toStepsReplaceBody(drafts())?.steps ?? []) {
      expect(step).not.toHaveProperty('stepNo');
    }
  });

  /** 1차 미사용 필드를 싣지 않는다 — 실으면 서버가 400을 낼 수 있다. */
  it('역할·부서 번호를 싣지 않는다', () => {
    for (const step of toStepsReplaceBody(drafts())?.steps ?? []) {
      expect(step).not.toHaveProperty('approverRoleId');
      expect(step).not.toHaveProperty('approverDepartmentId');
    }
  });

  /**
   * **구분은 상수다.** 계약 enum에 역할·부서가 남아 있고 목은 그것도 200으로 받는다 —
   * 선택칸 값을 그대로 실으면 열지 않기로 한 값이 서버로 나갈 수 있다.
   */
  it('승인자 구분을 늘 사용자로 싣는다', () => {
    for (const step of toStepsReplaceBody(drafts())?.steps ?? []) {
      expect(step.approverTypeCode).toBe('USER');
    }
  });

  /** 승인자를 확인할 수 없는 행이 있으면 **본문을 만들지 않는다** — 목이 200으로 받는 자리다. */
  it('승인자 번호가 없는 행이 있으면 본문을 만들지 않는다', () => {
    expect(toStepsReplaceBody([draftOf(9301, 'a'), draftOf(null, 'b')])).toBeNull();
  });

  /** 빈 배열은 계약이 400으로 막는다. 화면도 본문을 만들지 않는다(이중화). */
  it('단계가 하나도 없으면 본문을 만들지 않는다', () => {
    expect(toStepsReplaceBody([])).toBeNull();
  });
});

describe('isSameStepDrafts', () => {
  it('같은 값·같은 순서면 같다', () => {
    expect(isSameStepDrafts(drafts(), drafts())).toBe(true);
  });

  /** **순서만 달라도 다른 것으로 본다** — 이 화면에서 순서는 보기 방식이 아니라 저장되는 자료다. */
  it('순서만 달라도 다른 것으로 본다', () => {
    expect(isSameStepDrafts(moveStepDraft(drafts(), 0, 1), drafts())).toBe(false);
  });

  it('행이 늘거나 줄면 다르다', () => {
    expect(isSameStepDrafts(removeStepDraft(drafts(), 'saved:9201'), drafts())).toBe(false);
  });

  it('승인자가 바뀌면 다르다', () => {
    const changed = drafts();
    changed[0] = { ...(changed[0] as StepDraft), approverUserId: 9304 };

    expect(isSameStepDrafts(changed, drafts())).toBe(false);
  });
});

describe('stepSaveBlockedReason', () => {
  const gate = (overrides: Partial<Parameters<typeof stepSaveBlockedReason>[0]> = {}) =>
    stepSaveBlockedReason({
      drafts: moveStepDraft(drafts(), 0, 1),
      baseline: drafts(),
      isRouteFormDirty: false,
      ...overrides,
    });

  it('고친 순서가 있고 막을 것이 없으면 저장할 수 있다', () => {
    expect(gate()).toBeNull();
  });

  /**
   * **결재선 폼이 더러우면 먼저 막는다.** 두 저장이 한 벌의 잠금 토큰을 나눠 쓰므로 폼을
   * 저장하면 단계 저장이 싣고 있던 토큰이 낡는다 — 순서가 있는 일이다.
   */
  it('결재선 폼에 저장하지 않은 변경이 있으면 막는다', () => {
    expect(gate({ isRouteFormDirty: true })).toBe(t.actionReasons.stepSaveFormDirty);
  });

  it('단계가 하나도 없으면 막는다', () => {
    expect(gate({ drafts: [], baseline: drafts() })).toBe(t.actionReasons.stepSaveNoSteps);
  });

  it('승인자를 확인할 수 없는 행이 있으면 막는다', () => {
    expect(gate({ drafts: [draftOf(null, 'a')], baseline: drafts() })).toBe(
      t.actionReasons.stepSaveApproverMissing,
    );
  });

  it('고친 것이 없으면 막는다', () => {
    expect(gate({ drafts: drafts(), baseline: drafts() })).toBe(t.actionReasons.stepSaveNoChanges);
  });

  /** 사유의 차례가 뜻이다 — 먼저 해야 할 일을 먼저 말한다. */
  it('폼이 더러운 것을 단계 사정보다 먼저 말한다', () => {
    expect(gate({ drafts: [], baseline: drafts(), isRouteFormDirty: true })).toBe(
      t.actionReasons.stepSaveFormDirty,
    );
  });

  /** **승인자가 사용 중지여도 막지 않는다.** 막으면 다른 단계를 고치는 것까지 불가능해진다. */
  it('사용 중지된 승인자가 있어도 막지 않는다', () => {
    expect(gate({ drafts: removeStepDraft(drafts(), 'saved:9203') })).toBeNull();
  });

  /** **같은 승인자가 둘이어도 막지 않는다.** 경고는 표가 낸다. */
  it('같은 승인자가 두 단계에 있어도 막지 않는다', () => {
    expect(
      gate({ drafts: [draftOf(9301, 'a'), draftOf(9301, 'b')], baseline: drafts() }),
    ).toBeNull();
  });
});

describe('stepAddBlockedReason', () => {
  it('승인자를 고르지 않으면 사유와 함께 막는다', () => {
    expect(stepAddBlockedReason(null)).toBe(t.actionReasons.stepAddNoApprover);
  });

  it('골랐으면 막지 않는다', () => {
    expect(stepAddBlockedReason(approverAt(0))).toBeNull();
  });
});
