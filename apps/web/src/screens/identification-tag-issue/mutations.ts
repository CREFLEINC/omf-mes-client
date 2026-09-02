import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { tagIssueKeys } from './queries';
import type {
  DocumentIssueBatchResult,
  DocumentIssueCreate,
  SerialNumberBatchCreate,
  SerialNumberBatchResult,
} from './types';

/**
 * 사람이 누르는 쓰기 둘. **하나로 묶지 않는다** — 계약이 세 오퍼레이션으로 갈라 두었고, 그 경계가
 * 곧 「어디까지 됐는가」를 표현하는 자리다(스펙 §5-3 · §6 · K-4).
 *
 * ⚠ **셋 다 사번 헤더가 필요하다**(공유계약 D-5 · 통지 #563). 인증이 아니라 귀속이며, 없으면
 * 서버가 거부한다 — 부르는 쪽이 값을 확보한 뒤에만 발행을 연다.
 *
 * ⛔ **낙관적 잠금을 걸지 않는다**(`etagPath: null`). 둘 다 새 행을 만드는 쓰기라 잠글 대상이
 * 없다. 계약도 발번의 `If-Match` 를 선택으로 두었고 큐는 토큰을 싣지 않는다(C-9).
 *
 * ⚠ **세 번째 쓰기(인쇄 결과 보고)는 여기 없다** — 그것은 사람이 누르는 저장이 아니라 인쇄
 * 절차가 장마다 이어 부르는 것이라, 약속을 돌려주는 형태가 필요하다(`use-print.ts`).
 */

/** ① 개체 대량 발번. 인라인으로 낼 수 있는 필드는 수량 하나다. */
const SERIAL_FIELDS = ['quantity'] as const;

/**
 * ② 발행 기록. **인라인 자리가 없다.**
 *
 * ⛔ **화면이 갖지 않은 입력칸을 여기 적지 않는다.** `knownFields` 는 「이 화면에 그 오류를
 * 놓을 칸이 있다」는 선언이라, 없는 칸을 적으면 서버가 준 사유가 배너에서도 빠져 **어디에도
 * 표시되지 않는다.** 재발행 사유 칸은 값 목록이 도착할 때까지 비활성이라 이 화면에 없다.
 */
const ISSUE_FIELDS: readonly string[] = [];

export interface SerialIssueOptions {
  workerNo: string;
  onSuccess: (result: SerialNumberBatchResult) => void;
}

/**
 * ① 개체 대량 발번.
 *
 * ⭐ **멱등 키의 수명은 `until-applied`** — 되돌릴 수 없는 쓰기다. 통신이 끊긴 뒤 다시 누르면
 * 서버가 다른 쓰기로 보고 **개체를 두 번 만든다.** 보낼 값이 바뀌면 지문이 새 키를 준다.
 *
 * ⛔ **부분 발번이 없다** — 하나라도 실패하면 서버가 전량 되돌린다. 화면이 「300 개는 됐습니다」를
 * 그릴 일이 없고, 그래서 실패 뒤 상태는 「아무것도 만들어지지 않음」 하나다.
 */
export const useSerialBatchIssue = ({
  workerNo,
  onSuccess,
}: SerialIssueOptions): MasterWriteResult<SerialNumberBatchCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<SerialNumberBatchCreate, SerialNumberBatchResult>({
    request: (body, headers) =>
      client.POST('/trace/serial-numbers', {
        params: {
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
          },
        },
        body,
      }),
    etagPath: null,
    /* 발번하면 이 LOT 의 미발행 양품이 줄어든다 — 다시 세야 발행 패널이 방금 만든 것을 반영한다. */
    invalidateKeys: [tagIssueKeys.serialCounts],
    knownFields: SERIAL_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};

export interface DocumentIssueOptions {
  workerNo: string;
  onSuccess: (result: DocumentIssueBatchResult) => void;
}

/**
 * ② 발행 기록.
 *
 * ⭐ **①이 돌려준 개체를 대상으로 삼는다.** 순서를 바꾸거나 병렬로 부를 수 없다 — 발행 기록의
 * 대상이 개체이므로 개체가 먼저 존재해야 담을 것이 생긴다(스펙 §5-3).
 *
 * ⛔ **①이 성공하고 이것이 실패한 상태는 오류가 아니다.** 「개체는 있고 아직 발행 안 됨」이고,
 * 재시도는 **개체를 다시 만들지 않고 이 호출만** 다시 한다.
 */
export const useDocumentBatchIssue = ({
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
    invalidateKeys: [tagIssueKeys.serialCounts],
    knownFields: ISSUE_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
