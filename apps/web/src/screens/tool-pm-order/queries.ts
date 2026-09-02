import type { ApiClient, ApiError, components } from '@omf-mes/api-client';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';
import { toMoldView, type MoldListResult } from './types';

/**
 * 이 화면의 오퍼레이션 — 툴 목록 하나와 오더 만들기(대상 수만큼).
 *
 * ⭐ **한 오더 = 한 툴이다.** 계약이 「한 번에 한 건을 만든다 — 여러 대상을 고른 화면은 대상
 * 수만큼 부른다」로 못 박았고, 그 이유를 **「일부만 성공하는 경우를 화면이 다룰 수 있어야
 * 하기 때문」**이라고 밝혔다. 그래서 이 파일은 공용 쓰기 훅을 쓰지 않고 **툴마다 결과를
 * 들고 있는** 전용 훅을 둔다 — 공용 훅은 쓰기 하나의 성공·실패만 말할 수 있다.
 *
 * ⭐ **멱등 키를 툴마다 따로 만들고 성공할 때까지 붙든다.** 일부가 실패해 다시 시도할 때
 * 이미 성공한 툴은 다시 보내지 않고, 실패한 툴은 **같은 키**로 다시 간다 — 앞선 요청이
 * 사실은 서버에 닿았을 수 있기 때문이다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];
type MaintenanceOrderCreate = components['schemas']['MaintenanceOrderCreate'];

export interface MoldListQuery {
  plantId?: number;
  pmDueOnly?: boolean;
  withOpenMaintenanceOrder?: boolean;
  guaranteedShotCountMissing?: boolean;
  sort?: 'SHOT_USAGE_DESC' | 'NEXT_PM_ASC' | 'CODE';
  page?: number;
}

export const toolPmKeys = {
  all: ['tool-pm-order'] as const,
  molds: (query: MoldListQuery) => ['tool-pm-order', 'molds', query] as const,
};

const fetchMolds = async (client: Client, query: MoldListQuery): Promise<MoldListResult> => {
  const data = await runRequest(() => client.GET('/mdm/molds', { params: { query } }));

  return {
    items: data.items.map(toMoldView),
    page: data.page,
  };
};

export const useMoldList = (query: MoldListQuery): UseQueryResult<MoldListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: toolPmKeys.molds(query),
    queryFn: () => fetchMolds(client, query),
  });
};

/** 툴 하나를 만든 결과. **성공과 실패를 한 모양에 담지 않는다** — 갈래로 가른다. */
export type OrderOutcome =
  | { moldId: number; kind: 'ok'; maintenanceOrderId: number }
  | { moldId: number; kind: 'error'; error: ApiError };

export interface BulkOrderResult {
  /** 대상 하나마다 요청을 보내되 **차례대로** 보낸다 — 아래 ⚠ 참조. */
  create: (bodies: { moldId: number; body: MaintenanceOrderCreate }[]) => void;
  isSaving: boolean;
  outcomes: OrderOutcome[];
  reset: () => void;
}

/**
 * 오더 만들기 — **툴마다 한 번씩, 차례대로.**
 *
 * ⚠ **한꺼번에 보내지 않는다.** 동시에 보내면 어느 것이 먼저 닿았는지 알 수 없고, 서버가
 * 같은 툴에 두 오더를 만드는 경합을 화면이 통제할 수 없다. 차례대로 보내면 느리지만 결과가
 * 결정적이고, 실패한 자리에서 멈추지 않고 **끝까지 가서 전부의 결과를 모은다** — 하나가
 * 실패했다고 나머지를 안 만들면 사용자가 다시 고르는 수고를 진다.
 */
export const useBulkOrderCreate = (): BulkOrderResult => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const [outcomes, setOutcomes] = useState<OrderOutcome[]>([]);

  /**
   * 툴마다 살아 있는 멱등 키. **성공할 때만 버린다** — 실패는 서버에 닿았는지 모르는
   * 상태이므로 같은 키로 다시 가야 두 오더가 생기지 않는다.
   */
  const keys = useRef<Map<number, string>>(new Map());

  const mutation = useMutation({
    mutationFn: async (
      bodies: { moldId: number; body: MaintenanceOrderCreate }[],
    ): Promise<OrderOutcome[]> => {
      const results: OrderOutcome[] = [];

      for (const { moldId, body } of bodies) {
        const key = keys.current.get(moldId) ?? crypto.randomUUID();

        keys.current.set(moldId, key);

        try {
          const created = await runRequest(() =>
            client.POST('/maintenance/orders', {
              params: { header: { 'Idempotency-Key': key } },
              body,
            }),
          );

          /* 성공한 키만 버린다 — 끝난 키로 다시 보내면 서버가 실행 없이 앞 응답을 되돌려 준다. */
          keys.current.delete(moldId);
          results.push({ moldId, kind: 'ok', maintenanceOrderId: created.maintenanceOrderId });
        } catch (cause) {
          results.push({ moldId, kind: 'error', error: toApiError(cause) });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      setOutcomes(results);
      /* 성공한 것이 하나라도 있으면 목록이 달라진다 — 열린 오더가 생겨 조건에서 빠진다. */
      void queryClient.invalidateQueries({ queryKey: toolPmKeys.all });
    },
  });

  return {
    create: (bodies) => {
      setOutcomes([]);
      mutation.mutate(bodies);
    },
    isSaving: mutation.isPending,
    outcomes,
    reset: () => {
      setOutcomes([]);
      mutation.reset();
    },
  };
};
