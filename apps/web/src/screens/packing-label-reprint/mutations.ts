import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { reprintKeys } from './queries';
import type { DocumentIssueBatchResult, DocumentIssueCreate } from './types';

/**
 * 재출력의 첫 걸음 — **발행 기록을 만든다.**
 *
 * ⛔ **인쇄를 여기 묶지 않는다**(스펙 §5-3 · K-4). 계약이 발행·렌디션·결과 보고를 세 오퍼레이션으로
 * 갈라 두었고, 그 경계가 곧 「어디까지 됐는가」를 표현하는 자리다 — **인쇄가 실패해도 발행
 * 기록은 남아야** 재인쇄로 복구된다.
 *
 * ⚠ **사번 헤더가 필요하다**(공유계약 D-5 · 통지 #563). 인증이 아니라 귀속이며, 단말 토큰으로 온
 * 요청에 이것이 없으면 서버가 거부한다.
 *
 * ⭐ **멱등 키의 수명은 `until-applied`** — 발행은 되돌릴 수 없다. 통신이 끊긴 뒤 다시 누르면
 * 서버가 다른 쓰기로 보고 **회차를 한 번 더 올린다.**
 *
 * ⛔ **낙관적 잠금을 걸지 않는다**(`etagPath: null`) — 새 행을 만드는 쓰기라 잠글 대상이 없다.
 */

/**
 * 서버 오류를 놓을 화면 칸.
 *
 * ⭐ **이 화면에는 재발행 사유 칸이 있다** — 다른 라벨 화면과 다른 점이다. 사유가 빠져 서버가
 * 422 로 되돌리면 그 말이 배너가 아니라 **그 칸 아래**에 서야 사용자가 무엇을 고칠지 안다.
 */
const ISSUE_FIELDS = ['reissueReasonCode'] as const;

export interface DocumentIssueOptions {
  workerNo: string;
  onSuccess: (result: DocumentIssueBatchResult) => void;
}

export const useDocumentReissue = ({
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
    /* 회차가 올랐다 — 대상 줄의 「발행 이력」을 다시 받아야 방금 찍은 것이 반영된다. */
    invalidateKeys: [reprintKeys.all],
    knownFields: ISSUE_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
