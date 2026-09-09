import { ISSUE_UNIT, type IssueUnit } from './types';

/**
 * 「발행·인쇄」를 열 수 있는가. **막혔으면 무엇이 막았는지도 함께 답한다** — 눌리지 않는
 * 버튼만 두면 사용자는 무엇을 해야 풀리는지 알 수 없다.
 *
 * 스펙 §5-6 의 활성 조건 그대로다 — **대상이 선택됐고, (회차 1이거나 재발행 사유가 선택됐다).**
 * 여기에 귀속 사번이 더해진다(사번이 없으면 서버가 쓰기를 거부한다).
 *
 * ⚠ **파렛트 단위는 대상이 두 걸음이다** — 어느 LOT 으로 좁힐지 정하는 라인 하나, 그리고 그
 * 라인의 LOT 이 실린 취급 단위 하나다(스펙 §5-2). 라인을 여럿 고르면 화면이 어느 LOT 으로
 * 좁힐지 대신 정하게 되므로 그 상태를 열지 않는다.
 */
export type IssueGuard =
  | { kind: 'ready' }
  | { kind: 'noWorker' }
  | { kind: 'noSelection' }
  | { kind: 'palletNeedsOneLine' }
  | { kind: 'noPallet' }
  | { kind: 'emptyPallet' }
  | { kind: 'reasonRequired' };

export interface IssueGuardInput {
  /** 귀속 사번. 없으면 쓰기를 열지 않는다. */
  workerNo: string | null;
  unit: IssueUnit;
  selectedIds: readonly string[];
  /** 고른 취급 단위. 파렛트 단위에서만 쓴다. */
  palletId: number | null;
  /**
   * 고른 취급 단위에 담긴 줄 수. **아직 모르면 `null`이다.**
   *
   * ⛔ 모르는 것을 0 으로 접지 않는다 — 조회가 늦은 것뿐인데 「빈 파렛트」라며 막게 된다.
   */
  palletContentCount: number | null;
  /** 고른 대상 중 이미 발행된 것이 있는가 — 있으면 재발행이라 사유가 필요하다. */
  needsReason: boolean;
  /** 고른 재발행 사유. 안 골랐으면 빈 문자열. */
  reasonCode: string;
}

export const issueGuard = ({
  workerNo,
  unit,
  selectedIds,
  palletId,
  palletContentCount,
  needsReason,
  reasonCode,
}: IssueGuardInput): IssueGuard => {
  if (workerNo === null) return { kind: 'noWorker' };
  if (selectedIds.length === 0) return { kind: 'noSelection' };

  if (unit === ISSUE_UNIT.pallet) {
    if (selectedIds.length > 1) return { kind: 'palletNeedsOneLine' };
    if (palletId === null) return { kind: 'noPallet' };
    /* 빈 파렛트에는 찍을 것이 없다(스펙 §6). 모르는 동안은 막지 않는다. */
    if (palletContentCount === 0) return { kind: 'emptyPallet' };
  }

  if (needsReason && reasonCode === '') return { kind: 'reasonRequired' };

  return { kind: 'ready' };
};

export const canIssue = (guard: IssueGuard): boolean => guard.kind === 'ready';
