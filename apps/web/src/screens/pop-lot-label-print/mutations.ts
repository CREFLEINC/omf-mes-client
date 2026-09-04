import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { lotLabelKeys } from './queries';
import type { DocumentIssueBatchResult, DocumentIssueCreate } from './types';

/**
 * 사람이 누르는 쓰기 하나 — **발행 기록**.
 *
 * ⛔ **발행과 인쇄를 묶지 않는다.** 계약이 세 오퍼레이션으로 갈라 두었고, 그 경계가 곧
 * 「어디까지 됐는가」를 표현하는 자리다(스펙 §6 · K-4). 인쇄 결과 보고는 사람이 누르는 저장이
 * 아니라 절차가 이어 부르는 것이라 여기 없다(`use-print.ts`).
 *
 * ⚠ **사번 헤더가 필요하다**(공유계약 D-5). 인증이 아니라 귀속이며, 없으면 서버가 거부한다 —
 * 부르는 쪽이 값을 확보한 뒤에만 발행을 연다(`issue-request.ts` 의 `guardIssue`).
 *
 * ⛔ **낙관적 잠금을 걸지 않는다**(`etagPath: null`). 새 행을 만드는 쓰기라 잠글 대상이 없다.
 */

/**
 * **인라인 자리가 없다.**
 *
 * ⛔ **화면이 갖지 않은 입력칸을 여기 적지 않는다.** `knownFields` 는 「이 화면에 그 오류를
 * 놓을 칸이 있다」는 선언이라, 없는 칸을 적으면 서버가 준 사유가 배너에서도 빠져 **어디에도
 * 표시되지 않는다.** 재발행 사유는 별도 창의 선택지라 인라인 칸이 아니다.
 */
const ISSUE_FIELDS: readonly string[] = [];

export interface DocumentIssueOptions {
  workerNo: string;
  onSuccess: (result: DocumentIssueBatchResult) => void;
}

/**
 * 발행 기록을 만든다.
 *
 * ⭐ **멱등 키의 수명은 `until-applied`** — 되돌릴 수 없는 쓰기다(발행 취소가 없다 · 스펙 §6).
 * 통신이 끊긴 뒤 다시 누르면 서버가 다른 쓰기로 보고 **회차를 두 번 올린다.**
 *
 * ⛔ **부분 발행이 없다** — 계약이 「하나라도 실패하면 전건 실패」로 못박았다. 이 화면은 대상이
 * 하나뿐이라 더 분명하다.
 *
 * 성공하면 그 LOT 의 회차가 올랐으므로 **발행 현황을 다시 센다** — 목록의 「미출력」 표시가
 * 방금 찍은 것을 반영해야 한다.
 */
export const useDocumentIssue = ({
  workerNo,
  onSuccess,
}: DocumentIssueOptions): MasterWriteResult<DocumentIssueCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<DocumentIssueCreate, DocumentIssueBatchResult>({
    request: (body, headers) =>
      client.POST('/app/document-issues', {
        params: {
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
          },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [lotLabelKeys.all],
    knownFields: ISSUE_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
