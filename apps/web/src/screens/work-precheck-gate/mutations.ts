import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { precheckKeys } from './queries';
import type { PrecheckDecision, PrecheckDecisionCreate } from './types';

/**
 * 통제 판정을 남기는 쓰기 하나.
 *
 * ```
 * POST /production/precheck-decisions   판정 기록 — ⭐ 네 값 «전부» 남긴다
 * ```
 *
 * ⭐ **차단도 기록한다**(스펙 §5-8 · §9-3). 차단이면 작업 세션이 열리지 않으므로 세션
 * 사건으로는 남길 수 없다 — **안 보이는 것과 안 남기는 것은 다르다.**
 *
 * ⛔ **본문에 사번을 싣지 않는다.** 귀속은 `X-Worker-No` 헤더가 나르고 서버가 옮겨 적는다.
 *
 * ⛔ **오프라인 큐를 만들지 않는다**(§6-1 · 통지 #556). 이 게이트는 온라인에서만 판정한다.
 *
 * ⭐ **멱등 키의 수명은 `until-applied`** — 판정 기록은 되돌릴 수 없다. 통신이 끊긴 뒤 다시
 * 누르면 같은 판정이 두 줄 남아 이력이 사실과 달라진다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 이 게이트에는 입력칸이 없다 — 인라인으로 낼 필드가 없다. */
const KNOWN_FIELDS: readonly string[] = [];

export interface RecordDecisionOptions {
  workerNo: string;
  onSuccess: (decision: PrecheckDecision) => void;
}

export const useRecordDecision = ({
  workerNo,
  onSuccess,
}: RecordDecisionOptions): MasterWriteResult<PrecheckDecisionCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<PrecheckDecisionCreate, PrecheckDecision>({
    request: (body, headers) =>
      client.POST('/production/precheck-decisions', {
        params: {
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
          },
        },
        body,
      }),
    /* 신규 생성이라 대조할 판이 없다. */
    etagPath: null,
    invalidateKeys: [precheckKeys.all],
    knownFields: KNOWN_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
