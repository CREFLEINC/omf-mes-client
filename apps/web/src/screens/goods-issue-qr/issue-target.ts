/**
 * 「발행·인쇄」를 열 수 있는가. **막혔으면 무엇이 막았는지도 함께 답한다** — 눌리지 않는
 * 버튼만 두면 사용자는 무엇을 해야 풀리는지 알 수 없다.
 *
 * 스펙 §5-6 의 활성 조건 그대로다 — **대상이 선택됐고, (회차 1이거나 재발행 사유가 선택됐다).**
 * 여기에 귀속 사번이 더해진다(사번이 없으면 서버가 쓰기를 거부한다).
 */
export type IssueGuard =
  { kind: 'ready' } | { kind: 'noWorker' } | { kind: 'noSelection' } | { kind: 'reasonRequired' };

export interface IssueGuardInput {
  /** 귀속 사번. 없으면 쓰기를 열지 않는다. */
  workerNo: string | null;
  selectedIds: readonly string[];
  /** 고른 라인 중 이미 발행된 것이 있는가 — 있으면 재발행이라 사유가 필요하다. */
  needsReason: boolean;
  /** 고른 재발행 사유. 안 골랐으면 빈 문자열. */
  reasonCode: string;
}

export const issueGuard = ({
  workerNo,
  selectedIds,
  needsReason,
  reasonCode,
}: IssueGuardInput): IssueGuard => {
  if (workerNo === null) return { kind: 'noWorker' };
  if (selectedIds.length === 0) return { kind: 'noSelection' };
  if (needsReason && reasonCode === '') return { kind: 'reasonRequired' };

  return { kind: 'ready' };
};

export const canIssue = (guard: IssueGuard): boolean => guard.kind === 'ready';
