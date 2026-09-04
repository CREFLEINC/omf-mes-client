import type { ApiError } from '@omf-mes/api-client';

import type { IssueRunResult } from './mutations';

/**
 * 등록·인쇄가 멈춘 자리에서 **사용자가 무엇을 할 수 있는가.**
 *
 * ⛔ **「실패」 한 갈래로 뭉뚱그리지 않는다.** 다시 눌러 풀리는 것과 이 단말에서는 영영 안 되는
 * 것을 같은 문구로 내면, 앞엣것에서는 사람이 포기하고 뒤엣것에서는 계속 누른다
 * (변경 통지 #534 · 스펙 `P-01-01` v0.2 §5-2 · §6).
 */
export type IssueFailure =
  /** 채번 충돌(409). 서버가 스스로 재시도한 끝의 실패라 **다시 부르면 풀린다.** */
  | 'registerConflict'
  /** 이 단말에 출력 권한이 없다(403). 다시 눌러도 같은 답이 온다. */
  | 'issueForbidden'
  /** 기록은 남았고 종이만 안 나왔다. */
  | 'printFailed'
  /** 그 밖의 실패 — 값이 틀렸거나(400) 서버가 거부했다. */
  | 'other';

/**
 * ⚠ **409 를 400 과 같이 다루지 않는다**(변경 통지 #534 §1). 채번 중복은 서버가 스스로 다시
 * 시도하며, 거듭 실패했을 때만 409 로 올라온다 — **사용자가 고칠 수 있는 값이 아니다.**
 *
 * 계약의 `ConflictResponse` 봉투로 오면 `conflict` 로, 봉투 없이 오면 `http` 409 로 정규화된다.
 * 채번 충돌의 원인 값이 그 enum(`user`·`erpSync`·`workerLease`)에 없으므로 둘 다 받는다.
 */
const isRetryableConflict = (error: ApiError): boolean =>
  error.kind === 'conflict' || (error.kind === 'http' && error.status === 409);

/**
 * 계약이 권한 거부에 붙이는 코드. 계약이 `ErrorItem.code` 설명에 이름째 적어 둔 값이고,
 * 정규화가 같은 자리에서 `STATE_LOCKED` 를 리터럴로 보는 것과 같은 취급이다.
 */
const PERMISSION_DENIED = 'PERMISSION_DENIED';

/**
 * 이 단말에 출력 권한이 없다 — 게이트는 화면이 아니라 서버가 갖는다(스펙 §5-5).
 *
 * ⛔ **상태 코드만 보면 이 판정은 실서버에서 한 번도 참이 되지 않는다.** 계약은 이 403 을
 * 오류 봉투(`ErrorResponse`)로 정의하는데, 정규화(`normalizeApiError`)는 봉투를 보면
 * `validation`·`stateLocked` 로 접으면서 **상태 코드를 버린다** — `http` 403 은 계약 밖 응답에만
 * 남는다. 그래서 봉투 안의 코드도 함께 본다. 둘 중 하나라도 맞으면 권한 거부다.
 */
const isForbidden = (error: ApiError): boolean => {
  if (error.kind === 'http') return error.status === 403;
  if (error.kind === 'validation' || error.kind === 'stateLocked')
    return error.errors.some((item) => item.code === PERMISSION_DENIED);

  return false;
};

/**
 * 한 번의 등록·인쇄가 어떤 실패로 끝났는가. 끝까지 갔거나 아직 아무것도 하지 않았으면 `null`.
 */
export const toIssueFailure = (result: IssueRunResult): IssueFailure | null => {
  const { isPrinted, failedAt, error } = result;

  if (isPrinted || failedAt === null) return null;
  if (failedAt === 'print') return 'printFailed';
  if (error === null) return 'other';
  if (failedAt === 'register' && isRetryableConflict(error)) return 'registerConflict';
  if (failedAt === 'issue' && isForbidden(error)) return 'issueForbidden';

  return 'other';
};
