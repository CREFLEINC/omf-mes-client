import type { ApiClient } from '@omf-mes/api-client';

import type { OutboxEntry, OutboxTransport } from '../patterns/outbox';
import { runRequest, type ApiCallResult } from '../patterns/request';

type Call = (path: string, init: Record<string, unknown>) => Promise<ApiCallResult<unknown>>;

/**
 * 큐에 담긴 건을 실제로 보낸다.
 *
 * 경로와 방식이 담길 때 정해지므로 계약 타입으로 좁힐 수 없다. 담는 쪽이 계약에 있는 경로를
 * 넣는 것을 전제로 하고, 여기서는 그것을 그대로 흘려보낸다.
 *
 * 낙관적 잠금 토큰을 싣지 않는다. 큐에 담긴 건의 토큰은 이미 낡았고, 충돌 화면을 볼 작업자가
 * 그 자리에 없다. 중복은 멱등키가 막고 상태 전이는 서버가 판정한다.
 */
export const createOutboxTransport = (api: ApiClient): OutboxTransport => {
  return async (entry: OutboxEntry) => {
    const call = (api.client as unknown as Record<string, Call>)[entry.method];

    if (call === undefined) {
      throw new Error(`보낼 수 없는 방식입니다: ${entry.method}`);
    }

    await runRequest(() =>
      call(entry.path, {
        body: entry.body,
        headers: { 'Idempotency-Key': entry.idempotencyKey },
      }),
    );
  };
};
