import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type { ReceiveBody } from './receive-entry';

/**
 * 입고 관리의 입하 등록 — 라벨 미부착 사유 코드 읽기 하나 · 쓰기 하나.
 *
 * 쓰기는 `POST /logistics/inbound-receipts:per-line`(서버 #825 · 장부 P-117) — 본문은 입하 등록과 같고 **줄마다
 * 입하 한 건**이 선다(입하번호는 품목마다 하나 · 사용자 결정 2026-10-24). 모든 건이 한 트랜잭션이라 한 줄이라도 막히면
 * 아무것도 서지 않는다. 한 품목만 받을 때도 이 경로로 보낸다 — 줄이 하나일 뿐 결과가 같고, 길이 하나라 응답 읽기도 하나다.
 */
type CodeValue = components['schemas']['CodeValue'];

/** 만들어진 입하 건 — 요청 줄 순서, 건마다 입하 등록 응답과 같은 한 벌(머리 `inboundReceipt` · 줄 `lines` 하나). */
export type ReceivePerLineResult = components['schemas']['InboundReceiptPerLineResponse'];

/** 라벨 미부착 사유 코드 그룹(입하 등록 창 · PDA 와 같다). */
export const SUBSTITUTE_LOT_REASON_GROUP = 'SUBSTITUTE_LOT_REASON';

export const receiveKeys = {
  reasons: ['inbound-schedule', 'code-values', SUBSTITUTE_LOT_REASON_GROUP] as const,
};

/** 라벨 미부착 사유 코드 — 받을 수 있는 화면(권한)에서만 부른다. */
export const useSubstituteLotReasons = (enabled: boolean): UseQueryResult<CodeValue[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiveKeys.reasons,
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: SUBSTITUTE_LOT_REASON_GROUP, page: 1, size: 200 } },
        }),
      ).then((response) => response.items),
  });
};

export interface ReceiveWriteOptions {
  /** 함께 다시 읽을 것 — 이 화면의 두 표 · 진행 · 초과분. */
  refreshKeys: readonly (readonly unknown[])[];
  onSuccess: (data: ReceivePerLineResult) => void;
}

/**
 * 입하 등록. **되돌릴 수 없는 쓰기**라 멱등 키를 「적용될 때까지」 붙든다(`until-applied`) — 응답을 받지 못하고 다시 눌러도
 * 서버가 같은 요청으로 묶어 입하가 두 번 서지 않는다. 줄 오류는 어느 칸인지 화면이 고를 수 없어 전부 배너로 간다.
 */
export const useReceivePerLine = (options: ReceiveWriteOptions): MasterWriteResult<ReceiveBody> => {
  const { client } = useApiClient();

  return useMasterWrite<ReceiveBody, ReceivePerLineResult>({
    request: (body, headers) =>
      client.POST('/logistics/inbound-receipts:per-line', {
        /* `X-Worker-No` 는 단말 토큰 요청에만 필요하다 — 관리 웹은 로그인 세션이라 싣지 않는다(server #919). */
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: options.refreshKeys,
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: options.onSuccess,
  });
};
