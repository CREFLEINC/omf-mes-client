import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { repackLabelKeys } from './queries';
import type { DocumentIssueBatchResult, DocumentIssueCreate } from './types';

/**
 * 발행의 첫 걸음 — **기록을 만든다.**
 *
 * ⛔ **인쇄를 여기 묶지 않는다**(스펙 §6 · K-4). 계약이 발행·렌디션·결과 보고를 세 오퍼레이션으로
 * 갈라 두었고, 그 경계가 곧 「어디까지 됐는가」를 표현하는 자리다 — **인쇄가 실패해도 발행
 * 기록은 남아야** 재인쇄로 복구된다.
 *
 * ⚠ **사번 헤더가 필요하다**(공유계약 D-5). 인증이 아니라 귀속이며, 단말 토큰으로 온 요청에
 * 이것이 없으면 서버가 거부한다.
 *
 * ⭐ **멱등 키의 수명은 `until-applied`** — 발행은 되돌릴 수 없다. 통신이 끊긴 뒤 다시 누르면
 * 서버가 다른 쓰기로 보고 **회차를 한 번 더 올린다.**
 *
 * ⛔ **낙관적 잠금을 걸지 않는다**(`etagPath: null`) — 새 행을 만드는 쓰기라 잠글 대상이 없다.
 */

/**
 * 서버 오류를 놓을 화면 칸.
 *
 * ⭐ **재발행 사유가 빠져 422 가 오면 그 말이 배너가 아니라 사유 칸 아래에 서야** 사용자가
 * 무엇을 고칠지 안다(스펙 §6 「재출력 사유 미선택 — 화면이 먼저 막는다」).
 */
const ISSUE_FIELDS = ['reissueReasonCode'] as const;

export interface DocumentIssueOptions {
  workerNo: string;
  onSuccess: (result: DocumentIssueBatchResult) => void;
}

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
    /* 회차가 올랐다 — 발행 현황·이력을 다시 받아야 방금 찍은 것이 반영된다. */
    invalidateKeys: [repackLabelKeys.all],
    knownFields: ISSUE_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
