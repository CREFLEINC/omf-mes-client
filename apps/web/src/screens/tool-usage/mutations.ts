import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { toolUsageKeys } from './queries';
import type { ToolUsage, ToolUsageCreate } from './types';

/**
 * 툴 사용실적 등록.
 *
 * ⭐ **증분만 보낸다**(스펙 §5-2 · 공유계약 후보 9-1). 본문의 타발수는 「이번에 더할 값」이고
 * 누계는 서버가 더해 응답에 담는다. 화면이 최종값을 계산해 보내면 **오프라인 큐가 앞의 입력을
 * 지운다** — 나중에 도착한 것이 먼저 도착한 것을 덮기 때문이다.
 *
 * ⛔ **낙관적 잠금을 걸지 않는다**(`etagPath: null`). 증분 가산은 순서가 상관없고, 잠금을 걸면
 * 두 단말의 동시 입력이 서로를 거부한다. 계약도 이 오퍼레이션에 `If-Match` 를 두지 않았다.
 *
 * ⭐ **멱등 키의 수명은 `until-applied`** — 되돌릴 수 없는 쓰기다. 통신이 끊긴 뒤 다시 누르면
 * 서버가 다른 쓰기로 보고 **타발수를 두 번 더한다.** 보낼 값이 바뀌면 지문이 새 키를 준다.
 *
 * ⚠ **사번 헤더는 인증이 아니라 귀속이다**(공유계약 D-5 · 통지 #563). 없으면 서버가 거부하므로
 * 부르는 쪽이 값을 확보한 뒤에만 저장을 연다.
 */
export interface ToolUsageWriteOptions {
  workerNo: string;
  onSuccess: (usage: ToolUsage) => void;
}

/** 인라인으로 낼 수 있는 필드 — 이 화면이 입력칸을 가진 것만이다. */
const KNOWN_FIELDS = ['shotCount', 'conversionBaseQty'] as const;

export const useToolUsageWrite = ({
  workerNo,
  onSuccess,
}: ToolUsageWriteOptions): MasterWriteResult<ToolUsageCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<ToolUsageCreate, ToolUsage>({
    request: (body, headers) =>
      client.POST('/maintenance/tool-usages', {
        params: {
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
          },
        },
        body,
      }),
    etagPath: null,
    /* 저장하면 서버 누계가 올라간다 — 다시 읽어야 ③ 구획이 방금 더한 값을 반영한다. */
    invalidateKeys: [toolUsageKeys.tools],
    knownFields: KNOWN_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
